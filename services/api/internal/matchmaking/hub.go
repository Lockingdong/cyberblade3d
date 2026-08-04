package matchmaking

import (
	"context"
	crand "crypto/rand"
	"encoding/json"
	"errors"
	"fmt"
	"log/slog"
	"math/rand"
	"sync/atomic"
	"time"
)

type Config struct {
	ReadyTimeout      time.Duration
	Countdown         time.Duration
	BattleTimeout     time.Duration
	RoomCodeTTL       time.Duration
	RematchWindow     time.Duration
	ControlBuffer     int
	StateRate         int
	RateLimitBreaches int
	MaxPendingRooms   int
	MaxJoinFailures   int
}

func DefaultConfig() Config {
	return Config{
		ReadyTimeout:      60 * time.Second,
		Countdown:         3 * time.Second,
		BattleTimeout:     45 * time.Second,
		RoomCodeTTL:       10 * time.Minute,
		RematchWindow:     60 * time.Second,
		ControlBuffer:     64,
		StateRate:         40,
		RateLimitBreaches: 3,
		MaxPendingRooms:   5000,
		MaxJoinFailures:   10,
	}
}

type commandKind int

const (
	commandRegister commandKind = iota
	commandMessage
	commandDisconnect
	commandRoomReadyTimeout
	commandCountdownDone
	commandBattleTimeout
	commandRoomCodeExpired
	commandRematchTimeout
)

type command struct {
	kind    commandKind
	client  *Client
	message any
	raw     []byte
	roomID  string
	code    string
	pending *pendingRoom
}

type Hub struct {
	config     Config
	logger     *slog.Logger
	commands   chan command
	stop       chan struct{}
	done       chan struct{}
	queue      []*Client
	queued     map[*Client]string
	codes      map[string]*pendingRoom
	hosting    map[*Client]*pendingRoom
	rooms      map[string]*room
	clientRoom map[*Client]*room
	clients    map[*Client]struct{}
	nextID     atomic.Uint64
}

func NewHub(config Config, logger *slog.Logger) *Hub {
	if config.ControlBuffer <= 0 {
		config.ControlBuffer = 64
	}
	if config.StateRate <= 0 {
		config.StateRate = 40
	}
	if config.RateLimitBreaches <= 0 {
		config.RateLimitBreaches = 3
	}
	if config.RoomCodeTTL <= 0 {
		config.RoomCodeTTL = 10 * time.Minute
	}
	if config.RematchWindow <= 0 {
		config.RematchWindow = 60 * time.Second
	}
	if config.MaxPendingRooms <= 0 {
		config.MaxPendingRooms = 5000
	}
	if config.MaxJoinFailures <= 0 {
		config.MaxJoinFailures = 10
	}
	hub := &Hub{
		config:     config,
		logger:     logger,
		commands:   make(chan command, 256),
		stop:       make(chan struct{}),
		done:       make(chan struct{}),
		queued:     make(map[*Client]string),
		codes:      make(map[string]*pendingRoom),
		hosting:    make(map[*Client]*pendingRoom),
		rooms:      make(map[string]*room),
		clientRoom: make(map[*Client]*room),
		clients:    make(map[*Client]struct{}),
	}
	go hub.run()
	return hub
}

func (h *Hub) newID(prefix string) string {
	return fmt.Sprintf("%s_%d", prefix, h.nextID.Add(1))
}

func (h *Hub) register(client *Client) bool {
	return h.enqueue(command{kind: commandRegister, client: client})
}

func (h *Hub) submit(client *Client, message any, raw []byte) bool {
	return h.enqueue(command{kind: commandMessage, client: client, message: message, raw: raw})
}

func (h *Hub) disconnect(client *Client) {
	h.enqueue(command{kind: commandDisconnect, client: client})
}

func (h *Hub) enqueue(value command) bool {
	select {
	case h.commands <- value:
		return true
	case <-h.stop:
		return false
	}
}

func (h *Hub) Shutdown(ctx context.Context) error {
	select {
	case <-h.stop:
	default:
		close(h.stop)
	}
	select {
	case <-h.done:
		return nil
	case <-ctx.Done():
		return ctx.Err()
	}
}

func (h *Hub) run() {
	defer close(h.done)
	for {
		select {
		case value := <-h.commands:
			h.handle(value)
		case <-h.stop:
			for _, current := range h.rooms {
				current.stopTimers()
			}
			for _, pending := range h.codes {
				pending.expireTimer.Stop()
			}
			for client := range h.clients {
				client.close()
			}
			return
		}
	}
}

func (h *Hub) handle(value command) {
	switch value.kind {
	case commandRegister:
		h.clients[value.client] = struct{}{}
	case commandDisconnect:
		h.removeClient(value.client, true)
	case commandMessage:
		h.handleMessage(value.client, value.message, value.raw)
	case commandRoomReadyTimeout:
		if current := h.rooms[value.roomID]; current != nil && current.phase == phaseMatched {
			h.roomTimeout(current, "ROOM_TIMEOUT", "配對房間已逾時")
		}
	case commandCountdownDone:
		if current := h.rooms[value.roomID]; current != nil && current.phase == phaseCountdown {
			current.phase = phaseBattle
			current.rateWindow = time.Now()
			matchID := current.id
			current.phaseTimer = time.AfterFunc(h.config.BattleTimeout, func() {
				h.enqueue(command{kind: commandBattleTimeout, roomID: matchID})
			})
		}
	case commandBattleTimeout:
		if current := h.rooms[value.roomID]; current != nil &&
			(current.phase == phaseBattle || current.phase == phaseEnding) {
			h.roomTimeout(current, "BATTLE_TIMEOUT", "對戰已逾時")
		}
	case commandRoomCodeExpired:
		if h.codes[value.code] == value.pending {
			h.discardPendingRoom(value.pending)
			h.sendError(value.pending.host, "ROOM_EXPIRED", "好友房已逾時，請重新建立")
		}
	case commandRematchTimeout:
		if current := h.rooms[value.roomID]; current != nil && current.phase == phaseFinished {
			// Both sides are told the room is gone so neither keeps waiting on
			// a rematch that can no longer happen.
			h.send(current.host, opponentLeftPayload(current))
			h.send(current.guest, opponentLeftPayload(current))
			h.closeRoom(current)
		}
	}
}

func (h *Hub) handleMessage(client *Client, message any, raw []byte) {
	if _, ok := h.clients[client]; !ok {
		return
	}
	switch value := message.(type) {
	case *queueMessage:
		switch value.Type {
		case "join_queue":
			h.joinQueue(client, value.RequestID)
		case "create_room":
			h.createRoom(client, value.RequestID)
		default:
			h.cancelQueue(client, value.RequestID)
		}
	case *joinRoomMessage:
		h.joinRoom(client, value.RequestID, value.Code)
	case *readyMessage:
		h.ready(client, value)
	case *matchMessage:
		if value.Type == "rematch" {
			h.rematch(client, value.MatchID)
		} else {
			h.leave(client, value.MatchID)
		}
	case *stateMessage:
		h.relayState(client, value, raw)
	case *battleEventMessage:
		h.relayEvent(client, value, raw)
	case *matchEndMessage:
		h.endMatch(client, value, raw)
	default:
		h.sendError(client, "BAD_MESSAGE", "message is not valid in this session")
	}
}

func (h *Hub) joinQueue(client *Client, requestID string) {
	if _, inRoom := h.clientRoom[client]; inRoom {
		h.sendError(client, "ALREADY_IN_ROOM", "client is already in a room")
		return
	}
	if _, hosting := h.hosting[client]; hosting {
		h.sendError(client, "ALREADY_QUEUED", "client already hosts a friend room")
		return
	}
	if current, queued := h.queued[client]; queued {
		if current == requestID {
			h.send(client, map[string]any{"type": "queued", "requestId": requestID})
			return
		}
		h.sendError(client, "ALREADY_QUEUED", "client is already queued")
		return
	}
	h.queued[client] = requestID
	h.queue = append(h.queue, client)
	if !h.send(client, map[string]any{"type": "queued", "requestId": requestID}) {
		h.removeClient(client, true)
		return
	}
	h.matchQueued()
}

// cancelQueue cancels whichever wait the client has pending: the FIFO queue or
// an unjoined friend room. Both are acked with queue_left.
func (h *Hub) cancelQueue(client *Client, requestID string) {
	if pending := h.hosting[client]; pending != nil && pending.requestID == requestID {
		h.discardPendingRoom(pending)
		h.send(client, map[string]any{"type": "queue_left", "requestId": requestID})
		return
	}
	current, ok := h.queued[client]
	if !ok || current != requestID {
		h.sendError(client, "NOT_QUEUED", "queue request is not active")
		return
	}
	h.removeFromQueue(client)
	h.send(client, map[string]any{"type": "queue_left", "requestId": requestID})
}

func (h *Hub) matchQueued() {
	for len(h.queue) >= 2 {
		host, guest := h.queue[0], h.queue[1]
		h.queue = h.queue[2:]
		delete(h.queued, host)
		delete(h.queued, guest)
		h.startRoom(host, guest, "")
	}
}

func (h *Hub) createRoom(client *Client, requestID string) {
	if _, inRoom := h.clientRoom[client]; inRoom {
		h.sendError(client, "ALREADY_IN_ROOM", "client is already in a room")
		return
	}
	if _, queued := h.queued[client]; queued {
		h.sendError(client, "ALREADY_QUEUED", "client is already queued")
		return
	}
	if pending := h.hosting[client]; pending != nil {
		if pending.requestID == requestID {
			h.sendRoomCreated(pending)
			return
		}
		h.sendError(client, "ALREADY_QUEUED", "client already hosts a friend room")
		return
	}
	if len(h.codes) >= h.config.MaxPendingRooms {
		h.sendError(client, "SERVER_BUSY", "伺服器目前無法建立更多好友房")
		return
	}
	code, err := h.newRoomCode()
	if err != nil {
		h.logger.Warn("room code allocation failed", "error", err)
		h.sendError(client, "SERVER_BUSY", "無法產生房號，請稍後再試")
		return
	}
	pending := &pendingRoom{code: code, host: client, requestID: requestID}
	h.codes[code] = pending
	h.hosting[client] = pending
	if !h.sendRoomCreated(pending) {
		h.removeClient(client, true)
		return
	}
	pending.expireTimer = time.AfterFunc(h.config.RoomCodeTTL, func() {
		h.enqueue(command{kind: commandRoomCodeExpired, code: code, pending: pending})
	})
}

func (h *Hub) joinRoom(client *Client, requestID, code string) {
	if _, inRoom := h.clientRoom[client]; inRoom {
		h.sendError(client, "ALREADY_IN_ROOM", "client is already in a room")
		return
	}
	if _, queued := h.queued[client]; queued {
		h.sendError(client, "ALREADY_QUEUED", "client is already queued")
		return
	}
	pending := h.codes[code]
	if pending != nil && pending.host == client {
		h.sendError(client, "ROOM_SELF", "不能加入自己建立的房間")
		return
	}
	if h.hosting[client] != nil {
		h.sendError(client, "ALREADY_QUEUED", "client already hosts a friend room")
		return
	}
	if pending == nil {
		// A redeemed code is removed immediately, so "taken" and "expired" are
		// both reported as not found rather than leaking whether a code exists.
		h.rejectJoin(client, "ROOM_NOT_FOUND", "找不到這個房號，可能已失效或已被加入")
		return
	}
	client.joinFailures = 0
	h.discardPendingRoom(pending)
	h.startRoom(pending.host, client, pending.code)
}

// rejectJoin answers a bad code and drops clients that keep guessing.
func (h *Hub) rejectJoin(client *Client, code, message string) {
	client.joinFailures++
	if client.joinFailures >= h.config.MaxJoinFailures {
		h.sendError(client, "TOO_MANY_ATTEMPTS", "房號嘗試次數過多")
		h.removeClient(client, true)
		return
	}
	h.sendError(client, code, message)
}

// startRoom pairs two waiting clients. code is empty for queue matches and set
// for friend rooms; the client that created the room is always the host (p1).
func (h *Hub) startRoom(host, guest *Client, code string) {
	matchID := h.newID("m")
	current := &room{id: matchID, code: code, host: host, guest: guest, phase: phaseMatched}
	h.rooms[matchID] = current
	h.clientRoom[host] = current
	h.clientRoom[guest] = current
	if !h.sendMatched(current) {
		h.closeRoom(current)
		return
	}
	h.armReadyTimer(current)
}

func (h *Hub) sendMatched(current *room) bool {
	return h.send(current.host, map[string]any{
		"type": "matched", "matchId": current.id, "role": "host", "localTopId": "p1",
	}) && h.send(current.guest, map[string]any{
		"type": "matched", "matchId": current.id, "role": "guest", "localTopId": "p2",
	})
}

func (h *Hub) armReadyTimer(current *room) {
	// The room id changes on rematch, so the timer must capture the id it was
	// armed for instead of reading the field when it fires.
	matchID := current.id
	current.readyTimer = time.AfterFunc(h.config.ReadyTimeout, func() {
		h.enqueue(command{kind: commandRoomReadyTimeout, roomID: matchID})
	})
}

func (h *Hub) sendRoomCreated(pending *pendingRoom) bool {
	return h.send(pending.host, map[string]any{
		"type":        "room_created",
		"requestId":   pending.requestID,
		"code":        pending.code,
		"expiresInMs": h.config.RoomCodeTTL.Milliseconds(),
	})
}

func (h *Hub) discardPendingRoom(pending *pendingRoom) {
	if h.codes[pending.code] != pending {
		return
	}
	if pending.expireTimer != nil {
		pending.expireTimer.Stop()
	}
	delete(h.codes, pending.code)
	delete(h.hosting, pending.host)
}

func (h *Hub) newRoomCode() (string, error) {
	// 256 is not a multiple of the alphabet size, so bytes in the tail of the
	// range are rejected instead of folded in and skewing the distribution.
	const usable = 256 - 256%len(roomCodeAlphabet)
	buffer := make([]byte, roomCodeLength*2)
	for attempt := 0; attempt < 10; attempt++ {
		letters := make([]byte, 0, roomCodeLength)
		for len(letters) < roomCodeLength {
			if _, err := crand.Read(buffer); err != nil {
				return "", err
			}
			for _, value := range buffer {
				if int(value) >= usable {
					continue
				}
				letters = append(letters, roomCodeAlphabet[int(value)%len(roomCodeAlphabet)])
				if len(letters) == roomCodeLength {
					break
				}
			}
		}
		code := string(letters)
		if _, taken := h.codes[code]; !taken {
			return code, nil
		}
	}
	return "", errors.New("could not allocate an unused room code")
}

func (h *Hub) ready(client *Client, value *readyMessage) {
	current := h.clientRoom[client]
	if current == nil || current.id != value.MatchID {
		if client.hasRecentMatch(value.MatchID) {
			return
		}
		h.sendError(client, "INVALID_MATCH", "match is not active")
		return
	}
	if current.phase != phaseMatched {
		h.sendError(client, "INVALID_PHASE", "ready is no longer accepted")
		return
	}
	copy := *value
	if client == current.host {
		current.hostReady = &copy
	} else {
		current.guestReady = &copy
	}
	h.send(current.peer(client), map[string]any{"type": "opponent_ready", "matchId": current.id})
	if current.hostReady == nil || current.guestReady == nil {
		return
	}
	if current.readyTimer != nil {
		current.readyTimer.Stop()
	}
	current.phase = phaseCountdown
	stadium := pickRandomStadium()
	start := map[string]any{
		"type":        "start",
		"matchId":     current.id,
		"countdownMs": h.config.Countdown.Milliseconds(),
		"stadium":     stadium,
		"environment": pickEnvironmentForStadium(stadium),
		"p1": selection{
			Blade: current.hostReady.Blade, Name: current.hostReady.Name,
			Wins: current.hostReady.Wins, Losses: current.hostReady.Losses,
			Power: current.hostReady.Power, Angle: current.hostReady.Angle,
			Color:   current.hostReady.Color,
			BladeID: current.hostReady.BladeID, RatchetID: current.hostReady.RatchetID,
			BitID: current.hostReady.BitID, ChipID: current.hostReady.ChipID,
		},
		"p2": selection{
			Blade: current.guestReady.Blade, Name: current.guestReady.Name,
			Wins: current.guestReady.Wins, Losses: current.guestReady.Losses,
			Power: current.guestReady.Power, Angle: current.guestReady.Angle,
			Color:   current.guestReady.Color,
			BladeID: current.guestReady.BladeID, RatchetID: current.guestReady.RatchetID,
			BitID: current.guestReady.BitID, ChipID: current.guestReady.ChipID,
		},
	}
	if !h.send(current.host, start) || !h.send(current.guest, start) {
		h.closeRoom(current)
		return
	}
	matchID := current.id
	current.phaseTimer = time.AfterFunc(h.config.Countdown, func() {
		h.enqueue(command{kind: commandCountdownDone, roomID: matchID})
	})
}

func (h *Hub) leave(client *Client, matchID string) {
	current := h.clientRoom[client]
	if current == nil || current.id != matchID {
		if client.hasRecentMatch(matchID) {
			return
		}
		h.sendError(client, "INVALID_MATCH", "match is not active")
		return
	}
	h.notifyOpponentLeft(current, client)
	h.closeRoom(current)
}

func (h *Hub) relayState(client *Client, value *stateMessage, raw []byte) {
	current := h.authorizedHost(client, value.MatchID)
	if current == nil {
		return
	}
	if current.phase != phaseBattle && current.phase != phaseEnding {
		h.sendError(client, "INVALID_PHASE", "state is not accepted in this phase")
		return
	}
	now := time.Now()
	if now.Sub(current.rateWindow) >= time.Second {
		current.rateWindow = now
		current.stateCount = 0
		current.rateBreaches = 0
	}
	current.stateCount++
	if current.stateCount > h.config.StateRate {
		current.rateBreaches++
		if current.rateBreaches >= h.config.RateLimitBreaches {
			h.sendError(client, "RATE_LIMIT", "state rate limit exceeded")
			h.removeClient(client, true)
		}
		return
	}
	current.guest.sendState(append([]byte(nil), raw...))
}

func (h *Hub) relayEvent(client *Client, value *battleEventMessage, raw []byte) {
	current := h.authorizedHost(client, value.MatchID)
	if current == nil {
		return
	}
	switch value.Event.Kind {
	case "collision", "burst":
		if current.phase != phaseBattle {
			h.sendError(client, "INVALID_PHASE", "battle event is not accepted in this phase")
			return
		}
	case "ending":
		if current.phase != phaseBattle || current.endingSeen {
			h.sendError(client, "INVALID_PHASE", "ending was already received or is not allowed")
			return
		}
		current.endingSeen = true
		current.phase = phaseEnding
	default:
		h.sendError(client, "BAD_MESSAGE", "unknown battle event")
		return
	}
	if !h.sendRaw(current.guest, raw) {
		h.removeClient(current.guest, true)
	}
}

func (h *Hub) endMatch(client *Client, value *matchEndMessage, raw []byte) {
	current := h.authorizedHost(client, value.MatchID)
	if current == nil {
		return
	}
	if current.phase != phaseEnding || !current.endingSeen {
		h.sendError(client, "INVALID_PHASE", "match_end requires an ending event")
		return
	}
	if current.matchEnded {
		return
	}
	current.matchEnded = true
	if !h.sendRaw(current.guest, raw) {
		h.removeClient(current.guest, false)
		return
	}
	// The room outlives the match so both players can ask for a rematch. It is
	// reclaimed when either side leaves, disconnects, or the window closes.
	current.stopTimers()
	current.phase = phaseFinished
	matchID := current.id
	current.rematchTimer = time.AfterFunc(h.config.RematchWindow, func() {
		h.enqueue(command{kind: commandRematchTimeout, roomID: matchID})
	})
}

func (h *Hub) rematch(client *Client, matchID string) {
	current := h.clientRoom[client]
	if current == nil || current.id != matchID {
		if client.hasRecentMatch(matchID) {
			return
		}
		h.sendError(client, "INVALID_MATCH", "match is not active")
		return
	}
	if current.phase != phaseFinished {
		h.sendError(client, "INVALID_PHASE", "rematch is not available in this phase")
		return
	}
	if client == current.host {
		if current.hostRematch {
			return
		}
		current.hostRematch = true
	} else {
		if current.guestRematch {
			return
		}
		current.guestRematch = true
	}
	h.send(current.peer(client), map[string]any{"type": "opponent_rematch", "matchId": current.id})
	if current.hostRematch && current.guestRematch {
		h.restartRoom(current)
	}
}

// restartRoom re-enters the matched phase under a fresh match id. Reusing the
// old id would let late frames from the finished match reach the new one.
func (h *Hub) restartRoom(current *room) {
	current.stopTimers()
	delete(h.rooms, current.id)
	current.host.rememberMatch(current.id)
	current.guest.rememberMatch(current.id)
	current.id = h.newID("m")
	current.phase = phaseMatched
	current.hostReady = nil
	current.guestReady = nil
	current.endingSeen = false
	current.matchEnded = false
	current.hostRematch = false
	current.guestRematch = false
	current.stateCount = 0
	current.rateBreaches = 0
	h.rooms[current.id] = current
	if !h.sendMatched(current) {
		h.closeRoom(current)
		return
	}
	h.armReadyTimer(current)
}

func (h *Hub) authorizedHost(client *Client, matchID string) *room {
	current := h.clientRoom[client]
	if current == nil || current.id != matchID {
		if client.hasRecentMatch(matchID) {
			return nil
		}
		h.sendError(client, "INVALID_MATCH", "match is not active")
		return nil
	}
	if current.host != client {
		h.sendError(client, "HOST_ONLY", "only the host may send battle data")
		return nil
	}
	if current.phase == phaseFinished {
		// The room is only still open for a rematch. Late frames and duplicate
		// terminal messages are expected here and are dropped without an error.
		return nil
	}
	return current
}

func (h *Hub) roomTimeout(current *room, code, message string) {
	h.sendError(current.host, code, message)
	h.sendError(current.guest, code, message)
	h.closeRoom(current)
}

func (h *Hub) notifyOpponentLeft(current *room, departed *Client) {
	h.send(current.peer(departed), opponentLeftPayload(current))
}

func opponentLeftPayload(current *room) map[string]any {
	return map[string]any{
		"type": "opponent_left", "matchId": current.id, "phase": current.phase,
	}
}

func (h *Hub) removeClient(client *Client, notify bool) {
	if _, exists := h.clients[client]; !exists {
		return
	}
	delete(h.clients, client)
	h.removeFromQueue(client)
	if pending := h.hosting[client]; pending != nil {
		h.discardPendingRoom(pending)
	}
	if current := h.clientRoom[client]; current != nil {
		if notify {
			h.notifyOpponentLeft(current, client)
		}
		h.closeRoom(current)
	}
	client.close()
}

func (h *Hub) removeFromQueue(client *Client) {
	if _, exists := h.queued[client]; !exists {
		return
	}
	delete(h.queued, client)
	for index, queued := range h.queue {
		if queued == client {
			h.queue = append(h.queue[:index], h.queue[index+1:]...)
			return
		}
	}
}

func (h *Hub) closeRoom(current *room) {
	if h.rooms[current.id] != current {
		return
	}
	current.stopTimers()
	delete(h.rooms, current.id)
	delete(h.clientRoom, current.host)
	delete(h.clientRoom, current.guest)
	current.host.rememberMatch(current.id)
	current.guest.rememberMatch(current.id)
}

func (h *Hub) send(client *Client, value any) bool {
	if client == nil {
		return false
	}
	if client.sendControl(value) {
		return true
	}
	h.logger.Warn("control queue full", "client", client.id)
	return false
}

func (h *Hub) sendRaw(client *Client, raw []byte) bool {
	var value json.RawMessage = append([]byte(nil), raw...)
	return h.send(client, &value)
}

func (h *Hub) sendError(client *Client, code, message string) {
	if !h.send(client, map[string]any{"type": "error", "code": code, "message": message}) {
		h.removeClient(client, true)
	}
}

func pickRandomStadium() string {
	return validStadiumList[rand.Intn(len(validStadiumList))]
}

func environmentForStadium(stadium string) string {
	switch stadium {
	case "toxic":
		return "toxic-refinery"
	case "volcano":
		return "volcano-caldera"
	default:
		return "neon-city"
	}
}

func pickEnvironmentForStadium(stadium string) string {
	if stadium == "neon" && rand.Intn(4) == 0 {
		return "xinyi-night"
	}
	return environmentForStadium(stadium)
}

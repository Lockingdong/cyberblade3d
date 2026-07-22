package matchmaking

import (
	"context"
	"encoding/json"
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
	ControlBuffer     int
	StateRate         int
	RateLimitBreaches int
}

func DefaultConfig() Config {
	return Config{
		ReadyTimeout:      60 * time.Second,
		Countdown:         3 * time.Second,
		BattleTimeout:     45 * time.Second,
		ControlBuffer:     64,
		StateRate:         40,
		RateLimitBreaches: 3,
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
)

type command struct {
	kind    commandKind
	client  *Client
	message any
	raw     []byte
	roomID  string
}

type Hub struct {
	config     Config
	logger     *slog.Logger
	commands   chan command
	stop       chan struct{}
	done       chan struct{}
	queue      []*Client
	queued     map[*Client]string
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
	hub := &Hub{
		config:     config,
		logger:     logger,
		commands:   make(chan command, 256),
		stop:       make(chan struct{}),
		done:       make(chan struct{}),
		queued:     make(map[*Client]string),
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
			current.phaseTimer = time.AfterFunc(h.config.BattleTimeout, func() {
				h.enqueue(command{kind: commandBattleTimeout, roomID: current.id})
			})
		}
	case commandBattleTimeout:
		if current := h.rooms[value.roomID]; current != nil &&
			(current.phase == phaseBattle || current.phase == phaseEnding) {
			h.roomTimeout(current, "BATTLE_TIMEOUT", "對戰已逾時")
		}
	}
}

func (h *Hub) handleMessage(client *Client, message any, raw []byte) {
	if _, ok := h.clients[client]; !ok {
		return
	}
	switch value := message.(type) {
	case *queueMessage:
		if value.Type == "join_queue" {
			h.joinQueue(client, value.RequestID)
		} else {
			h.cancelQueue(client, value.RequestID)
		}
	case *readyMessage:
		h.ready(client, value)
	case *matchMessage:
		h.leave(client, value.MatchID)
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

func (h *Hub) cancelQueue(client *Client, requestID string) {
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
		matchID := h.newID("m")
		current := &room{id: matchID, host: host, guest: guest, phase: phaseMatched}
		h.rooms[matchID] = current
		h.clientRoom[host] = current
		h.clientRoom[guest] = current
		if !h.send(host, map[string]any{
			"type": "matched", "matchId": matchID, "role": "host", "localTopId": "p1",
		}) || !h.send(guest, map[string]any{
			"type": "matched", "matchId": matchID, "role": "guest", "localTopId": "p2",
		}) {
			h.closeRoom(current)
			continue
		}
		current.readyTimer = time.AfterFunc(h.config.ReadyTimeout, func() {
			h.enqueue(command{kind: commandRoomReadyTimeout, roomID: matchID})
		})
	}
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
	start := map[string]any{
		"type":        "start",
		"matchId":     current.id,
		"countdownMs": h.config.Countdown.Milliseconds(),
		"stadium":     current.hostReady.Stadium,
		"environment": pickRandomEnvironment(),
		"p1": selection{
			Blade: current.hostReady.Blade, Name: current.hostReady.Name,
			Wins: current.hostReady.Wins, Losses: current.hostReady.Losses,
			Power: current.hostReady.Power, Angle: current.hostReady.Angle,
			Color: current.hostReady.Color,
			BladeID: current.hostReady.BladeID, RatchetID: current.hostReady.RatchetID,
			BitID: current.hostReady.BitID, ChipID: current.hostReady.ChipID,
		},
		"p2": selection{
			Blade: current.guestReady.Blade, Name: current.guestReady.Name,
			Wins: current.guestReady.Wins, Losses: current.guestReady.Losses,
			Power: current.guestReady.Power, Angle: current.guestReady.Angle,
			Color: current.guestReady.Color,
			BladeID: current.guestReady.BladeID, RatchetID: current.guestReady.RatchetID,
			BitID: current.guestReady.BitID, ChipID: current.guestReady.ChipID,
		},
	}
	if !h.send(current.host, start) || !h.send(current.guest, start) {
		h.closeRoom(current)
		return
	}
	current.phaseTimer = time.AfterFunc(h.config.Countdown, func() {
		h.enqueue(command{kind: commandCountdownDone, roomID: current.id})
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
	}
	h.closeRoom(current)
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
	return current
}

func (h *Hub) roomTimeout(current *room, code, message string) {
	h.sendError(current.host, code, message)
	h.sendError(current.guest, code, message)
	h.closeRoom(current)
}

func (h *Hub) notifyOpponentLeft(current *room, departed *Client) {
	peer := current.peer(departed)
	h.send(peer, map[string]any{
		"type": "opponent_left", "matchId": current.id, "phase": current.phase,
	})
}

func (h *Hub) removeClient(client *Client, notify bool) {
	if _, exists := h.clients[client]; !exists {
		return
	}
	delete(h.clients, client)
	h.removeFromQueue(client)
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

func pickRandomEnvironment() string {
	return validEnvironments[rand.Intn(len(validEnvironments))]
}

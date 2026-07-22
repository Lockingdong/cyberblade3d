package matchmaking

import (
	"context"
	"encoding/json"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/gorilla/websocket"
)

type testService struct {
	server *Server
	http   *httptest.Server
}

func newTestService(t *testing.T, mutate func(*Config)) *testService {
	t.Helper()
	config := DefaultConfig()
	config.Countdown = 5 * time.Millisecond
	config.ReadyTimeout = 200 * time.Millisecond
	config.BattleTimeout = 200 * time.Millisecond
	if mutate != nil {
		mutate(&config)
	}
	logger := slog.New(slog.NewTextHandler(io.Discard, nil))
	server := NewServer(config, []string{"https://allowed.example"}, logger)
	httpServer := httptest.NewServer(server.Handler())
	service := &testService{server: server, http: httpServer}
	t.Cleanup(func() {
		httpServer.Close()
		ctx, cancel := context.WithTimeout(context.Background(), time.Second)
		defer cancel()
		if err := server.Shutdown(ctx); err != nil {
			t.Errorf("shutdown: %v", err)
		}
	})
	return service
}

func (s *testService) dial(t *testing.T) *websocket.Conn {
	t.Helper()
	url := "ws" + strings.TrimPrefix(s.http.URL, "http") + "/ws"
	conn, response, err := websocket.DefaultDialer.Dial(url, nil)
	if err != nil {
		if response != nil {
			t.Fatalf("dial: %v (status %s)", err, response.Status)
		}
		t.Fatalf("dial: %v", err)
	}
	t.Cleanup(func() { _ = conn.Close() })
	writeJSON(t, conn, map[string]any{"type": "hello", "protocolVersion": ProtocolVersion})
	expectType(t, conn, "hello_ok")
	return conn
}

func TestHealthAndOriginPolicy(t *testing.T) {
	t.Parallel()
	service := newTestService(t, nil)
	response, err := http.Get(service.http.URL + "/health")
	if err != nil {
		t.Fatal(err)
	}
	defer response.Body.Close()
	if response.StatusCode != http.StatusOK {
		t.Fatalf("health status = %d", response.StatusCode)
	}

	url := "ws" + strings.TrimPrefix(service.http.URL, "http") + "/ws"
	header := http.Header{"Origin": []string{"https://blocked.example"}}
	conn, response, err := websocket.DefaultDialer.Dial(url, header)
	if conn != nil {
		_ = conn.Close()
	}
	if err == nil || response == nil || response.StatusCode != http.StatusForbidden {
		t.Fatalf("blocked origin dial = (%v, %#v), want HTTP 403", err, response)
	}
}

func TestHelloMustBeFirstAndVersionMustMatch(t *testing.T) {
	t.Parallel()
	service := newTestService(t, nil)
	url := "ws" + strings.TrimPrefix(service.http.URL, "http") + "/ws"

	for _, first := range []map[string]any{
		{"type": "join_queue", "requestId": "q_1"},
		{"type": "hello", "protocolVersion": 999},
	} {
		conn, _, err := websocket.DefaultDialer.Dial(url, nil)
		if err != nil {
			t.Fatal(err)
		}
		writeJSON(t, conn, first)
		message := readJSON(t, conn)
		if message["type"] != "error" {
			t.Fatalf("first response = %#v, want error", message)
		}
		_ = conn.Close()
	}
}

func TestMatchReadyRelayAndEndIntegration(t *testing.T) {
	t.Parallel()
	service := newTestService(t, nil)
	host := service.dial(t)
	guest := service.dial(t)

	writeJSON(t, host, map[string]any{"type": "join_queue", "requestId": "q_host"})
	expectType(t, host, "queued")
	writeJSON(t, guest, map[string]any{"type": "join_queue", "requestId": "q_guest"})
	expectType(t, guest, "queued")
	hostMatched := expectType(t, host, "matched")
	guestMatched := expectType(t, guest, "matched")
	matchID := hostMatched["matchId"].(string)
	if guestMatched["matchId"] != matchID || hostMatched["role"] != "host" ||
		guestMatched["role"] != "guest" || guestMatched["localTopId"] != "p2" {
		t.Fatalf("unexpected matched messages: host=%#v guest=%#v", hostMatched, guestMatched)
	}

	writeJSON(t, guest, readyPayload(matchID, "stamina", 76, 12, "toxic"))
	expectType(t, host, "opponent_ready")
	writeJSON(t, host, readyPayload(matchID, "attack", 88, -23, "neon"))
	expectType(t, guest, "opponent_ready")
	hostStart := expectType(t, host, "start")
	guestStart := expectType(t, guest, "start")
	if hostStart["stadium"] != "neon" || guestStart["stadium"] != "neon" {
		t.Fatalf("host stadium was not selected: %#v %#v", hostStart, guestStart)
	}
	if hostStart["environment"] != guestStart["environment"] {
		t.Fatalf("environment mismatch: host=%v guest=%v", hostStart["environment"], guestStart["environment"])
	}
	if !isValidEnvironment(hostStart["environment"].(string)) {
		t.Fatalf("host environment is not valid: %v", hostStart["environment"])
	}

	time.Sleep(10 * time.Millisecond)
	state := statePayload(matchID, 1)
	writeJSON(t, host, state)
	if received := expectType(t, guest, "state"); received["seq"] != float64(1) {
		t.Fatalf("relayed state = %#v", received)
	}
	collision := map[string]any{
		"type": "battle_event", "matchId": matchID, "eventId": 1, "stateSeq": 1, "t": 0.08,
		"event": map[string]any{"kind": "collision", "p": []float64{0, 0.8, 0}, "intensity": 3},
	}
	writeJSON(t, host, collision)
	if received := expectType(t, guest, "battle_event"); received["eventId"] != float64(1) {
		t.Fatalf("relayed collision = %#v", received)
	}
	burst := map[string]any{
		"type": "battle_event", "matchId": matchID, "eventId": 2, "stateSeq": 1, "t": 0.09,
		"event": map[string]any{"kind": "burst", "top": "p2", "p": []float64{0.5, 0.8, 0}},
	}
	writeJSON(t, host, burst)
	if received := expectType(t, guest, "battle_event"); received["eventId"] != float64(2) {
		t.Fatalf("relayed burst = %#v", received)
	}
	ending := map[string]any{
		"type": "battle_event", "matchId": matchID, "eventId": 3, "stateSeq": 1, "t": 0.1,
		"event": map[string]any{"kind": "ending", "winnerId": "p1", "finishType": "BURST FINISH"},
	}
	writeJSON(t, host, ending)
	expectType(t, guest, "battle_event")
	matchEnd := map[string]any{
		"type": "match_end", "matchId": matchID, "stateSeq": 1, "t": 0.2,
		"winnerId": "p1", "finishType": "BURST FINISH", "duration": 0.1, "finalRpm": 2800,
	}
	writeJSON(t, host, matchEnd)
	expectType(t, guest, "match_end")

	// Duplicate terminal and stale state frames are ignored, while a completed
	// room releases both clients so they can enter a fresh match.
	writeJSON(t, host, matchEnd)
	writeJSON(t, host, statePayload(matchID, 2))
	writeJSON(t, host, map[string]any{"type": "join_queue", "requestId": "q_host_2"})
	expectType(t, host, "queued")
	writeJSON(t, guest, map[string]any{"type": "join_queue", "requestId": "q_guest_2"})
	expectType(t, guest, "queued")
	expectType(t, host, "matched")
	expectType(t, guest, "matched")
}

func TestFIFOQueueCancelAndDisconnectCleanup(t *testing.T) {
	t.Parallel()
	service := newTestService(t, nil)
	first := service.dial(t)
	second := service.dial(t)
	third := service.dial(t)

	writeJSON(t, first, map[string]any{"type": "join_queue", "requestId": "q_first"})
	expectType(t, first, "queued")
	writeJSON(t, first, map[string]any{"type": "cancel_queue", "requestId": "q_first"})
	expectType(t, first, "queue_left")

	writeJSON(t, second, map[string]any{"type": "join_queue", "requestId": "q_second"})
	expectType(t, second, "queued")
	_ = second.Close()
	time.Sleep(10 * time.Millisecond)

	writeJSON(t, first, map[string]any{"type": "join_queue", "requestId": "q_first_2"})
	expectType(t, first, "queued")
	writeJSON(t, third, map[string]any{"type": "join_queue", "requestId": "q_third"})
	expectType(t, third, "queued")
	firstMatched := expectType(t, first, "matched")
	thirdMatched := expectType(t, third, "matched")
	if firstMatched["role"] != "host" || thirdMatched["role"] != "guest" {
		t.Fatalf("FIFO roles = first %v, third %v", firstMatched["role"], thirdMatched["role"])
	}

	matchID := firstMatched["matchId"].(string)
	writeJSON(t, first, map[string]any{"type": "leave", "matchId": matchID})
	left := expectType(t, third, "opponent_left")
	if left["phase"] != "matched" {
		t.Fatalf("opponent_left phase = %v", left["phase"])
	}
}

func TestMatchedWinsWhenCancelArrivesAfterPairing(t *testing.T) {
	t.Parallel()
	service := newTestService(t, nil)
	host := service.dial(t)
	guest := service.dial(t)

	writeJSON(t, host, map[string]any{"type": "join_queue", "requestId": "q_host"})
	expectType(t, host, "queued")
	writeJSON(t, guest, map[string]any{"type": "join_queue", "requestId": "q_guest"})
	expectType(t, guest, "queued")
	hostMatched := expectType(t, host, "matched")
	expectType(t, guest, "matched")

	writeJSON(t, host, map[string]any{"type": "cancel_queue", "requestId": "q_host"})
	message := expectType(t, host, "error")
	if message["code"] != "NOT_QUEUED" {
		t.Fatalf("cancel after matched = %#v", message)
	}

	_ = guest.Close()
	left := expectType(t, host, "opponent_left")
	if left["matchId"] != hostMatched["matchId"] {
		t.Fatalf("disconnect notified wrong room: %#v", left)
	}
}

func TestDuplicateReadyInvalidReadyAndHostOnly(t *testing.T) {
	t.Parallel()
	service := newTestService(t, nil)
	host := service.dial(t)
	guest := service.dial(t)
	matchID := matchClients(t, host, guest)

	// Ready is idempotent and the final pre-countdown value wins.
	writeJSON(t, host, readyPayload(matchID, "attack", 50, 0, "toxic"))
	expectType(t, guest, "opponent_ready")
	writeJSON(t, host, readyPayload(matchID, "balance", 90, 10, "volcano"))
	expectType(t, guest, "opponent_ready")
	writeJSON(t, guest, readyPayload(matchID, "defense", 70, -10, "neon"))
	expectType(t, host, "opponent_ready")
	hostStart := expectType(t, host, "start")
	guestStart := expectType(t, guest, "start")
	if hostStart["stadium"] != "volcano" {
		t.Fatalf("duplicate ready did not overwrite selection: %#v", hostStart)
	}
	if hostStart["environment"] != guestStart["environment"] {
		t.Fatalf("environment mismatch: host=%v guest=%v", hostStart["environment"], guestStart["environment"])
	}
	if !isValidEnvironment(hostStart["environment"].(string)) {
		t.Fatalf("host environment is not valid: %v", hostStart["environment"])
	}

	time.Sleep(10 * time.Millisecond)
	writeJSON(t, guest, statePayload(matchID, 1))
	errorMessage := expectType(t, guest, "error")
	if errorMessage["code"] != "HOST_ONLY" {
		t.Fatalf("guest state error = %#v", errorMessage)
	}
}

func TestReadLimitClosesOversizedMessage(t *testing.T) {
	t.Parallel()
	service := newTestService(t, nil)
	conn := service.dial(t)
	oversized := `{"type":"join_queue","requestId":"` + strings.Repeat("x", readLimit) + `"}`
	_ = conn.SetWriteDeadline(time.Now().Add(time.Second))
	if err := conn.WriteMessage(websocket.TextMessage, []byte(oversized)); err != nil {
		t.Fatal(err)
	}
	_ = conn.SetReadDeadline(time.Now().Add(time.Second))
	if _, _, err := conn.ReadMessage(); err == nil {
		t.Fatal("oversized message did not close the connection")
	}
}

func TestReadyAndBattleTimeoutsReleaseRooms(t *testing.T) {
	t.Parallel()
	service := newTestService(t, func(config *Config) {
		config.ReadyTimeout = 20 * time.Millisecond
		config.BattleTimeout = 20 * time.Millisecond
	})
	host := service.dial(t)
	guest := service.dial(t)
	matchClients(t, host, guest)
	if message := expectType(t, host, "error"); message["code"] != "ROOM_TIMEOUT" {
		t.Fatalf("host timeout = %#v", message)
	}
	if message := expectType(t, guest, "error"); message["code"] != "ROOM_TIMEOUT" {
		t.Fatalf("guest timeout = %#v", message)
	}

	// The same connections can be paired again after timeout cleanup.
	matchID := matchClients(t, host, guest)
	writeJSON(t, host, readyPayload(matchID, "attack", 80, 0, "neon"))
	expectType(t, guest, "opponent_ready")
	writeJSON(t, guest, readyPayload(matchID, "defense", 80, 0, "neon"))
	expectType(t, host, "opponent_ready")
	expectType(t, host, "start")
	expectType(t, guest, "start")
	if message := expectType(t, host, "error"); message["code"] != "BATTLE_TIMEOUT" {
		t.Fatalf("host battle timeout = %#v", message)
	}
	if message := expectType(t, guest, "error"); message["code"] != "BATTLE_TIMEOUT" {
		t.Fatalf("guest battle timeout = %#v", message)
	}
}

func TestStateRateLimitClosesSustainedOffender(t *testing.T) {
	t.Parallel()
	service := newTestService(t, func(config *Config) {
		config.StateRate = 2
		config.RateLimitBreaches = 2
	})
	host := service.dial(t)
	guest := service.dial(t)
	matchID := matchClients(t, host, guest)
	writeJSON(t, host, readyPayload(matchID, "attack", 80, 0, "neon"))
	expectType(t, guest, "opponent_ready")
	writeJSON(t, guest, readyPayload(matchID, "defense", 80, 0, "neon"))
	expectType(t, host, "opponent_ready")
	expectType(t, host, "start")
	expectType(t, guest, "start")
	time.Sleep(10 * time.Millisecond)

	for seq := 0; seq < 4; seq++ {
		writeJSON(t, host, statePayload(matchID, seq))
	}
	var message map[string]any
	for {
		message = readJSON(t, guest)
		if message["type"] == "opponent_left" {
			break
		}
		if message["type"] != "state" {
			t.Fatalf("unexpected guest message before disconnect: %#v", message)
		}
	}
	if message["phase"] != "battle" {
		t.Fatalf("rate-limited opponent phase = %#v", message)
	}
}

func matchClients(t *testing.T, host, guest *websocket.Conn) string {
	t.Helper()
	writeJSON(t, host, map[string]any{"type": "join_queue", "requestId": "q_host_" + time.Now().String()})
	expectType(t, host, "queued")
	writeJSON(t, guest, map[string]any{"type": "join_queue", "requestId": "q_guest_" + time.Now().String()})
	expectType(t, guest, "queued")
	hostMatched := expectType(t, host, "matched")
	expectType(t, guest, "matched")
	return hostMatched["matchId"].(string)
}

func readyPayload(matchID, blade string, power, angle float64, stadium string) map[string]any {
	return map[string]any{
		"type": "ready", "matchId": matchID, "blade": blade,
		"power": power, "angle": angle, "stadium": stadium,
	}
}

func isValidEnvironment(value string) bool {
	for _, candidate := range validEnvironments {
		if candidate == value {
			return true
		}
	}
	return false
}

func statePayload(matchID string, seq int) map[string]any {
	return map[string]any{
		"type": "state", "matchId": matchID, "seq": seq, "t": float64(seq) / 20,
		"p1": map[string]any{"p": []float64{-1, 0.8, 0}, "rpm": 4000, "st": 80, "f": 0},
		"p2": map[string]any{"p": []float64{1, 0.8, 0}, "rpm": 3900, "st": 75, "f": 0},
	}
}

func writeJSON(t *testing.T, conn *websocket.Conn, value any) {
	t.Helper()
	_ = conn.SetWriteDeadline(time.Now().Add(time.Second))
	if err := conn.WriteJSON(value); err != nil {
		t.Fatalf("write websocket JSON: %v", err)
	}
}

func readJSON(t *testing.T, conn *websocket.Conn) map[string]any {
	t.Helper()
	_ = conn.SetReadDeadline(time.Now().Add(time.Second))
	var message map[string]any
	if err := conn.ReadJSON(&message); err != nil {
		t.Fatalf("read websocket JSON: %v", err)
	}
	return message
}

func expectType(t *testing.T, conn *websocket.Conn, messageType string) map[string]any {
	t.Helper()
	message := readJSON(t, conn)
	if message["type"] != messageType {
		encoded, _ := json.Marshal(message)
		t.Fatalf("message type = %v, want %s: %s", message["type"], messageType, encoded)
	}
	return message
}

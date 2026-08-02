package matchmaking

import (
	"context"
	"encoding/json"
	"io"
	"log/slog"
	"testing"
	"time"
)

func TestSlowGuestDropsOldStateButKeepsControl(t *testing.T) {
	t.Parallel()
	config := DefaultConfig()
	config.Countdown = time.Millisecond
	config.ControlBuffer = 8
	logger := slog.New(slog.NewTextHandler(io.Discard, nil))
	hub := NewHub(config, logger)
	t.Cleanup(func() {
		ctx, cancel := context.WithTimeout(context.Background(), time.Second)
		defer cancel()
		if err := hub.Shutdown(ctx); err != nil {
			t.Errorf("shutdown: %v", err)
		}
	})
	host := newClient("host", hub, nil, logger)
	guest := newClient("guest", hub, nil, logger)
	hub.register(host)
	hub.register(guest)
	hub.submit(host, &queueMessage{Type: "join_queue", RequestID: "q_host"}, nil)
	hub.submit(guest, &queueMessage{Type: "join_queue", RequestID: "q_guest"}, nil)

	consumeType(t, host.control, "queued")
	consumeType(t, guest.control, "queued")
	hostMatched := consumeType(t, host.control, "matched")
	consumeType(t, guest.control, "matched")
	matchID := hostMatched["matchId"].(string)
	hub.submit(host, &readyMessage{
		Type: "ready", MatchID: matchID, Blade: "attack", Power: 80, Stadium: "neon",
	}, nil)
	consumeType(t, guest.control, "opponent_ready")
	hub.submit(guest, &readyMessage{
		Type: "ready", MatchID: matchID, Blade: "defense", Power: 80, Stadium: "neon",
	}, nil)
	consumeType(t, host.control, "opponent_ready")
	consumeType(t, host.control, "start")
	consumeType(t, guest.control, "start")
	time.Sleep(5 * time.Millisecond)

	for seq := 1; seq <= 20; seq++ {
		value := stateMessage{
			Type: "state", MatchID: matchID, Seq: int64(seq), Time: float64(seq),
			P1: wireTopState{RPM: 1}, P2: wireTopState{RPM: 1},
		}
		raw, err := json.Marshal(value)
		if err != nil {
			t.Fatal(err)
		}
		hub.submit(host, &value, raw)
	}
	event := battleEventMessage{
		Type: "battle_event", MatchID: matchID, EventID: 1, StateSeq: 20, Time: 20,
		Event: wireBattleEvent{
			Kind: "ending", WinnerID: "p1", FinishType: "SPIN FINISH",
		},
	}
	raw, err := json.Marshal(event)
	if err != nil {
		t.Fatal(err)
	}
	hub.submit(host, &event, raw)
	// The event shares the hub command stream with state, so receiving it proves
	// all preceding snapshots have been considered.
	consumeType(t, guest.control, "battle_event")
	select {
	case raw := <-guest.state:
		var state stateMessage
		if err := json.Unmarshal(raw, &state); err != nil {
			t.Fatal(err)
		}
		if state.Seq != 20 {
			t.Fatalf("buffered state seq = %d, want newest seq 20", state.Seq)
		}
	case <-time.After(time.Second):
		t.Fatal("timed out waiting for state")
	}
}

func TestFriendRoomCodeRejectsBadRedemptions(t *testing.T) {
	t.Parallel()
	config := DefaultConfig()
	hub, logger := newTestHub(t, config)
	host := newClient("host", hub, nil, logger)
	guest := newClient("guest", hub, nil, logger)
	hub.register(host)
	hub.register(guest)

	hub.submit(host, &queueMessage{Type: "create_room", RequestID: "r_host"}, nil)
	created := consumeType(t, host.control, "room_created")
	code := created["code"].(string)
	if !validRoomCode(code) {
		t.Fatalf("room code = %q, want %d characters from the code alphabet", code, roomCodeLength)
	}

	hub.submit(host, &joinRoomMessage{Type: "join_room", RequestID: "j_self", Code: code}, nil)
	if failure := consumeType(t, host.control, "error"); failure["code"] != "ROOM_SELF" {
		t.Fatalf("self join = %#v, want ROOM_SELF", failure)
	}
	missing := "QQQQQQ"
	if missing == code {
		missing = "RRRRRR"
	}
	hub.submit(guest, &joinRoomMessage{Type: "join_room", RequestID: "j_miss", Code: missing}, nil)
	if failure := consumeType(t, guest.control, "error"); failure["code"] != "ROOM_NOT_FOUND" {
		t.Fatalf("unknown code = %#v, want ROOM_NOT_FOUND", failure)
	}

	// Cancelling releases the code, so redeeming it afterwards fails too.
	hub.submit(host, &queueMessage{Type: "cancel_queue", RequestID: "r_host"}, nil)
	consumeType(t, host.control, "queue_left")
	hub.submit(guest, &joinRoomMessage{Type: "join_room", RequestID: "j_late", Code: code}, nil)
	if failure := consumeType(t, guest.control, "error"); failure["code"] != "ROOM_NOT_FOUND" {
		t.Fatalf("cancelled code = %#v, want ROOM_NOT_FOUND", failure)
	}
}

func TestFriendRoomCodeExpires(t *testing.T) {
	t.Parallel()
	config := DefaultConfig()
	config.RoomCodeTTL = 20 * time.Millisecond
	hub, logger := newTestHub(t, config)
	host := newClient("host", hub, nil, logger)
	hub.register(host)

	hub.submit(host, &queueMessage{Type: "create_room", RequestID: "r_host"}, nil)
	consumeType(t, host.control, "room_created")
	if failure := consumeType(t, host.control, "error"); failure["code"] != "ROOM_EXPIRED" {
		t.Fatalf("expiry = %#v, want ROOM_EXPIRED", failure)
	}
}

func TestFriendRoomRematchRestartsUnderANewMatchID(t *testing.T) {
	t.Parallel()
	config := DefaultConfig()
	config.Countdown = time.Millisecond
	hub, logger := newTestHub(t, config)
	host := newClient("host", hub, nil, logger)
	guest := newClient("guest", hub, nil, logger)
	hub.register(host)
	hub.register(guest)

	hub.submit(host, &queueMessage{Type: "create_room", RequestID: "r_host"}, nil)
	code := consumeType(t, host.control, "room_created")["code"].(string)
	hub.submit(guest, &joinRoomMessage{Type: "join_room", RequestID: "j_guest", Code: code}, nil)
	hostMatched := consumeType(t, host.control, "matched")
	guestMatched := consumeType(t, guest.control, "matched")
	matchID := hostMatched["matchId"].(string)
	if hostMatched["role"] != "host" || guestMatched["role"] != "guest" {
		t.Fatalf("friend room roles = creator %v, joiner %v", hostMatched["role"], guestMatched["role"])
	}

	playMatch(t, hub, host, guest, matchID)

	hub.submit(host, &matchMessage{Type: "rematch", MatchID: matchID}, nil)
	consumeType(t, guest.control, "opponent_rematch")
	hub.submit(guest, &matchMessage{Type: "rematch", MatchID: matchID}, nil)
	consumeType(t, host.control, "opponent_rematch")

	rematched := consumeType(t, host.control, "matched")
	consumeType(t, guest.control, "matched")
	if rematched["matchId"] == matchID {
		t.Fatalf("rematch reused match id %v", matchID)
	}
	if rematched["role"] != "host" {
		t.Fatalf("rematch role = %v, want the original host", rematched["role"])
	}

	// The rematched room accepts a full second match under the new id.
	playMatch(t, hub, host, guest, rematched["matchId"].(string))
}

// playMatch drives a matched room through ready, battle and match_end.
func playMatch(t *testing.T, hub *Hub, host, guest *Client, matchID string) {
	t.Helper()
	hub.submit(host, &readyMessage{
		Type: "ready", MatchID: matchID, Blade: "attack", Power: 80, Stadium: "neon",
	}, nil)
	consumeType(t, guest.control, "opponent_ready")
	hub.submit(guest, &readyMessage{
		Type: "ready", MatchID: matchID, Blade: "defense", Power: 80, Stadium: "neon",
	}, nil)
	consumeType(t, host.control, "opponent_ready")
	consumeType(t, host.control, "start")
	consumeType(t, guest.control, "start")
	time.Sleep(5 * time.Millisecond)

	ending := battleEventMessage{
		Type: "battle_event", MatchID: matchID, EventID: 1, StateSeq: 0, Time: 1,
		Event: wireBattleEvent{Kind: "ending", WinnerID: "p1", FinishType: "SPIN FINISH"},
	}
	hub.submit(host, &ending, mustMarshal(t, ending))
	consumeType(t, guest.control, "battle_event")

	end := matchEndMessage{
		Type: "match_end", MatchID: matchID, StateSeq: 0, Time: 1,
		WinnerID: "p1", FinishType: "SPIN FINISH", Duration: 1, FinalRPM: 100,
	}
	hub.submit(host, &end, mustMarshal(t, end))
	consumeType(t, guest.control, "match_end")
}

func mustMarshal(t *testing.T, value any) []byte {
	t.Helper()
	raw, err := json.Marshal(value)
	if err != nil {
		t.Fatal(err)
	}
	return raw
}

func newTestHub(t *testing.T, config Config) (*Hub, *slog.Logger) {
	t.Helper()
	logger := slog.New(slog.NewTextHandler(io.Discard, nil))
	hub := NewHub(config, logger)
	t.Cleanup(func() {
		ctx, cancel := context.WithTimeout(context.Background(), time.Second)
		defer cancel()
		if err := hub.Shutdown(ctx); err != nil {
			t.Errorf("shutdown: %v", err)
		}
	})
	return hub, logger
}

func consumeType(t *testing.T, channel <-chan []byte, messageType string) map[string]any {
	t.Helper()
	select {
	case raw := <-channel:
		var message map[string]any
		if err := json.Unmarshal(raw, &message); err != nil {
			t.Fatal(err)
		}
		if message["type"] != messageType {
			t.Fatalf("message type = %v, want %s", message["type"], messageType)
		}
		return message
	case <-time.After(time.Second):
		t.Fatalf("timed out waiting for %s", messageType)
		return nil
	}
}

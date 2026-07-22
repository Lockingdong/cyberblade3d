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

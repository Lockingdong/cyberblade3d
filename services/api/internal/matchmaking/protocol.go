package matchmaking

import (
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"math"
)

// v2: six new blade types — old clients would crash on an unknown blade id
// mid-match, so the version gate rejects them cleanly at hello.
// v3: optional per-player accent color on ready/start.
// v4: optional 4-part custom assembly (bladeId, ratchetId, bitId, chipId) on ready/start.
const ProtocolVersion = 4

var (
	validBlades = map[string]bool{
		"attack": true, "defense": true, "stamina": true, "balance": true,
		"crusher": true, "phantom": true, "aegis": true, "vampire": true,
		"zephyr": true, "berserk": true,
	}
	validStadiums = map[string]bool{"neon": true, "toxic": true, "volcano": true}
	validEnvironments = []string{"space", "sunset", "deep-sea", "neon-city", "glacier"}
	validFinishes = map[string]bool{
		"BURST FINISH": true,
		"OVER FINISH":  true,
		"SPIN FINISH":  true,
		"TIME FINISH":  true,
	}
)

type envelope struct {
	Type string `json:"type"`
}

type helloMessage struct {
	Type            string `json:"type"`
	ProtocolVersion int    `json:"protocolVersion"`
}

type queueMessage struct {
	Type      string `json:"type"`
	RequestID string `json:"requestId"`
}

type matchMessage struct {
	Type    string `json:"type"`
	MatchID string `json:"matchId"`
}

type readyMessage struct {
	Type      string  `json:"type"`
	MatchID   string  `json:"matchId"`
	Blade     string  `json:"blade"`
	Name      string  `json:"name,omitempty"`
	Wins      int64   `json:"wins,omitempty"`
	Losses    int64   `json:"losses,omitempty"`
	Power     float64 `json:"power"`
	Angle     float64 `json:"angle"`
	Stadium   string  `json:"stadium"`
	Color     *int64  `json:"color,omitempty"`
	BladeID   string  `json:"bladeId,omitempty"`
	RatchetID string  `json:"ratchetId,omitempty"`
	BitID     string  `json:"bitId,omitempty"`
	ChipID    string  `json:"chipId,omitempty"`
}

type wireTopState struct {
	Position  [3]float64 `json:"p"`
	RPM       float64    `json:"rpm"`
	Stability float64    `json:"st"`
	Flags     int        `json:"f"`
}

type stateMessage struct {
	Type    string       `json:"type"`
	MatchID string       `json:"matchId"`
	Seq     int64        `json:"seq"`
	Time    float64      `json:"t"`
	P1      wireTopState `json:"p1"`
	P2      wireTopState `json:"p2"`
}

type wireBattleEvent struct {
	Kind       string      `json:"kind"`
	Position   *[3]float64 `json:"p,omitempty"`
	Intensity  *float64    `json:"intensity,omitempty"`
	Top        string      `json:"top,omitempty"`
	WinnerID   string      `json:"winnerId,omitempty"`
	FinishType string      `json:"finishType,omitempty"`
}

type battleEventMessage struct {
	Type     string          `json:"type"`
	MatchID  string          `json:"matchId"`
	EventID  int64           `json:"eventId"`
	StateSeq int64           `json:"stateSeq"`
	Time     float64         `json:"t"`
	Event    wireBattleEvent `json:"event"`
}

type matchEndMessage struct {
	Type       string  `json:"type"`
	MatchID    string  `json:"matchId"`
	StateSeq   int64   `json:"stateSeq"`
	Time       float64 `json:"t"`
	WinnerID   string  `json:"winnerId"`
	FinishType string  `json:"finishType"`
	Duration   float64 `json:"duration"`
	FinalRPM   float64 `json:"finalRpm"`
}

type selection struct {
	Blade     string  `json:"blade"`
	Name      string  `json:"name,omitempty"`
	Wins      int64   `json:"wins,omitempty"`
	Losses    int64   `json:"losses,omitempty"`
	Power     float64 `json:"power"`
	Angle     float64 `json:"angle"`
	Color     *int64  `json:"color,omitempty"`
	BladeID   string  `json:"bladeId,omitempty"`
	RatchetID string  `json:"ratchetId,omitempty"`
	BitID     string  `json:"bitId,omitempty"`
	ChipID    string  `json:"chipId,omitempty"`
}

func decodeMessage(data []byte) (any, error) {
	decoder := json.NewDecoder(bytes.NewReader(data))
	decoder.DisallowUnknownFields()
	var env envelope
	if err := json.Unmarshal(data, &env); err != nil || env.Type == "" {
		return nil, errors.New("message must be a JSON object with a type")
	}

	var value any
	switch env.Type {
	case "hello":
		value = &helloMessage{}
	case "join_queue", "cancel_queue":
		value = &queueMessage{}
	case "ready":
		value = &readyMessage{}
	case "leave":
		value = &matchMessage{}
	case "state":
		value = &stateMessage{}
	case "battle_event":
		value = &battleEventMessage{}
	case "match_end":
		value = &matchEndMessage{}
	default:
		return nil, fmt.Errorf("unknown message type %q", env.Type)
	}
	if err := decoder.Decode(value); err != nil {
		return nil, fmt.Errorf("invalid %s message: %w", env.Type, err)
	}
	if err := decoder.Decode(&struct{}{}); !errors.Is(err, io.EOF) {
		return nil, errors.New("message contains trailing JSON")
	}
	if err := validateMessage(value); err != nil {
		return nil, err
	}
	return value, nil
}

func validateMessage(message any) error {
	switch value := message.(type) {
	case *helloMessage:
		return nil
	case *queueMessage:
		if !opaque(value.RequestID) {
			return errors.New("invalid requestId")
		}
	case *matchMessage:
		if !opaque(value.MatchID) {
			return errors.New("invalid matchId")
		}
	case *readyMessage:
		if !opaque(value.MatchID) {
			return errors.New("invalid matchId")
		}
		if len(value.Name) > 256 {
			return errors.New("invalid name")
		}
		if !validRecordCount(value.Wins) || !validRecordCount(value.Losses) {
			return errors.New("invalid record")
		}
		if !validBlades[value.Blade] || !validStadiums[value.Stadium] {
			return errors.New("invalid blade or stadium")
		}
		if !finite(value.Power) || value.Power < 10 || value.Power > 100 ||
			!finite(value.Angle) || value.Angle < -30 || value.Angle > 30 {
			return errors.New("power or angle out of range")
		}
		if value.Color != nil && (*value.Color < 0 || *value.Color > 0xFFFFFF) {
			return errors.New("color out of range")
		}
		if len(value.BladeID) > 64 || len(value.RatchetID) > 64 || len(value.BitID) > 64 || len(value.ChipID) > 64 {
			return errors.New("invalid part id")
		}
	case *stateMessage:
		if !opaque(value.MatchID) || value.Seq < 0 || !nonNegativeFinite(value.Time) ||
			!validTopState(value.P1) || !validTopState(value.P2) {
			return errors.New("invalid state")
		}
	case *battleEventMessage:
		if !opaque(value.MatchID) || value.EventID < 0 || value.StateSeq < 0 ||
			!nonNegativeFinite(value.Time) || !validEvent(value.Event) {
			return errors.New("invalid battle event")
		}
	case *matchEndMessage:
		if !opaque(value.MatchID) || value.StateSeq < 0 || !nonNegativeFinite(value.Time) ||
			!validWinner(value.WinnerID) || !validFinishes[value.FinishType] ||
			!nonNegativeFinite(value.Duration) || !nonNegativeFinite(value.FinalRPM) {
			return errors.New("invalid match end")
		}
	default:
		return errors.New("unsupported message")
	}
	return nil
}

func validTopState(value wireTopState) bool {
	return finiteVec(value.Position) && nonNegativeFinite(value.RPM) &&
		nonNegativeFinite(value.Stability) && value.Flags >= 0 && value.Flags <= 7
}

func validEvent(value wireBattleEvent) bool {
	switch value.Kind {
	case "collision":
		return value.Position != nil && finiteVec(*value.Position) &&
			value.Intensity != nil && finite(*value.Intensity)
	case "burst":
		return value.Position != nil && finiteVec(*value.Position) &&
			(value.Top == "p1" || value.Top == "p2")
	case "ending":
		return validWinner(value.WinnerID) && validFinishes[value.FinishType]
	default:
		return false
	}
}

func validWinner(value string) bool {
	return value == "p1" || value == "p2" || value == "draw"
}

const maxRecordCount = 1_000_000

func validRecordCount(value int64) bool {
	return value >= 0 && value <= maxRecordCount
}

func opaque(value string) bool {
	return len(value) > 0 && len(value) <= 256
}

func finite(value float64) bool {
	return !math.IsNaN(value) && !math.IsInf(value, 0)
}

func nonNegativeFinite(value float64) bool {
	return finite(value) && value >= 0
}

func finiteVec(value [3]float64) bool {
	return finite(value[0]) && finite(value[1]) && finite(value[2])
}

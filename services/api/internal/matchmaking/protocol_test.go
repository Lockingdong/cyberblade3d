package matchmaking

import (
	"strings"
	"testing"
)

func TestDecodeMessageValidation(t *testing.T) {
	t.Parallel()
	tests := []struct {
		name    string
		input   string
		wantErr bool
	}{
		{name: "hello", input: `{"type":"hello","protocolVersion":1}`},
		{name: "ready", input: `{"type":"ready","matchId":"m_1","blade":"attack","power":88.5,"angle":-23.4,"stadium":"neon"}`},
		{name: "ready with custom parts", input: `{"type":"ready","matchId":"m_1","blade":"attack","power":88.5,"angle":-23.4,"stadium":"neon","bladeId":"red-blade","ratchetId":"r-3-60","bitId":"b-flat","chipId":"c-valkyrie"}`},
		{name: "ready with record", input: `{"type":"ready","matchId":"m_1","blade":"attack","name":"小明","wins":12,"losses":3,"power":88.5,"angle":-23.4,"stadium":"neon"}`},
		{name: "negative record", input: `{"type":"ready","matchId":"m_1","blade":"attack","wins":-1,"power":50,"angle":0,"stadium":"neon"}`, wantErr: true},
		{name: "oversized record", input: `{"type":"ready","matchId":"m_1","blade":"attack","losses":1000001,"power":50,"angle":0,"stadium":"neon"}`, wantErr: true},
		{name: "state", input: `{"type":"state","matchId":"m_1","seq":1,"t":0.1,"p1":{"p":[0,1,2],"rpm":4000,"st":90,"f":0},"p2":{"p":[2,1,0],"rpm":3900,"st":80,"f":1}}`},
		{name: "ending", input: `{"type":"battle_event","matchId":"m_1","eventId":1,"stateSeq":2,"t":0.2,"event":{"kind":"ending","winnerId":"p1","finishType":"BURST FINISH"}}`},
		{name: "power too low", input: `{"type":"ready","matchId":"m_1","blade":"attack","power":9,"angle":0,"stadium":"neon"}`, wantErr: true},
		{name: "angle too high", input: `{"type":"ready","matchId":"m_1","blade":"attack","power":50,"angle":31,"stadium":"neon"}`, wantErr: true},
		{name: "unknown enum", input: `{"type":"ready","matchId":"m_1","blade":"magic","power":50,"angle":0,"stadium":"neon"}`, wantErr: true},
		{name: "non finite", input: `{"type":"ready","matchId":"m_1","blade":"attack","power":1e999,"angle":0,"stadium":"neon"}`, wantErr: true},
		{name: "bad flags", input: `{"type":"state","matchId":"m_1","seq":1,"t":0.1,"p1":{"p":[0,1,2],"rpm":4000,"st":90,"f":8},"p2":{"p":[2,1,0],"rpm":3900,"st":80,"f":0}}`, wantErr: true},
		{name: "unknown field", input: `{"type":"hello","protocolVersion":1,"extra":true}`, wantErr: true},
		{name: "trailing JSON", input: `{"type":"hello","protocolVersion":1} {"type":"hello","protocolVersion":1}`, wantErr: true},
		{name: "unknown type", input: `{"type":"nope"}`, wantErr: true},
	}

	for _, test := range tests {
		test := test
		t.Run(test.name, func(t *testing.T) {
			t.Parallel()
			_, err := decodeMessage([]byte(test.input))
			if (err != nil) != test.wantErr {
				t.Fatalf("decodeMessage() error = %v, wantErr %v", err, test.wantErr)
			}
		})
	}
}

func TestOpaqueLengthLimit(t *testing.T) {
	t.Parallel()
	requestID := strings.Repeat("x", 257)
	_, err := decodeMessage([]byte(`{"type":"join_queue","requestId":"` + requestID + `"}`))
	if err == nil {
		t.Fatal("decodeMessage() accepted a requestId longer than 256 bytes")
	}
}

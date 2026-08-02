package matchmaking

import "time"

type roomPhase string

const (
	phaseMatched   roomPhase = "matched"
	phaseCountdown roomPhase = "countdown"
	phaseBattle    roomPhase = "battle"
	phaseEnding    roomPhase = "ending"
	// phaseFinished keeps a room alive after match_end so both players can ask
	// for a rematch. No battle traffic is accepted in this phase.
	phaseFinished roomPhase = "finished"
)

type room struct {
	id           string
	code         string
	host         *Client
	guest        *Client
	phase        roomPhase
	hostReady    *readyMessage
	guestReady   *readyMessage
	endingSeen   bool
	matchEnded   bool
	hostRematch  bool
	guestRematch bool
	readyTimer   *time.Timer
	phaseTimer   *time.Timer
	rematchTimer *time.Timer
	rateWindow   time.Time
	stateCount   int
	rateBreaches int
}

// pendingRoom is a friend room whose code has been handed out but that nobody
// has joined yet. It becomes a room once a second player redeems the code.
type pendingRoom struct {
	code        string
	host        *Client
	requestID   string
	expireTimer *time.Timer
}

func (r *room) peer(client *Client) *Client {
	if client == r.host {
		return r.guest
	}
	return r.host
}

func (r *room) stopTimers() {
	if r.readyTimer != nil {
		r.readyTimer.Stop()
	}
	if r.phaseTimer != nil {
		r.phaseTimer.Stop()
	}
	if r.rematchTimer != nil {
		r.rematchTimer.Stop()
	}
}

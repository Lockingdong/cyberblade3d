package matchmaking

import "time"

type roomPhase string

const (
	phaseMatched   roomPhase = "matched"
	phaseCountdown roomPhase = "countdown"
	phaseBattle    roomPhase = "battle"
	phaseEnding    roomPhase = "ending"
)

type room struct {
	id           string
	host         *Client
	guest        *Client
	phase        roomPhase
	hostReady    *readyMessage
	guestReady   *readyMessage
	endingSeen   bool
	matchEnded   bool
	readyTimer   *time.Timer
	phaseTimer   *time.Timer
	rateWindow   time.Time
	stateCount   int
	rateBreaches int
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
}

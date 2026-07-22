package matchmaking

import (
	"encoding/json"
	"log/slog"
	"sync"
	"time"

	"github.com/gorilla/websocket"
)

const (
	readLimit    = 4096
	writeWait    = 10 * time.Second
	pongWait     = 30 * time.Second
	pingInterval = 10 * time.Second
)

type Client struct {
	id      string
	hub     *Hub
	conn    *websocket.Conn
	logger  *slog.Logger
	control chan []byte
	state   chan []byte
	done    chan struct{}
	once    sync.Once

	// recentMatches is owned by the hub goroutine. It lets late frames from a
	// closed room be ignored instead of affecting a client's next match.
	recentMatches []string
}

func (c *Client) rememberMatch(matchID string) {
	const retainedMatches = 8
	c.recentMatches = append(c.recentMatches, matchID)
	if len(c.recentMatches) > retainedMatches {
		c.recentMatches = c.recentMatches[len(c.recentMatches)-retainedMatches:]
	}
}

func (c *Client) hasRecentMatch(matchID string) bool {
	for _, recent := range c.recentMatches {
		if recent == matchID {
			return true
		}
	}
	return false
}

func newClient(id string, hub *Hub, conn *websocket.Conn, logger *slog.Logger) *Client {
	return &Client{
		id:      id,
		hub:     hub,
		conn:    conn,
		logger:  logger,
		control: make(chan []byte, hub.config.ControlBuffer),
		state:   make(chan []byte, 1),
		done:    make(chan struct{}),
	}
}

func (c *Client) sendControl(value any) bool {
	data, err := json.Marshal(value)
	if err != nil {
		c.logger.Error("encode outbound message", "error", err)
		return false
	}
	select {
	case c.control <- data:
		return true
	default:
		return false
	}
}

func (c *Client) sendState(data []byte) {
	select {
	case c.state <- data:
		return
	default:
	}
	select {
	case <-c.state:
	default:
	}
	select {
	case c.state <- data:
	default:
	}
}

func (c *Client) close() {
	c.once.Do(func() {
		close(c.done)
		if c.conn != nil {
			_ = c.conn.Close()
		}
	})
}

func (c *Client) readPump() {
	defer func() {
		c.hub.disconnect(c)
		c.close()
	}()
	c.conn.SetReadLimit(readLimit)
	_ = c.conn.SetReadDeadline(time.Now().Add(pongWait))
	c.conn.SetPongHandler(func(string) error {
		return c.conn.SetReadDeadline(time.Now().Add(pongWait))
	})

	helloComplete := false
	for {
		messageType, data, err := c.conn.ReadMessage()
		if err != nil {
			return
		}
		if messageType != websocket.TextMessage {
			c.protocolError("BAD_MESSAGE", "only text JSON messages are supported")
			return
		}
		message, err := decodeMessage(data)
		if err != nil {
			c.protocolError("BAD_MESSAGE", err.Error())
			return
		}
		if !helloComplete {
			hello, ok := message.(*helloMessage)
			if !ok {
				c.protocolError("HELLO_REQUIRED", "hello must be the first message")
				return
			}
			if hello.ProtocolVersion != ProtocolVersion {
				c.protocolError("VERSION_MISMATCH", "unsupported protocol version")
				return
			}
			helloComplete = true
			if !c.sendControl(map[string]any{
				"type":            "hello_ok",
				"protocolVersion": ProtocolVersion,
			}) {
				return
			}
			continue
		}
		if _, ok := message.(*helloMessage); ok {
			c.protocolError("BAD_MESSAGE", "hello may only be sent once")
			return
		}
		if !c.hub.submit(c, message, data) {
			return
		}
	}
}

func (c *Client) protocolError(code, message string) {
	_ = c.sendControl(map[string]any{"type": "error", "code": code, "message": message})
	select {
	case <-time.After(25 * time.Millisecond):
	case <-c.done:
	}
}

func (c *Client) writePump() {
	ticker := time.NewTicker(pingInterval)
	defer func() {
		ticker.Stop()
		c.close()
	}()
	for {
		// Always give control messages the first opportunity to drain.
		select {
		case data := <-c.control:
			if !c.write(websocket.TextMessage, data) {
				return
			}
			continue
		default:
		}

		select {
		case data := <-c.control:
			if !c.write(websocket.TextMessage, data) {
				return
			}
		case data := <-c.state:
			if !c.write(websocket.TextMessage, data) {
				return
			}
		case <-ticker.C:
			if !c.write(websocket.PingMessage, nil) {
				return
			}
		case <-c.done:
			return
		}
	}
}

func (c *Client) write(messageType int, data []byte) bool {
	_ = c.conn.SetWriteDeadline(time.Now().Add(writeWait))
	if err := c.conn.WriteMessage(messageType, data); err != nil {
		return false
	}
	return true
}

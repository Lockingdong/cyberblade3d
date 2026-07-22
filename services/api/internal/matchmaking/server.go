package matchmaking

import (
	"context"
	"encoding/json"
	"log/slog"
	"net/http"
	"strings"
	"time"

	"github.com/gorilla/websocket"
)

type Server struct {
	hub      *Hub
	logger   *slog.Logger
	upgrader websocket.Upgrader
}

func NewServer(config Config, allowedOrigins []string, logger *slog.Logger) *Server {
	origins := make(map[string]bool, len(allowedOrigins))
	for _, origin := range allowedOrigins {
		if value := strings.TrimSpace(origin); value != "" {
			origins[value] = true
		}
	}
	server := &Server{hub: NewHub(config, logger), logger: logger}
	server.upgrader = websocket.Upgrader{
		HandshakeTimeout: 5 * time.Second,
		CheckOrigin: func(request *http.Request) bool {
			origin := request.Header.Get("Origin")
			return origin == "" || origins[origin]
		},
	}
	return server
}

func (s *Server) Handler() http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("GET /health", func(writer http.ResponseWriter, _ *http.Request) {
		writer.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(writer).Encode(map[string]string{"status": "ok", "game": "beyblade"})
	})
	mux.HandleFunc("GET /ws", s.serveWebSocket)
	return mux
}

func (s *Server) Shutdown(ctx context.Context) error {
	return s.hub.Shutdown(ctx)
}

func (s *Server) serveWebSocket(writer http.ResponseWriter, request *http.Request) {
	conn, err := s.upgrader.Upgrade(writer, request, nil)
	if err != nil {
		s.logger.Debug("websocket upgrade rejected", "error", err)
		return
	}
	client := newClient(s.hub.newID("c"), s.hub, conn, s.logger)
	if !s.hub.register(client) {
		_ = conn.Close()
		return
	}
	go client.writePump()
	client.readPump()
}

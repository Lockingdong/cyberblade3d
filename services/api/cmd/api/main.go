package main

import (
	"context"
	"errors"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"strings"
	"syscall"
	"time"

	"github.com/game-pool/game-pool/games/beyblade/services/api/internal/matchmaking"
)

func main() {
	logger := slog.New(slog.NewJSONHandler(os.Stdout, nil))
	if err := run(logger); err != nil {
		logger.Error("service stopped", "error", err)
		os.Exit(1)
	}
}

func run(logger *slog.Logger) error {
	service := matchmaking.NewServer(
		matchmaking.DefaultConfig(),
		strings.Split(
			env(
				"ALLOWED_ORIGINS",
				"http://localhost:5173,http://127.0.0.1:5173",
			),
			",",
		),
		logger,
	)
	server := &http.Server{
		Addr:              env("GAME_API_ADDR", ":8787"),
		Handler:           service.Handler(),
		ReadHeaderTimeout: 5 * time.Second,
	}

	ctx, stop := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer stop()
	go func() {
		<-ctx.Done()
		shutdownCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()
		// Close active WebSockets first so their long-lived HTTP handlers can
		// return before http.Server waits for them.
		if err := service.Shutdown(shutdownCtx); err != nil {
			logger.Error("matchmaking shutdown", "error", err)
		}
		if err := server.Shutdown(shutdownCtx); err != nil {
			logger.Error("http shutdown", "error", err)
		}
	}()

	logger.Info("listening", "address", server.Addr)
	err := server.ListenAndServe()
	if errors.Is(err, http.ErrServerClosed) {
		return nil
	}
	return err
}

func env(key, fallback string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return fallback
}

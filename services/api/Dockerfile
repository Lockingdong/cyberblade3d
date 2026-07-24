FROM golang:1.24-alpine AS build

WORKDIR /src

COPY services/api/go.mod services/api/go.sum ./
RUN go mod download

COPY services/api/ ./
RUN CGO_ENABLED=0 GOOS=linux go build \
    -trimpath \
    -ldflags="-s -w" \
    -o /out/cyberblade-api \
    ./cmd/api

FROM scratch

COPY --from=build /out/cyberblade-api /cyberblade-api

USER 65532:65532
EXPOSE 8787

ENTRYPOINT ["/cyberblade-api"]

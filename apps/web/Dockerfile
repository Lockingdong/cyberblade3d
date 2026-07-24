FROM node:24-alpine AS build

RUN corepack enable
WORKDIR /workspace

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/web/package.json apps/web/package.json
COPY packages/config-typescript/package.json packages/config-typescript/package.json
COPY packages/core/package.json packages/core/package.json
COPY packages/game-runtime/package.json packages/game-runtime/package.json
COPY packages/multiplayer/package.json packages/multiplayer/package.json
COPY packages/simulation/package.json packages/simulation/package.json
COPY packages/visuals/package.json packages/visuals/package.json

RUN pnpm install --frozen-lockfile

COPY apps/web apps/web
COPY packages/config-typescript packages/config-typescript
COPY packages/core packages/core
COPY packages/game-runtime packages/game-runtime
COPY packages/multiplayer packages/multiplayer
COPY packages/simulation packages/simulation
COPY packages/visuals packages/visuals

ARG VITE_PUBLIC_WS_URL
ENV VITE_PUBLIC_WS_URL=$VITE_PUBLIC_WS_URL

RUN pnpm -C apps/web build

FROM nginxinc/nginx-unprivileged:1.29-alpine

COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /workspace/apps/web/dist /usr/share/nginx/html

EXPOSE 8080

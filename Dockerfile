# --- Build stage: install deps and produce dist/ (Vite + bundled server) ---
FROM node:20-bookworm-slim AS builder

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

# --- Run stage: production Node (serves static dist + Express API) ---
FROM node:20-bookworm-slim

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

# Production dependencies only (runtime for dist/server.mjs with --packages=external)
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY --from=builder /app/dist ./dist

# Persist SQLite in a volume (see docker-compose.yml)
RUN mkdir -p /app/data

ENV SQLITE_PATH=/app/data/app.db

EXPOSE 3000

CMD ["node", "dist/server.mjs"]

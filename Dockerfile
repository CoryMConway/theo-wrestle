# ── Build stage ────────────────────────────────────────────────────────
FROM node:20-slim AS builder

RUN apt-get update && apt-get install -y python3 make g++ && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# Build client (Vite) and server (TypeScript)
RUN npm run build

# ── Production stage ──────────────────────────────────────────────────
FROM node:20-slim

WORKDIR /app

# better-sqlite3 needs native addon compiled at install
RUN apt-get update && apt-get install -y python3 make g++ && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# Copy built client assets and compiled server
COPY --from=builder /app/dist ./dist

# Create /data directory for persistent SQLite storage (HF volume mount)
RUN mkdir -p /data

EXPOSE 7860

ENV NODE_ENV=production
ENV PORT=7860

CMD ["node", "dist/server/server/index.js"]

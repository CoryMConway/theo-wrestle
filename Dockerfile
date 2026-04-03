# ── Build stage ────────────────────────────────────────────────────────
FROM node:20-slim AS builder

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# Build client (Vite) and server (TypeScript)
RUN npm run build

# ── Production stage ──────────────────────────────────────────────────
FROM node:20-slim

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# Copy built client assets and compiled server
COPY --from=builder /app/dist ./dist

EXPOSE 7860

ENV NODE_ENV=production
ENV PORT=7860

CMD ["node", "dist/server/server/index.js"]

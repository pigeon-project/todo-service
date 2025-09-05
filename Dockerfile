# Build stage
FROM node:20-alpine AS builder
WORKDIR /app
RUN apk add --no-cache python3 make g++

# Server deps
COPY server/package.json ./server/
RUN cd server && npm install --no-audit --no-fund
COPY server ./server
RUN cd server && npm run build

# Frontend deps
COPY frontend/package.json ./frontend/
RUN cd frontend && npm install --no-audit --no-fund
COPY frontend ./frontend
RUN cd frontend && npm run build

# Runtime stage
FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production

# Copy server runtime and install prod deps
COPY --from=builder /app/server/package.json ./server/
RUN cd server && npm install --omit=dev --no-audit --no-fund
COPY --from=builder /app/server/dist ./server/dist

# Copy frontend build
COPY --from=builder /app/frontend/dist ./frontend/dist

ENV PORT=8000
EXPOSE 8000
CMD ["node", "server/dist/index.js"]

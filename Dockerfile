# Multi-stage build: Build React app with Vite, then serve via Nginx on 8000

FROM node:20-alpine AS builder
WORKDIR /app

# Install deps first (better cache). If no lockfile, fall back to install.
COPY package.json ./
RUN npm ci || npm install

# Copy rest and build
COPY . .
RUN npm run build

FROM nginx:alpine AS runner

# Nginx config to listen on 8000 and support SPA routing
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Static files
COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 8000
CMD ["nginx", "-g", "daemon off;"]


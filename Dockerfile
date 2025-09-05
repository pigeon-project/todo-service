## Build stage
FROM node:18-alpine AS builder
WORKDIR /app

# Install deps first for better caching
COPY package.json ./
RUN npm install --no-audit --no-fund

# Copy source and build
COPY . .
RUN npm run build

## Runtime stage
FROM nginx:alpine

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 8000
CMD ["nginx", "-g", "daemon off;"]


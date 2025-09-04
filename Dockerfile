# Simple single-stage Dockerfile to build and serve the React app
# Serves the built app using Vite preview on port 8000

FROM node:18-alpine

WORKDIR /app

# Install dependencies first for better layer caching
COPY package.json ./
# If you have a lockfile locally, uncomment the next line and replace npm install with npm ci
# COPY package-lock.json ./

RUN npm install --no-audit --no-fund

# Copy source
COPY . .

# Build static assets
RUN npm run build

# Expose and serve on 8000
EXPOSE 8000
CMD ["npm", "run", "preview"]


# Simple single-stage build+serve using Vite preview on port 8000
FROM node:20-alpine

WORKDIR /app

# Install deps first (better layer caching)
COPY package.json ./
RUN npm install --no-audit --no-fund

# Copy source and build
COPY . .
RUN npm run build

EXPOSE 8000

CMD ["npm", "run", "preview"]


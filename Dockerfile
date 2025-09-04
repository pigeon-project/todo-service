# Multi-stage build for React app

FROM node:18-alpine AS build
WORKDIR /app

# Install dependencies
COPY package.json .
RUN npm install --no-audit --no-fund

# Copy source and build
COPY . .
RUN npm run build

# Serve the production build on port 8000
FROM node:18-alpine AS runtime
WORKDIR /app
RUN npm i -g serve@14
COPY --from=build /app/dist ./dist
EXPOSE 8000
CMD ["serve", "-s", "dist", "-l", "8000"]


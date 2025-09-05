# Multi-stage build for PigeonToDoApp (React UI)

FROM node:18-alpine AS build
WORKDIR /app

# Install dependencies
COPY package.json ./
RUN npm install --no-audit --no-fund

# Copy source and build
COPY . .
RUN npm run build


FROM node:18-alpine AS runner
WORKDIR /app

# Only need express in runtime
RUN npm install --no-audit --no-fund express@4.19.2

# Copy server and built assets
COPY --from=build /app/server.cjs ./server.cjs
COPY --from=build /app/dist ./dist

ENV NODE_ENV=production
ENV PORT=8000
EXPOSE 8000

CMD ["node", "server.cjs"]


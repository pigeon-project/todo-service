# Simple static React (CDN) app served by a tiny Node server
FROM node:18-alpine

WORKDIR /app

# Copy app files
COPY server.js ./
COPY public ./public

# Expose application port
EXPOSE 8000

# Run the server
CMD ["node", "server.js"]


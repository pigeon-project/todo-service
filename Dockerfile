# Simple Node-based static file server for PigeonToDoApp
FROM node:18-alpine

WORKDIR /app

# Copy app source
COPY . .

# Expose application port
EXPOSE 8000

# Start server
CMD ["node", "server.js"]


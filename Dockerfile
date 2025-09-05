# Simple static server for PigeonToDoApp (React UI)
FROM python:3.11-slim

WORKDIR /app

# Copy static assets
COPY public /app/public

# Expose the application port
EXPOSE 8000

# Serve the UI from /app/public on port 8000
CMD ["python", "-m", "http.server", "8000", "--directory", "/app/public"]


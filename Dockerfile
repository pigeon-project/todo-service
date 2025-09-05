FROM python:3.11-slim

WORKDIR /app

# Copy application code
COPY app ./app

# No external dependencies; use stdlib only

EXPOSE 8000

ENV TODO_DB_PATH=/app/todo.db

CMD ["python", "-m", "app.server"]


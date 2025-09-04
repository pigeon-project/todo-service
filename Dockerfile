FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    TODO_DB_PATH=/data/todo.sqlite3

WORKDIR /app

COPY app /app/app
COPY SPEC.md /app/SPEC.md

# Create data directory for SQLite
RUN mkdir -p /data && chown -R root:root /data

EXPOSE 8000

CMD ["python", "-m", "app.main"]


# Simple Dockerfile for TODO Service (Python, no external deps)
FROM python:3.11-slim

ENV PYTHONUNBUFFERED=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    PORT=8000

WORKDIR /app

COPY app /app/app

EXPOSE 8000

CMD ["python", "-m", "app.main"]


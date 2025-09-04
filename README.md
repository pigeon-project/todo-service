# Todo Service

Simple FastAPI-based Todo service with in-memory storage.

## Run locally

- Install: `pip install -r requirements.txt`
- Start: `uvicorn app.main:app --host 0.0.0.0 --port 8000`
- Health: `GET http://localhost:8000/healthz`

## API

- `GET /todos` — list todos (filter: `?completed=true|false`)
- `POST /todos` — create todo `{title, description?, completed?, due_date?}`
- `GET /todos/{id}` — get by id
- `PATCH /todos/{id}` — partial update of fields above
- `DELETE /todos/{id}` — delete by id
- `DELETE /todos` — delete all

Note: Data is in-memory and resets on restart.

## Docker

- Build: `docker build -t todo-service .`
- Run: `docker run -p 8000:8000 todo-service`

The container exposes port 8000.

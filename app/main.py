from typing import List, Optional
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field
from uuid import UUID, uuid4
from datetime import datetime


class TodoCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=200)
    description: Optional[str] = Field(default=None, max_length=2000)
    completed: bool = False
    due_date: Optional[datetime] = None


class TodoUpdate(BaseModel):
    title: Optional[str] = Field(default=None, min_length=1, max_length=200)
    description: Optional[str] = Field(default=None, max_length=2000)
    completed: Optional[bool] = None
    due_date: Optional[datetime] = None


class Todo(BaseModel):
    id: UUID
    title: str
    description: Optional[str] = None
    completed: bool = False
    created_at: datetime
    updated_at: datetime
    due_date: Optional[datetime] = None


app = FastAPI(title="Todo Service", version="1.0.0")


# In-memory store for demo purposes
_todos: dict[UUID, Todo] = {}


@app.get("/healthz")
def healthz():
    return {"status": "ok"}


@app.get("/todos", response_model=List[Todo])
def list_todos(completed: Optional[bool] = None):
    items = list(_todos.values())
    if completed is not None:
        items = [t for t in items if t.completed == completed]
    # Sort by created_at for predictability
    items.sort(key=lambda t: t.created_at)
    return items


@app.post("/todos", response_model=Todo, status_code=201)
def create_todo(payload: TodoCreate):
    now = datetime.utcnow()
    todo = Todo(
        id=uuid4(),
        title=payload.title,
        description=payload.description,
        completed=payload.completed,
        created_at=now,
        updated_at=now,
        due_date=payload.due_date,
    )
    _todos[todo.id] = todo
    return todo


@app.get("/todos/{todo_id}", response_model=Todo)
def get_todo(todo_id: UUID):
    todo = _todos.get(todo_id)
    if not todo:
        raise HTTPException(status_code=404, detail="Todo not found")
    return todo


@app.patch("/todos/{todo_id}", response_model=Todo)
def update_todo(todo_id: UUID, payload: TodoUpdate):
    existing = _todos.get(todo_id)
    if not existing:
        raise HTTPException(status_code=404, detail="Todo not found")
    data = existing.model_dump()
    update = payload.model_dump(exclude_unset=True)
    data.update({k: v for k, v in update.items() if v is not None or k == "completed"})
    data["updated_at"] = datetime.utcnow()
    updated = Todo(**data)
    _todos[todo_id] = updated
    return updated


@app.delete("/todos/{todo_id}", status_code=204)
def delete_todo(todo_id: UUID):
    if todo_id not in _todos:
        raise HTTPException(status_code=404, detail="Todo not found")
    del _todos[todo_id]
    return


@app.delete("/todos", status_code=204)
def delete_all_todos():
    _todos.clear()
    return


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=False)


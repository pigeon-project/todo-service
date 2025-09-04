import { useState } from 'react'
import TodoForm from './TodoForm.jsx'

function priorityPill(p) {
  if (p === 'high') return <span className="pill red">High</span>
  if (p === 'medium') return <span className="pill orange">Medium</span>
  return <span className="pill green">Low</span>
}

export default function TodoItem({ todo, onToggle, onDelete, onUpdate }) {
  const [editing, setEditing] = useState(false)
  const overdue = todo.due && !todo.completed && new Date(todo.due) < new Date(new Date().toDateString())

  return (
    <div className="card">
      {editing ? (
        <TodoForm
          initial={{ title: todo.title, notes: todo.notes || '', due: todo.due || '', priority: todo.priority || 'medium' }}
          onSubmit={(v) => { onUpdate({ ...todo, ...v }); setEditing(false) }}
          onCancel={() => setEditing(false)}
        />
      ) : (
        <>
          <div className="title-row">
            <input type="checkbox" checked={!!todo.completed} onChange={() => onToggle(todo.id)} aria-label="Mark complete" />
            <div className="grow">
              <div style={{ fontWeight: 600, fontSize: 16 }} className={todo.completed ? 'strike' : ''}>{todo.title}</div>
              {todo.notes && <div className="muted">{todo.notes}</div>}
            </div>
            {priorityPill(todo.priority)}
          </div>
          <div className="toolbar">
            {todo.due && (
              <span className="muted">Due: <span style={{ color: overdue ? 'var(--danger)' : 'var(--muted)' }}>{new Date(todo.due).toLocaleDateString()}</span></span>
            )}
            <span className="spacer" />
            <button className="ghost" onClick={() => setEditing(true)}>Edit</button>
            <button className="danger" onClick={() => onDelete(todo.id)}>Delete</button>
          </div>
        </>
      )}
    </div>
  )
}


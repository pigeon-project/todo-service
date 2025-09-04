import React, { useState } from 'react'

function PriorityBadge({ p }) {
  return <span className={`badge ${p}`}>{p}</span>
}

function TodoItem({ todo, onToggle, onEdit, onDelete }) {
  const [editing, setEditing] = useState(false)
  const [title, setTitle] = useState(todo.title)
  const [description, setDescription] = useState(todo.description || '')
  const [dueDate, setDueDate] = useState(todo.dueDate || '')
  const [priority, setPriority] = useState(todo.priority)

  function save() {
    onEdit(todo.id, { title: title.trim(), description: description.trim(), dueDate: dueDate || null, priority })
    setEditing(false)
  }

  return (
    <li className={`todo ${todo.completed ? 'done' : ''}`}>
      <div className="left">
        <input type="checkbox" checked={!!todo.completed} onChange={e => onToggle(todo.id, e.target.checked)} />
        {!editing ? (
          <div className="content" onDoubleClick={() => setEditing(true)}>
            <div className="title">{todo.title} <PriorityBadge p={todo.priority} /></div>
            {todo.description && <div className="desc">{todo.description}</div>}
            <div className="meta">
              {todo.dueDate && <span>Due: {todo.dueDate}</span>}
            </div>
          </div>
        ) : (
          <div className="edit">
            <input value={title} onChange={e => setTitle(e.target.value)} />
            <textarea rows={2} value={description} onChange={e => setDescription(e.target.value)} />
            <div className="row">
              <select value={priority} onChange={e => setPriority(e.target.value)}>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
              <input type="date" value={dueDate || ''} onChange={e => setDueDate(e.target.value)} />
              <button onClick={save}>Save</button>
              <button className="ghost" onClick={() => setEditing(false)}>Cancel</button>
            </div>
          </div>
        )}
      </div>
      <div className="actions">
        {!editing && <button className="ghost" onClick={() => setEditing(true)}>Edit</button>}
        <button className="danger" onClick={() => onDelete(todo.id)}>Delete</button>
      </div>
    </li>
  )
}

export default function TodoList({ todos, onToggle, onEdit, onDelete }) {
  if (!todos.length) return <div className="empty">No tasks match your filters.</div>
  return (
    <ul className="list">
      {todos.map(t => (
        <TodoItem key={t.id} todo={t} onToggle={onToggle} onEdit={onEdit} onDelete={onDelete} />
      ))}
    </ul>
  )
}


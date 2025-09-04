import React, { useState } from 'react'

export default function TodoForm({ onAdd }) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [priority, setPriority] = useState('medium')

  function submit(e) {
    e.preventDefault()
    if (!title.trim()) return
    onAdd({ title: title.trim(), description: description.trim(), dueDate: dueDate || null, priority, completed: false })
    setTitle('')
    setDescription('')
    setDueDate('')
    setPriority('medium')
  }

  return (
    <form className="card" onSubmit={submit}>
      <div className="row">
        <input
          placeholder="Add a new task..."
          value={title}
          onChange={e => setTitle(e.target.value)}
        />
        <select value={priority} onChange={e => setPriority(e.target.value)}>
          <option value="low">Low</option>
          <option value="medium">Medium</option>
          <option value="high">High</option>
        </select>
        <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} />
        <button type="submit">Add</button>
      </div>
      <textarea
        placeholder="Description (optional)"
        value={description}
        onChange={e => setDescription(e.target.value)}
        rows={2}
      />
    </form>
  )
}


import React, { useEffect, useMemo, useState } from 'react'

const PRIORITIES = ['Low', 'Medium', 'High']

function uid() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36)
}

function useLocalStorage(key, initial) {
  const [state, setState] = useState(() => {
    try {
      const raw = localStorage.getItem(key)
      return raw ? JSON.parse(raw) : initial
    } catch {
      return initial
    }
  })
  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(state))
    } catch {}
  }, [key, state])
  return [state, setState]
}

export default function App() {
  const [tasks, setTasks] = useLocalStorage('pigeon-todos', [])
  const [theme, setTheme] = useLocalStorage('pigeon-theme', 'light')
  const [filter, setFilter] = useState({ q: '', status: 'all', priority: 'all' })

  useEffect(() => {
    document.documentElement.dataset.theme = theme
  }, [theme])

  const filtered = useMemo(() => {
    return tasks
      .filter(t => {
        if (filter.status === 'open' && t.completed) return false
        if (filter.status === 'done' && !t.completed) return false
        if (filter.priority !== 'all' && t.priority !== filter.priority) return false
        if (filter.q && !(`${t.title} ${t.description || ''}`.toLowerCase().includes(filter.q.toLowerCase()))) return false
        return true
      })
      .sort((a, b) => {
        // Uncompleted first, then by priority, then nearest due date, then recent first
        if (a.completed !== b.completed) return a.completed ? 1 : -1
        const p = PRIORITIES.indexOf(b.priority) - PRIORITIES.indexOf(a.priority)
        if (p !== 0) return p
        const ad = a.dueDate ? new Date(a.dueDate).getTime() : Infinity
        const bd = b.dueDate ? new Date(b.dueDate).getTime() : Infinity
        if (ad !== bd) return ad - bd
        return (b.updatedAt || 0) - (a.updatedAt || 0)
      })
  }, [tasks, filter])

  function upsertTask(partial, id) {
    setTasks(prev => {
      if (id) {
        return prev.map(t => (t.id === id ? { ...t, ...partial, updatedAt: Date.now() } : t))
      }
      const next = {
        id: uid(),
        title: '',
        description: '',
        priority: 'Medium',
        dueDate: '',
        completed: false,
        ...partial,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }
      return [next, ...prev]
    })
  }

  function removeTask(id) {
    setTasks(prev => prev.filter(t => t.id !== id))
  }

  function toggleComplete(id) {
    setTasks(prev => prev.map(t => (t.id === id ? { ...t, completed: !t.completed, updatedAt: Date.now() } : t)))
  }

  function clearCompleted() {
    setTasks(prev => prev.filter(t => !t.completed))
  }

  return (
    <div className="container">
      <header className="header">
        <h1>PigeonToDoApp</h1>
        <div className="header-actions">
          <button className="secondary" onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}>
            {theme === 'light' ? 'Dark Mode' : 'Light Mode'}
          </button>
          <button className="primary" onClick={() => upsertTask({ title: 'New task' })}>New Task</button>
        </div>
      </header>

      <section className="panel">
        <input
          placeholder="Search tasks..."
          value={filter.q}
          onChange={(e) => setFilter(f => ({ ...f, q: e.target.value }))}
        />
        <select value={filter.status} onChange={(e) => setFilter(f => ({ ...f, status: e.target.value }))}>
          <option value="all">All</option>
          <option value="open">Open</option>
          <option value="done">Completed</option>
        </select>
        <select value={filter.priority} onChange={(e) => setFilter(f => ({ ...f, priority: e.target.value }))}>
          <option value="all">Any priority</option>
          {PRIORITIES.map(p => (
            <option key={p} value={p}>{p}</option>
          ))}
        </select>
        <button className="danger" onClick={clearCompleted}>Clear Completed</button>
      </section>

      <TaskComposer onAdd={upsertTask} />

      <ul className="list">
        {filtered.length === 0 && <div className="empty">No tasks match your filters.</div>}
        {filtered.map(task => (
          <TaskItem
            key={task.id}
            task={task}
            onToggle={() => toggleComplete(task.id)}
            onDelete={() => removeTask(task.id)}
            onSave={(patch) => upsertTask(patch, task.id)}
          />
        ))}
      </ul>

      <footer className="footer">
        <span>{tasks.filter(t => !t.completed).length} open</span>
        <span>{tasks.filter(t => t.completed).length} done</span>
        <span>Total {tasks.length}</span>
      </footer>
    </div>
  )
}

function TaskComposer({ onAdd }) {
  const [title, setTitle] = useState('')
  const [priority, setPriority] = useState('Medium')
  const [dueDate, setDueDate] = useState('')
  const [description, setDescription] = useState('')

  function submit(e) {
    e.preventDefault()
    if (!title.trim()) return
    onAdd({ title: title.trim(), priority, dueDate, description })
    setTitle(''); setPriority('Medium'); setDueDate(''); setDescription('')
  }

  return (
    <form className="composer" onSubmit={submit}>
      <input
        placeholder="Task title"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
      />
      <select value={priority} onChange={(e) => setPriority(e.target.value)}>
        {PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}
      </select>
      <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
      <input
        placeholder="Description (optional)"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
      />
      <button className="primary" type="submit">Add</button>
    </form>
  )
}

function TaskItem({ task, onToggle, onDelete, onSave }) {
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState(task)

  useEffect(() => setForm(task), [task.id])

  function submit(e) {
    e.preventDefault()
    onSave({ title: form.title.trim() || 'Untitled', description: form.description, priority: form.priority, dueDate: form.dueDate })
    setEditing(false)
  }

  return (
    <li className={`item ${task.completed ? 'completed' : ''}`}>
      <div className="status">
        <input type="checkbox" checked={task.completed} onChange={onToggle} />
      </div>
      {editing ? (
        <form className="editor" onSubmit={submit}>
          <input value={form.title} onChange={(e) => setForm(f => ({ ...f, title: e.target.value }))} />
          <select value={form.priority} onChange={(e) => setForm(f => ({ ...f, priority: e.target.value }))}>
            {PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
          <input type="date" value={form.dueDate || ''} onChange={(e) => setForm(f => ({ ...f, dueDate: e.target.value }))} />
          <input placeholder="Description" value={form.description || ''} onChange={(e) => setForm(f => ({ ...f, description: e.target.value }))} />
          <div className="item-actions">
            <button className="primary" type="submit">Save</button>
            <button type="button" onClick={() => setEditing(false)}>Cancel</button>
          </div>
        </form>
      ) : (
        <div className="content">
          <div className="title">
            <span className={`priority ${task.priority.toLowerCase()}`}>{task.priority}</span>
            {task.title}
          </div>
          {(task.description || task.dueDate) && (
            <div className="meta">
              {task.dueDate && <span>Due {new Date(task.dueDate).toLocaleDateString()}</span>}
              {task.description && <span>{task.description}</span>}
            </div>
          )}
          <div className="item-actions">
            <button onClick={() => setEditing(true)}>Edit</button>
            <button className="danger" onClick={onDelete}>Delete</button>
          </div>
        </div>
      )}
    </li>
  )
}


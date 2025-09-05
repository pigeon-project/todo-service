import React, { useEffect, useMemo, useState } from 'react'

const defaultTheme = (() => {
  if (typeof window === 'undefined') return 'light'
  return localStorage.getItem('theme') || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
})()

function useLocalStorage(key, initial) {
  const [value, setValue] = useState(() => {
    try {
      const raw = localStorage.getItem(key)
      return raw ? JSON.parse(raw) : initial
    } catch {
      return initial
    }
  })
  useEffect(() => {
    localStorage.setItem(key, JSON.stringify(value))
  }, [key, value])
  return [value, setValue]
}

const priorities = ['Low', 'Medium', 'High']

export default function App() {
  const [theme, setTheme] = useLocalStorage('theme', defaultTheme)
  const [tasks, setTasks] = useLocalStorage('tasks', [])
  const [filter, setFilter] = useState('all')
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState('priority')

  useEffect(() => {
    document.documentElement.dataset.theme = theme
  }, [theme])

  function addTask(e) {
    e.preventDefault()
    const form = e.target
    const title = form.title.value.trim()
    if (!title) return
    const task = {
      id: crypto.randomUUID(),
      title,
      notes: form.notes.value.trim(),
      due: form.due.value || null,
      priority: form.priority.value,
      done: false,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }
    setTasks([task, ...tasks])
    form.reset()
    form.title.focus()
  }

  function toggleDone(id) {
    setTasks(tasks.map(t => t.id === id ? { ...t, done: !t.done, updatedAt: Date.now() } : t))
  }

  function removeTask(id) {
    setTasks(tasks.filter(t => t.id !== id))
  }

  function updateTask(id, patch) {
    setTasks(tasks.map(t => t.id === id ? { ...t, ...patch, updatedAt: Date.now() } : t))
  }

  const filtered = useMemo(() => {
    let out = [...tasks]
    if (filter === 'active') out = out.filter(t => !t.done)
    if (filter === 'completed') out = out.filter(t => t.done)
    if (query) {
      const q = query.toLowerCase()
      out = out.filter(t => t.title.toLowerCase().includes(q) || t.notes.toLowerCase().includes(q))
    }
    const byPriority = { High: 3, Medium: 2, Low: 1 }
    out.sort((a, b) => {
      if (sort === 'priority') return (byPriority[b.priority] - byPriority[a.priority])
      if (sort === 'due') return (new Date(a.due || '9999-12-31') - new Date(b.due || '9999-12-31'))
      return b.updatedAt - a.updatedAt
    })
    return out
  }, [tasks, filter, query, sort])

  function exportData() {
    const blob = new Blob([JSON.stringify({ tasks }, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'pigeontodo-export.json'
    a.click()
    URL.revokeObjectURL(url)
  }

  function importData(e) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result)
        if (Array.isArray(data.tasks)) setTasks(data.tasks)
      } catch {}
    }
    reader.readAsText(file)
    e.target.value = ''
  }

  return (
    <div className="container">
      <header className="header">
        <h1>🐦 PigeonToDoApp</h1>
        <p className="tagline">Stay Organized. Get Things Done.</p>
        <div className="header-actions">
          <button className="btn" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>
            {theme === 'dark' ? 'Light Mode' : 'Dark Mode'}
          </button>
          <button className="btn" onClick={exportData}>Export</button>
          <label className="btn file-btn">
            Import
            <input type="file" accept="application/json" onChange={importData} hidden />
          </label>
        </div>
      </header>

      <section className="panel">
        <form className="add-form" onSubmit={addTask}>
          <input name="title" placeholder="Add a task..." aria-label="Task title" />
          <input name="notes" placeholder="Notes (optional)" aria-label="Task notes" />
          <input name="due" type="date" aria-label="Due date" />
          <select name="priority" defaultValue="Medium" aria-label="Priority">
            {priorities.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
          <button className="btn primary" type="submit">Add</button>
        </form>

        <div className="toolbar">
          <div className="filters">
            <select value={filter} onChange={e => setFilter(e.target.value)} aria-label="Filter">
              <option value="all">All</option>
              <option value="active">Active</option>
              <option value="completed">Completed</option>
            </select>
            <select value={sort} onChange={e => setSort(e.target.value)} aria-label="Sort">
              <option value="priority">Sort by Priority</option>
              <option value="due">Sort by Due</option>
              <option value="updated">Sort by Updated</option>
            </select>
          </div>
          <input className="search" placeholder="Search tasks" value={query} onChange={e => setQuery(e.target.value)} />
        </div>
      </section>

      <section className="list">
        {filtered.length === 0 && (
          <p className="empty">No tasks yet. Add your first task above.</p>
        )}
        {filtered.map(t => (
          <article key={t.id} className={`item ${t.done ? 'done' : ''}`}>
            <div className="left">
              <input type="checkbox" checked={t.done} onChange={() => toggleDone(t.id)} />
            </div>
            <div className="content">
              <input
                className="title"
                value={t.title}
                onChange={e => updateTask(t.id, { title: e.target.value })}
              />
              <textarea
                className="notes"
                value={t.notes}
                placeholder="Notes"
                onChange={e => updateTask(t.id, { notes: e.target.value })}
              />
              <div className="meta">
                <select value={t.priority} onChange={e => updateTask(t.id, { priority: e.target.value })}>
                  {priorities.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
                <input type="date" value={t.due || ''} onChange={e => updateTask(t.id, { due: e.target.value || null })} />
                {t.due && <span className="due">Due {new Date(t.due).toLocaleDateString()}</span>}
              </div>
            </div>
            <div className="right">
              <button className="icon danger" onClick={() => removeTask(t.id)} aria-label="Delete">✕</button>
            </div>
          </article>
        ))}
      </section>

      <footer className="footer">
        <p>
          Smart prioritization, clean design, and themes. For collaboration and cross-device sync, use Export/Import for now.
        </p>
      </footer>
    </div>
  )
}


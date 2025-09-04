import React, { useEffect, useMemo, useState } from 'react'
import TodoForm from './components/TodoForm.jsx'
import TodoList from './components/TodoList.jsx'

const STORAGE_KEY = 'pigeon_todos_v1'
const THEME_KEY = 'pigeon_theme'

export default function App() {
  const [todos, setTodos] = useState(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      return raw ? JSON.parse(raw) : []
    } catch {
      return []
    }
  })

  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState('all') // all | active | completed
  const [priority, setPriority] = useState('all') // all | low | medium | high
  const [theme, setTheme] = useState(() => localStorage.getItem(THEME_KEY) || 'system')

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(todos))
  }, [todos])

  useEffect(() => {
    localStorage.setItem(THEME_KEY, theme)
    const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches
    const dark = theme === 'dark' || (theme === 'system' && prefersDark)
    document.documentElement.dataset.theme = dark ? 'dark' : 'light'
  }, [theme])

  const filtered = useMemo(() => {
    return todos.filter(t => {
      if (filter === 'active' && t.completed) return false
      if (filter === 'completed' && !t.completed) return false
      if (priority !== 'all' && t.priority !== priority) return false
      if (query && !(`${t.title} ${t.description || ''}`.toLowerCase().includes(query.toLowerCase()))) return false
      return true
    })
  }, [todos, filter, priority, query])

  function addTodo(item) {
    const now = Date.now()
    setTodos(prev => [{ id: crypto.randomUUID(), createdAt: now, updatedAt: now, ...item }, ...prev])
  }

  function updateTodo(id, patch) {
    const now = Date.now()
    setTodos(prev => prev.map(t => t.id === id ? { ...t, ...patch, updatedAt: now } : t))
  }

  function deleteTodo(id) {
    setTodos(prev => prev.filter(t => t.id !== id))
  }

  function clearCompleted() {
    setTodos(prev => prev.filter(t => !t.completed))
  }

  function exportJson() {
    const blob = new Blob([JSON.stringify(todos, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'pigeon-todos.json'
    a.click()
    URL.revokeObjectURL(url)
  }

  function importJson(e) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      try {
        const parsed = JSON.parse(reader.result)
        if (Array.isArray(parsed)) setTodos(parsed)
      } catch {}
    }
    reader.readAsText(file)
    e.target.value = ''
  }

  return (
    <div className="container">
      <header className="header">
        <h1>🐦 PigeonToDoApp</h1>
        <div className="theme">
          <label>
            Theme
            <select value={theme} onChange={e => setTheme(e.target.value)}>
              <option value="system">System</option>
              <option value="light">Light</option>
              <option value="dark">Dark</option>
            </select>
          </label>
        </div>
      </header>

      <TodoForm onAdd={addTodo} />

      <section className="toolbar">
        <input
          placeholder="Search tasks..."
          value={query}
          onChange={e => setQuery(e.target.value)}
        />
        <label>
          Status
          <select value={filter} onChange={e => setFilter(e.target.value)}>
            <option value="all">All</option>
            <option value="active">Active</option>
            <option value="completed">Completed</option>
          </select>
        </label>
        <label>
          Priority
          <select value={priority} onChange={e => setPriority(e.target.value)}>
            <option value="all">All</option>
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
          </select>
        </label>
        <button className="ghost" onClick={clearCompleted}>Clear completed</button>
        <button className="ghost" onClick={exportJson}>Export</button>
        <label className="import">
          Import
          <input type="file" accept="application/json" onChange={importJson} />
        </label>
      </section>

      <TodoList
        todos={filtered}
        onToggle={(id, completed) => updateTodo(id, { completed })}
        onEdit={(id, patch) => updateTodo(id, patch)}
        onDelete={deleteTodo}
      />

      <footer className="footer">Stay Organized. Get Things Done.</footer>
    </div>
  )
}


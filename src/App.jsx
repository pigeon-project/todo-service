import { useMemo } from 'react'
import { useLocalStorage } from './hooks/useLocalStorage.js'
import TodoForm from './components/TodoForm.jsx'
import TodoList from './components/TodoList.jsx'

function uid() { return Math.random().toString(36).slice(2, 9) }

export default function App() {
  const [todos, setTodos] = useLocalStorage('pigeon.todos', [])
  const [filters, setFilters] = useLocalStorage('pigeon.filters', { q: '', status: 'all', priority: 'all' })
  const [dark, setDark] = useLocalStorage('pigeon.dark', true)

  const add = (t) => setTodos(prev => [{ id: uid(), title: t.title, notes: t.notes, due: t.due || '', priority: t.priority || 'medium', completed: false, createdAt: Date.now() }, ...prev])
  const toggle = (id) => setTodos(prev => prev.map(t => t.id === id ? { ...t, completed: !t.completed } : t))
  const remove = (id) => setTodos(prev => prev.filter(t => t.id !== id))
  const update = (next) => setTodos(prev => prev.map(t => t.id === next.id ? next : t))

  const visible = useMemo(() => {
    const q = filters.q.trim().toLowerCase()
    let items = todos
    if (q) items = items.filter(t => t.title.toLowerCase().includes(q) || (t.notes || '').toLowerCase().includes(q))
    if (filters.status !== 'all') items = items.filter(t => filters.status === 'open' ? !t.completed : t.completed)
    if (filters.priority !== 'all') items = items.filter(t => t.priority === filters.priority)
    const order = { high: 0, medium: 1, low: 2 }
    items = [...items].sort((a, b) => {
      const byDone = Number(a.completed) - Number(b.completed)
      if (byDone !== 0) return byDone
      const byPriority = order[a.priority] - order[b.priority]
      if (byPriority !== 0) return byPriority
      const aDue = a.due ? new Date(a.due).getTime() : Infinity
      const bDue = b.due ? new Date(b.due).getTime() : Infinity
      if (aDue !== bDue) return aDue - bDue
      return b.createdAt - a.createdAt
    })
    return items
  }, [todos, filters])

  return (
    <div className="container" data-theme={dark ? 'dark' : 'light'}>
      <header className="header" style={{ marginBottom: 16 }}>
        <div className="title">
          <span role="img" aria-label="logo">🕊️</span>
          <strong>PigeonToDoApp</strong>
        </div>
        <label className="switch">
          <input type="checkbox" checked={dark} onChange={e => setDark(e.target.checked)} />
          <span className="muted">Dark mode</span>
        </label>
      </header>

      <TodoForm onSubmit={add} />

      <div className="panel" style={{ marginTop: 12 }}>
        <div className="toolbar">
          <input placeholder="Search" value={filters.q} onChange={e => setFilters({ ...filters, q: e.target.value })} className="grow" />
          <select value={filters.status} onChange={e => setFilters({ ...filters, status: e.target.value })}>
            <option value="all">All</option>
            <option value="open">Open</option>
            <option value="done">Completed</option>
          </select>
          <select value={filters.priority} onChange={e => setFilters({ ...filters, priority: e.target.value })}>
            <option value="all">Any priority</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
          <span className="spacer" />
          <button className="ghost" onClick={() => setTodos(t => t.filter(x => !x.completed))}>Clear completed</button>
        </div>
      </div>

      <div style={{ marginTop: 12 }}>
        <TodoList items={visible} onToggle={toggle} onDelete={remove} onUpdate={update} />
      </div>

      <footer className="muted" style={{ marginTop: 24, textAlign: 'center' }}>
        Stay organized. Get things done.
      </footer>
    </div>
  )
}


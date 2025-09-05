import React, { useEffect, useMemo, useState } from 'react'

const PRIORITIES = ['low', 'medium', 'high']

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
    try { localStorage.setItem(key, JSON.stringify(value)) } catch {}
  }, [key, value])
  return [value, setValue]
}

function Toolbar({ theme, setTheme, filter, setFilter, sortBy, setSortBy }) {
  return (
    <div className="toolbar">
      <div className="group">
        <label>Theme</label>
        <select value={theme} onChange={e => setTheme(e.target.value)}>
          <option value="light">Light</option>
          <option value="dark">Dark</option>
          <option value="evergreen">Evergreen</option>
        </select>
      </div>
      <div className="group">
        <label>Filter</label>
        <select value={filter} onChange={e => setFilter(e.target.value)}>
          <option value="all">All</option>
          <option value="open">Open</option>
          <option value="done">Completed</option>
          <option value="overdue">Overdue</option>
          <option value="high">High Priority</option>
        </select>
      </div>
      <div className="group">
        <label>Sort</label>
        <select value={sortBy} onChange={e => setSortBy(e.target.value)}>
          <option value="created">Created</option>
          <option value="due">Due Date</option>
          <option value="priority">Priority</option>
        </select>
      </div>
    </div>
  )
}

function NewTodo({ onAdd }) {
  const [title, setTitle] = useState('')
  const [due, setDue] = useState('')
  const [priority, setPriority] = useState('medium')

  function submit(e) {
    e.preventDefault()
    if (!title.trim()) return
    onAdd({ title: title.trim(), due: due || null, priority, done: false })
    setTitle(''); setDue(''); setPriority('medium')
  }

  return (
    <form className="new-todo" onSubmit={submit}>
      <input
        placeholder="Add a task..."
        value={title}
        onChange={e => setTitle(e.target.value)}
      />
      <input type="date" value={due} onChange={e => setDue(e.target.value)} />
      <select value={priority} onChange={e => setPriority(e.target.value)}>
        {PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}
      </select>
      <button type="submit">Add</button>
    </form>
  )
}

function TodoItem({ todo, onToggle, onUpdate, onDelete }) {
  const [editing, setEditing] = useState(false)
  const [title, setTitle] = useState(todo.title)
  const [due, setDue] = useState(todo.due || '')
  const [priority, setPriority] = useState(todo.priority)

  useEffect(() => { setTitle(todo.title); setDue(todo.due || ''); setPriority(todo.priority) }, [todo])

  const overdue = !todo.done && todo.due && new Date(todo.due) < new Date(new Date().toDateString())

  function save() {
    onUpdate({ ...todo, title: title.trim() || todo.title, due: due || null, priority })
    setEditing(false)
  }

  return (
    <div className={"todo " + (todo.done ? 'done ' : '') + (overdue ? 'overdue ' : '') + `p-${priority}`}>
      <input type="checkbox" checked={todo.done} onChange={() => onToggle(todo.id)} />
      {editing ? (
        <>
          <input className="title-input" value={title} onChange={e => setTitle(e.target.value)} />
          <input type="date" value={due} onChange={e => setDue(e.target.value)} />
          <select value={priority} onChange={e => setPriority(e.target.value)}>
            {PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
          <button onClick={save}>Save</button>
          <button className="ghost" onClick={() => setEditing(false)}>Cancel</button>
        </>
      ) : (
        <>
          <div className="title" onDoubleClick={() => setEditing(true)}>
            {todo.title}
            {todo.due && <span className="chip">Due {todo.due}</span>}
            <span className={`chip pri-${todo.priority}`}>{todo.priority}</span>
          </div>
          <div className="actions">
            <button onClick={() => setEditing(true)}>Edit</button>
            <button className="danger" onClick={() => onDelete(todo.id)}>Delete</button>
          </div>
        </>
      )}
    </div>
  )
}

function ImportExport({ todos, setTodos }) {
  const [open, setOpen] = useState(false)
  const data = useMemo(() => JSON.stringify(todos, null, 2), [todos])
  const [text, setText] = useState('')

  function doImport() {
    try {
      const parsed = JSON.parse(text)
      if (!Array.isArray(parsed)) throw new Error('Invalid format')
      setTodos(parsed)
      setText('')
      alert('Imported tasks!')
    } catch (e) {
      alert('Import failed: ' + e.message)
    }
  }

  return (
    <div className="importexport">
      <button className="ghost" onClick={() => setOpen(!open)}>{open ? 'Close' : 'Share / Import'}</button>
      {open && (
        <div className="panel">
          <div>
            <label>Export (copy JSON)</label>
            <textarea readOnly value={data} onFocus={e => e.target.select()} />
          </div>
          <div>
            <label>Import (paste JSON)</label>
            <textarea placeholder="Paste tasks JSON here..." value={text} onChange={e => setText(e.target.value)} />
            <button onClick={doImport}>Import</button>
          </div>
        </div>
      )}
    </div>
  )
}

export default function App() {
  const [todos, setTodos] = useLocalStorage('pigeon.todos', [])
  const [theme, setTheme] = useLocalStorage('pigeon.theme', 'light')
  const [filter, setFilter] = useLocalStorage('pigeon.filter', 'all')
  const [sortBy, setSortBy] = useLocalStorage('pigeon.sort', 'created')

  useEffect(() => { document.documentElement.dataset.theme = theme }, [theme])

  function addTodo(t) {
    const id = crypto.randomUUID()
    const created = new Date().toISOString()
    setTodos([{ id, created, ...t }, ...todos])
  }

  function toggle(id) { setTodos(todos.map(t => t.id === id ? { ...t, done: !t.done } : t)) }
  function update(t) { setTodos(todos.map(x => x.id === t.id ? t : x)) }
  function remove(id) { setTodos(todos.filter(t => t.id !== id)) }
  function clearDone() { setTodos(todos.filter(t => !t.done)) }

  const now = new Date(new Date().toDateString())

  const shown = useMemo(() => {
    let list = [...todos]
    if (filter === 'open') list = list.filter(t => !t.done)
    if (filter === 'done') list = list.filter(t => t.done)
    if (filter === 'overdue') list = list.filter(t => !t.done && t.due && new Date(t.due) < now)
    if (filter === 'high') list = list.filter(t => t.priority === 'high')

    const priRank = { low: 1, medium: 2, high: 3 }
    list.sort((a, b) => {
      if (sortBy === 'created') return (b.created || '').localeCompare(a.created || '')
      if (sortBy === 'due') return (a.due || '9999').localeCompare(b.due || '9999')
      if (sortBy === 'priority') return (priRank[b.priority] - priRank[a.priority])
      return 0
    })
    return list
  }, [todos, filter, sortBy])

  const openCount = todos.filter(t => !t.done).length

  return (
    <div className="container">
      <header>
        <h1>PigeonToDoApp</h1>
        <p className="tagline">Stay Organized. Get Things Done.</p>
      </header>

      <Toolbar theme={theme} setTheme={setTheme} filter={filter} setFilter={setFilter} sortBy={sortBy} setSortBy={setSortBy} />

      <NewTodo onAdd={addTodo} />

      <div className="list">
        {shown.length === 0 && (
          <div className="empty">No tasks yet. Add one above.</div>
        )}
        {shown.map(todo => (
          <TodoItem key={todo.id} todo={todo} onToggle={toggle} onUpdate={update} onDelete={remove} />)
        )}
      </div>

      <footer>
        <div>{openCount} open</div>
        <div className="spacer" />
        <button className="ghost" onClick={clearDone}>Clear completed</button>
        <ImportExport todos={todos} setTodos={setTodos} />
      </footer>
    </div>
  )
}


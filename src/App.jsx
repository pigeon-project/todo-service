import React, { useEffect, useMemo, useState } from 'react'

const STORAGE_KEY = 'pigeon-todo-tasks'
const THEME_KEY = 'pigeon-todo-theme'

const priorities = ['low', 'medium', 'high']

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
    try { localStorage.setItem(key, JSON.stringify(state)) } catch {}
  }, [key, state])
  return [state, setState]
}

function uuid() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36)
}

function isSoon(dateStr) {
  if (!dateStr) return false
  const due = new Date(dateStr).getTime()
  const now = Date.now()
  const day = 24 * 60 * 60 * 1000
  return due >= now && due - now <= day
}

function isOverdue(dateStr, completed) {
  if (!dateStr || completed) return false
  const due = new Date(dateStr).getTime()
  return due < Date.now()
}

function Header({ theme, setTheme, tasks, setTasks, filters, setFilters }) {

  const exportData = () => {
    const data = JSON.stringify(tasks)
    const blob = new Blob([data], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'pigeon-todos.json'
    a.click()
    URL.revokeObjectURL(url)
  }

  const importData = (file) => {
    const reader = new FileReader()
    reader.onload = () => {
      try {
        const arr = JSON.parse(reader.result)
        if (Array.isArray(arr)) setTasks(arr)
      } catch {}
    }
    reader.readAsText(file)
  }

  const shareLink = () => {
    const data = btoa(unescape(encodeURIComponent(JSON.stringify(tasks))))
    const url = `${location.origin}${location.pathname}#data=${data}`
    navigator.clipboard?.writeText(url)
    alert('Shareable link copied to clipboard!')
  }

  return (
    <div className="toolbar">
      <div className="left">
        <h1 className="title">PigeonToDoApp</h1>
        <span className="muted">Stay Organized. Get Things Done.</span>
      </div>
      <div className="right">
        <select aria-label="Theme" value={theme} onChange={e => setTheme(e.target.value)}>
          <option value="dark">Dark</option>
          <option value="light">Light</option>
        </select>
        <button className="ghost" onClick={exportData}>Export</button>
        <label className="ghost" style={{display:'inline-flex', alignItems: 'center', gap: 8, cursor:'pointer'}}>
          Import
          <input type="file" accept="application/json" style={{display:'none'}} onChange={e => e.target.files[0] && importData(e.target.files[0])} />
        </label>
        <button className="ghost" onClick={shareLink}>Share</button>
      </div>
      <div className="row" style={{width:'100%'}}>
        <input placeholder="Search tasks..." value={filters.q} onChange={e=>setFilters(v=>({ ...v, q: e.target.value }))} />
        <select value={filters.prio} onChange={e=>setFilters(v=>({ ...v, prio: e.target.value }))}>
          <option value="all">All priorities</option>
          {priorities.map(p => <option key={p} value={p}>{p}</option>)}
        </select>
        <select value={filters.status} onChange={e=>setFilters(v=>({ ...v, status: e.target.value }))}>
          <option value="all">All status</option>
          <option value="open">Open</option>
          <option value="done">Completed</option>
        </select>
      </div>
    </div>
  )
}

const FiltersContext = React.createContext({ q: '', prio: 'all', status: 'all' })

function TaskForm({ onAdd }) {
  const [title, setTitle] = useState('')
  const [desc, setDesc] = useState('')
  const [due, setDue] = useState('')
  const [prio, setPrio] = useState('medium')

  const submit = (e) => {
    e.preventDefault()
    if (!title.trim()) return
    onAdd({ id: uuid(), title: title.trim(), description: desc.trim(), dueDate: due, priority: prio, completed: false, createdAt: Date.now() })
    setTitle(''); setDesc(''); setDue(''); setPrio('medium')
  }

  return (
    <form onSubmit={submit} className="card col" aria-label="Add task">
      <div className="row">
        <input placeholder="Task title" value={title} onChange={e=>setTitle(e.target.value)} required />
        <select value={prio} onChange={e=>setPrio(e.target.value)}>
          {priorities.map(p => <option key={p} value={p}>{p}</option>)}
        </select>
        <input type="date" value={due} onChange={e=>setDue(e.target.value)} />
        <button className="primary" type="submit">Add</button>
      </div>
      <textarea placeholder="Description (optional)" value={desc} onChange={e=>setDesc(e.target.value)} />
    </form>
  )
}

function TaskList({ tasks, setTasks }) {
  const filters = React.useContext(FiltersContext)

  const filtered = useMemo(() => {
    let list = [...tasks]
    if (filters.q) {
      const q = filters.q.toLowerCase()
      list = list.filter(t => (t.title + ' ' + (t.description||'')).toLowerCase().includes(q))
    }
    if (filters.prio !== 'all') list = list.filter(t => t.priority === filters.prio)
    if (filters.status !== 'all') list = list.filter(t => filters.status === 'done' ? t.completed : !t.completed)
    list.sort((a,b) => {
      const ad = a.dueDate ? new Date(a.dueDate).getTime() : Infinity
      const bd = b.dueDate ? new Date(b.dueDate).getTime() : Infinity
      if (ad !== bd) return ad - bd
      const pr = { high: 0, medium: 1, low: 2 }
      if (pr[a.priority] !== pr[b.priority]) return pr[a.priority] - pr[b.priority]
      return b.createdAt - a.createdAt
    })
    return list
  }, [tasks, filters])

  const toggle = (id) => setTasks(tasks.map(t => t.id === id ? { ...t, completed: !t.completed } : t))
  const remove = (id) => setTasks(tasks.filter(t => t.id !== id))
  const update = (id, patch) => setTasks(tasks.map(t => t.id === id ? { ...t, ...patch } : t))

  if (!filtered.length) return <div className="muted">No tasks match your filters.</div>

  return (
    <div className="list">
      {filtered.map(t => <TaskItem key={t.id} task={t} onToggle={()=>toggle(t.id)} onRemove={()=>remove(t.id)} onUpdate={patch=>update(t.id, patch)} />)}
    </div>
  )
}

function TaskItem({ task, onToggle, onRemove, onUpdate }) {
  const [editing, setEditing] = useState(false)
  const [title, setTitle] = useState(task.title)
  const [desc, setDesc] = useState(task.description || '')
  const [due, setDue] = useState(task.dueDate || '')
  const [prio, setPrio] = useState(task.priority)

  useEffect(() => { setTitle(task.title); setDesc(task.description||''); setDue(task.dueDate||''); setPrio(task.priority) }, [task])

  const save = () => { onUpdate({ title: title.trim(), description: desc.trim(), dueDate: due, priority: prio }); setEditing(false) }

  const badge = task.completed ? 'done' : isOverdue(task.dueDate, task.completed) ? 'overdue' : isSoon(task.dueDate) ? 'soon' : ''
  const badgeText = task.completed ? 'Done' : isOverdue(task.dueDate, task.completed) ? 'Overdue' : isSoon(task.dueDate) ? 'Soon' : ''

  return (
    <div className={"item card " + (task.completed ? 'completed' : '')}>
      <input type="checkbox" checked={task.completed} onChange={onToggle} aria-label="Toggle complete" />
      <div className="grow">
        {!editing ? (
          <>
            <div className="row" style={{justifyContent:'space-between'}}>
              <div className="title">{task.title}</div>
              <div className="meta">
                {badge && <span className={`badge ${badge}`}>{badgeText}</span>}
                {task.priority && <span className="badge" title="Priority">{task.priority}</span>}
                {task.dueDate && <span className="badge" title="Due date">{new Date(task.dueDate + 'T00:00:00').toLocaleDateString()}</span>}
              </div>
            </div>
            {task.description && <div className="muted" style={{marginTop: 6}}>{task.description}</div>}
          </>
        ) : (
          <div className="col" style={{width: '100%'}}>
            <input value={title} onChange={e=>setTitle(e.target.value)} />
            <textarea value={desc} onChange={e=>setDesc(e.target.value)} />
            <div className="row">
              <select value={prio} onChange={e=>setPrio(e.target.value)}>
                {priorities.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
              <input type="date" value={due} onChange={e=>setDue(e.target.value)} />
              <div className="spacer" />
              <button className="primary" onClick={save}>Save</button>
              <button className="ghost" onClick={()=>setEditing(false)}>Cancel</button>
            </div>
          </div>
        )}
      </div>
      {!editing && (
        <div className="actions">
          <button className="ghost" onClick={()=>setEditing(true)}>Edit</button>
          <button className="danger" onClick={onRemove}>Delete</button>
        </div>
      )}
    </div>
  )
}

export default function App() {
  const [theme, setTheme] = useLocalStorage(THEME_KEY, 'dark')
  const [tasks, setTasks] = useLocalStorage(STORAGE_KEY, [])
  const [filters, setFilters] = useState({ q: '', prio: 'all', status: 'all' })

  useEffect(() => {
    document.body.classList.toggle('light', theme === 'light')
  }, [theme])

  // Import data from shared link if present
  useEffect(() => {
    if (location.hash.startsWith('#data=')) {
      try {
        const data = decodeURIComponent(escape(atob(location.hash.slice(6))))
        const arr = JSON.parse(data)
        if (Array.isArray(arr)) setTasks(arr)
      } catch {}
      location.hash = ''
    }
  }, [])

  const openCount = tasks.filter(t => !t.completed).length
  const dueSoon = tasks.filter(t => !t.completed && isSoon(t.dueDate)).length

  return (
    <div className="container">
      <Header theme={theme} setTheme={setTheme} tasks={tasks} setTasks={setTasks} filters={filters} setFilters={setFilters} />

      <TaskForm onAdd={t => setTasks([t, ...tasks])} />

      <div className="card" style={{marginTop: 12}}>
        <div className="footer">
          <div className="row">
            <span className="badge">Open: {openCount}</span>
            <span className="badge soon">Due soon: {dueSoon}</span>
          </div>
          <div className="muted">Tip: Use Export/Import or Share to collaborate.</div>
        </div>
      </div>

      <FiltersContext.Provider value={filters}>
        <div className="card" style={{marginTop: 12}}>
          <TaskList tasks={tasks} setTasks={setTasks} />
        </div>
      </FiltersContext.Provider>

      <div className="muted" style={{marginTop: 16, textAlign:'center'}}>
        PigeonToDoApp — simple, fast, and shareable todos.
      </div>
    </div>
  )
}

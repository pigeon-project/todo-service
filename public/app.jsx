/* PigeonToDoApp - Minimal React UI served statically */

const { useState, useEffect, useMemo } = React;

function uid() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

const PRIORITIES = ["Low", "Medium", "High"];

function useLocalStorage(key, initial) {
  const [value, setValue] = useState(() => {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : initial;
    } catch { return initial; }
  });
  useEffect(() => {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
  }, [key, value]);
  return [value, setValue];
}

function AddTask({ onAdd }) {
  const [text, setText] = useState("");
  const [due, setDue] = useState("");
  const [priority, setPriority] = useState("Medium");

  function submit(e) {
    e.preventDefault();
    const trimmed = text.trim();
    if (!trimmed) return;
    onAdd({ id: uid(), text: trimmed, due, priority, completed: false, createdAt: Date.now() });
    setText("");
    setDue("");
    setPriority("Medium");
  }

  return (
    <form onSubmit={submit} className="panel" aria-label="Add Task">
      <div className="row">
        <input
          type="text"
          placeholder="Add a task..."
          value={text}
          onChange={(e) => setText(e.target.value)}
          aria-label="Task description"
          style={{ flex: 1 }}
        />
        <input type="date" value={due} onChange={(e) => setDue(e.target.value)} aria-label="Due date" />
        <select value={priority} onChange={(e) => setPriority(e.target.value)} aria-label="Priority">
          {PRIORITIES.map(p => <option key={p}>{p}</option>)}
        </select>
        <button type="submit" title="Add Task">Add</button>
      </div>
    </form>
  );
}

function TaskItem({ task, onToggle, onEdit, onDelete }) {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(task.text);
  const [due, setDue] = useState(task.due || "");
  const [priority, setPriority] = useState(task.priority || "Medium");

  function save() {
    const t = { ...task, text: val.trim() || task.text, due, priority };
    onEdit(t);
    setEditing(false);
  }

  return (
    <div className={"item" + (task.completed ? " done" : "")}>
      <input type="checkbox" checked={task.completed} onChange={() => onToggle(task.id)} aria-label="Complete" />
      <div>
        {editing ? (
          <div className="row" style={{ marginBottom: 6 }}>
            <input value={val} onChange={(e) => setVal(e.target.value)} style={{ flex: 1 }} />
            <input type="date" value={due} onChange={(e) => setDue(e.target.value)} />
            <select value={priority} onChange={(e) => setPriority(e.target.value)}>
              {PRIORITIES.map(p => <option key={p}>{p}</option>)}
            </select>
            <button className="success" onClick={save} type="button">Save</button>
            <button className="ghost" onClick={() => setEditing(false)} type="button">Cancel</button>
          </div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
            <div className="title">{task.text}</div>
            {!!task.due && <span className="pill">Due: {task.due}</span>}
            <span className={"pill " + (task.priority || 'low').toLowerCase()}>{task.priority || 'Low'} priority</span>
          </div>
        )}
        <div className="meta">Created {new Date(task.createdAt).toLocaleString()}</div>
      </div>
      {!editing && (
        <div className="toolbar">
          <button className="secondary" onClick={() => setEditing(true)} type="button">Edit</button>
          <button className="danger" onClick={() => onDelete(task.id)} type="button">Delete</button>
        </div>
      )}
    </div>
  );
}

function Filters({ filter, setFilter, sort, setSort, clearCompleted }) {
  return (
    <div className="panel toolbar" aria-label="Filters">
      <div className="row">
        <button className={filter==='all' ? '' : 'ghost'} onClick={() => setFilter('all')} type="button">All</button>
        <button className={filter==='active' ? '' : 'ghost'} onClick={() => setFilter('active')} type="button">Active</button>
        <button className={filter==='completed' ? '' : 'ghost'} onClick={() => setFilter('completed')} type="button">Completed</button>
      </div>
      <div className="spacer"></div>
      <label className="muted" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        Sort:
        <select value={sort} onChange={(e) => setSort(e.target.value)}>
          <option value="created">Created</option>
          <option value="due">Due date</option>
          <option value="priority">Priority</option>
        </select>
      </label>
      <button className="ghost" onClick={clearCompleted} type="button">Clear completed</button>
    </div>
  );
}

function App() {
  const [tasks, setTasks] = useLocalStorage('pigeon.todo.tasks', []);
  const [filter, setFilter] = useLocalStorage('pigeon.todo.filter', 'all');
  const [sort, setSort] = useLocalStorage('pigeon.todo.sort', 'created');
  const [theme, setTheme] = useLocalStorage('pigeon.todo.theme', 'dark');

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  const filtered = useMemo(() => {
    let list = tasks.slice();
    if (filter === 'active') list = list.filter(t => !t.completed);
    if (filter === 'completed') list = list.filter(t => t.completed);
    if (sort === 'created') list.sort((a,b)=>a.createdAt-b.createdAt);
    if (sort === 'due') list.sort((a,b)=> (a.due||'').localeCompare(b.due||''));
    if (sort === 'priority') {
      const rank = { High: 0, Medium: 1, Low: 2 };
      list.sort((a,b)=> (rank[a.priority||'Low'] - rank[b.priority||'Low']));
    }
    return list;
  }, [tasks, filter, sort]);

  function addTask(t) { setTasks([t, ...tasks]); }
  function toggle(id) { setTasks(tasks.map(t => t.id===id ? { ...t, completed: !t.completed } : t)); }
  function editTask(nt) { setTasks(tasks.map(t => t.id===nt.id ? nt : t)); }
  function delTask(id) { setTasks(tasks.filter(t => t.id!==id)); }
  function clearCompleted() { setTasks(tasks.filter(t => !t.completed)); }

  return (
    <div className="container">
      <div className="header">
        <div>
          <h1>PigeonToDoApp</h1>
          <div className="muted">Stay Organized. Get Things Done.</div>
        </div>
        <div className="toolbar">
          <button className="ghost" onClick={() => setTheme(theme==='dark'?'light':'dark')} type="button">
            {theme === 'dark' ? 'Light Mode' : 'Dark Mode'}
          </button>
        </div>
      </div>

      <AddTask onAdd={addTask} />

      <Filters filter={filter} setFilter={setFilter} sort={sort} setSort={setSort} clearCompleted={clearCompleted} />

      <div className="list" role="list" aria-label="Tasks">
        {filtered.length === 0 ? (
          <div className="panel empty">No tasks yet. Add your first one!</div>
        ) : filtered.map(t => (
          <TaskItem key={t.id} task={t} onToggle={toggle} onEdit={editTask} onDelete={delTask} />
        ))}
      </div>

      <div className="footer">
        <div>Local storage keeps tasks across sessions.</div>
        <div>Priorities, due dates, filters and theme supported.</div>
      </div>
    </div>
  );
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);


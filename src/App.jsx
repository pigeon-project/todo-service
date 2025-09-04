import { useEffect, useMemo, useState } from 'react';
import TodoForm from './components/TodoForm.jsx';
import TodoList from './components/TodoList.jsx';
import { useLocalStorage } from './hooks/useLocalStorage.js';

function uid() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function sortTasks(tasks, sortBy) {
  const copy = [...tasks];
  switch (sortBy) {
    case 'due':
      copy.sort((a, b) => (a.dueDate || '').localeCompare(b.dueDate || ''));
      break;
    case 'priority': {
      const order = { high: 0, medium: 1, low: 2 };
      copy.sort((a, b) => (order[a.priority] ?? 1) - (order[b.priority] ?? 1));
      break;
    }
    default:
      copy.sort((a, b) => b.createdAt - a.createdAt);
  }
  return copy;
}

export default function App() {
  const [tasks, setTasks] = useLocalStorage('pigeon.tasks.v1', []);
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('all'); // all | active | completed
  const [priority, setPriority] = useState('all'); // all | high | medium | low
  const [sortBy, setSortBy] = useState('created'); // created | due | priority
  const [dark, setDark] = useLocalStorage('pigeon.theme.dark', false);
  const [themeHue, setThemeHue] = useLocalStorage('pigeon.theme.hue', 220);

  useEffect(() => {
    document.body.classList.toggle('dark', !!dark);
    document.documentElement.style.setProperty('--accent', `hsl(${themeHue} 80% 45%)`);
    document.documentElement.style.setProperty('--accent-600', `hsl(${themeHue} 80% 40%)`);
  }, [dark, themeHue]);

  function addTask(data) {
    const now = Date.now();
    const t = {
      id: uid(),
      title: data.title,
      notes: data.notes || '',
      dueDate: data.dueDate || '',
      priority: data.priority || 'medium',
      completed: false,
      createdAt: now,
      updatedAt: now,
    };
    setTasks([t, ...tasks]);
  }

  function toggleTask(id) {
    setTasks(tasks.map((t) => (t.id === id ? { ...t, completed: !t.completed, updatedAt: Date.now() } : t)));
  }

  function deleteTask(id) {
    setTasks(tasks.filter((t) => t.id !== id));
  }

  function updateTask(next) {
    setTasks(tasks.map((t) => (t.id === next.id ? { ...t, ...next, updatedAt: Date.now() } : t)));
  }

  const filtered = useMemo(() => {
    let list = tasks;
    if (query.trim()) {
      const q = query.toLowerCase();
      list = list.filter((t) => t.title.toLowerCase().includes(q) || t.notes.toLowerCase().includes(q));
    }
    if (status !== 'all') {
      list = list.filter((t) => (status === 'completed' ? t.completed : !t.completed));
    }
    if (priority !== 'all') {
      list = list.filter((t) => t.priority === priority);
    }
    return sortTasks(list, sortBy);
  }, [tasks, query, status, priority, sortBy]);

  function exportTasks() {
    const blob = new Blob([JSON.stringify(tasks, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'pigeon-tasks.json';
    a.click();
    URL.revokeObjectURL(url);
  }

  function importTasks(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result);
        if (Array.isArray(data)) {
          const normalized = data.map((t) => ({
            id: t.id || uid(),
            title: String(t.title || '').slice(0, 300),
            notes: String(t.notes || ''),
            dueDate: t.dueDate || '',
            priority: ['high', 'medium', 'low'].includes(t.priority) ? t.priority : 'medium',
            completed: !!t.completed,
            createdAt: Number(t.createdAt || Date.now()),
            updatedAt: Number(t.updatedAt || Date.now()),
          }));
          setTasks(normalized);
        }
      } catch {}
    };
    reader.readAsText(file);
  }

  return (
    <div className="container">
      <header>
        <div className="brand">
          <span style={{ fontSize: 20 }}>🕊️</span>
          <h1>PigeonToDoApp</h1>
        </div>
        <div className="toolbar">
          <label className="btn ghost" title="Dark mode">
            <input type="checkbox" checked={!!dark} onChange={(e) => setDark(e.target.checked)} /> Dark
          </label>
          <label className="btn ghost" title="Theme hue">
            Hue
            <input type="range" min="180" max="320" value={themeHue} onChange={(e) => setThemeHue(Number(e.target.value))} />
          </label>
          <button className="btn" onClick={exportTasks}>Export</button>
          <label className="btn">
            Import
            <input type="file" accept="application/json" style={{ display: 'none' }} onChange={importTasks} />
          </label>
        </div>
      </header>

      <div className="grid" style={{ marginTop: 16 }}>
        <main>
          <TodoForm onSubmit={addTask} />

          <div className="card" style={{ marginTop: 12, marginBottom: 12 }}>
            <div className="row stretch">
              <input placeholder="Search tasks" value={query} onChange={(e) => setQuery(e.target.value)} />
              <select value={status} onChange={(e) => setStatus(e.target.value)}>
                <option value="all">All</option>
                <option value="active">Active</option>
                <option value="completed">Completed</option>
              </select>
              <select value={priority} onChange={(e) => setPriority(e.target.value)}>
                <option value="all">Any priority</option>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
              <select value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
                <option value="created">Newest</option>
                <option value="due">Due date</option>
                <option value="priority">Priority</option>
              </select>
            </div>
          </div>

          <TodoList tasks={filtered} onToggle={toggleTask} onDelete={deleteTask} onUpdate={updateTask} />
        </main>

        <aside>
          <div className="section-title">Tips</div>
          <div className="card">
            <ul>
              <li>Create, edit, and complete tasks.</li>
              <li>Set priorities and due dates.</li>
              <li>Toggle dark mode and theme hue.</li>
              <li>Export/Import JSON to share lists.</li>
            </ul>
          </div>
        </aside>
      </div>

      <div className="footer">Stay Organized. Get Things Done.</div>
    </div>
  );
}


(() => {
  const { useState, useMemo, useEffect } = React;

  const PRIORITIES = [
    { id: 'low', label: 'Low' },
    { id: 'medium', label: 'Medium' },
    { id: 'high', label: 'High' },
  ];

  const LS_KEY = 'pigeon_todos_v1';
  const THEME_KEY = 'pigeon_theme';

  const uid = () => Math.random().toString(36).slice(2, 10);

  function useLocalStorageState(key, defaultValue) {
    const [state, setState] = useState(() => {
      try {
        const raw = localStorage.getItem(key);
        return raw ? JSON.parse(raw) : defaultValue;
      } catch {
        return defaultValue;
      }
    });
    useEffect(() => {
      try { localStorage.setItem(key, JSON.stringify(state)); } catch {}
    }, [key, state]);
    return [state, setState];
  }

  function App() {
    const [todos, setTodos] = useLocalStorageState(LS_KEY, []);
    const [theme, setTheme] = useLocalStorageState(THEME_KEY, 'dark');

    useEffect(() => {
      document.documentElement.classList.toggle('light', theme === 'light');
    }, [theme]);

    const [draft, setDraft] = useState({
      title: '',
      notes: '',
      priority: 'medium',
      due: '',
    });

    const [filter, setFilter] = useState({ q: '', status: 'all', priority: 'all' });

    const filtered = useMemo(() => {
      return todos.filter(t => {
        if (filter.status === 'open' && t.completed) return false;
        if (filter.status === 'done' && !t.completed) return false;
        if (filter.priority !== 'all' && t.priority !== filter.priority) return false;
        if (filter.q && !t.title.toLowerCase().includes(filter.q.toLowerCase())) return false;
        return true;
      }).sort((a, b) => {
        const prioOrder = { high: 0, medium: 1, low: 2 };
        const byPrio = prioOrder[a.priority] - prioOrder[b.priority];
        if (byPrio !== 0) return byPrio;
        const aDue = a.due ? new Date(a.due).getTime() : Infinity;
        const bDue = b.due ? new Date(b.due).getTime() : Infinity;
        return aDue - bDue;
      });
    }, [todos, filter]);

    function addTodo() {
      if (!draft.title.trim()) return;
      const now = new Date().toISOString();
      setTodos(prev => [...prev, { id: uid(), createdAt: now, updatedAt: now, completed: false, ...draft }]);
      setDraft({ title: '', notes: '', priority: 'medium', due: '' });
    }

    function updateTodo(id, patch) {
      setTodos(prev => prev.map(t => t.id === id ? { ...t, ...patch, updatedAt: new Date().toISOString() } : t));
    }

    function removeTodo(id) {
      setTodos(prev => prev.filter(t => t.id !== id));
    }

    function clearCompleted() {
      setTodos(prev => prev.filter(t => !t.completed));
    }

    const openCount = todos.filter(t => !t.completed).length;

    return React.createElement('div', { className: 'container' },
      React.createElement('div', { className: 'header' },
        React.createElement('div', { className: 'title' },
          React.createElement('span', { style: { fontSize: 24 } }, '🕊️'),
          React.createElement('div', null,
            React.createElement('div', null, 'PigeonToDoApp'),
            React.createElement('div', { className: 'pill' }, 'Stay Organized. Get Things Done.'),
          ),
        ),
        React.createElement('div', { className: 'row' },
          React.createElement('button', { className: 'btn ghost', onClick: () => setTheme(theme === 'dark' ? 'light' : 'dark') }, theme === 'dark' ? '🌙 Dark' : '🌞 Light'),
          React.createElement('span', { className: 'pill' }, `${openCount} open`),
        ),
      ),

      React.createElement('div', { className: 'card', style: { marginBottom: 12 } },
        React.createElement('div', { className: 'toolbar', style: { marginBottom: 8 } },
          React.createElement('input', {
            placeholder: 'Add a task…', value: draft.title, className: 'grow',
            onChange: e => setDraft({ ...draft, title: e.target.value })
          }),
          React.createElement('select', {
            value: draft.priority, onChange: e => setDraft({ ...draft, priority: e.target.value })
          }, PRIORITIES.map(p => React.createElement('option', { key: p.id, value: p.id }, `Priority: ${p.label}`))),
          React.createElement('input', {
            type: 'date', value: draft.due, onChange: e => setDraft({ ...draft, due: e.target.value })
          }),
          React.createElement('button', { className: 'btn primary', onClick: addTodo, disabled: !draft.title.trim() }, 'Add'),
        ),
        React.createElement('textarea', {
          placeholder: 'Notes (optional)…', rows: 2, value: draft.notes,
          onChange: e => setDraft({ ...draft, notes: e.target.value }), style: { width: '100%', marginTop: 8 }
        })
      ),

      React.createElement('div', { className: 'card', style: { marginBottom: 12 } },
        React.createElement('div', { className: 'toolbar' },
          React.createElement('input', {
            placeholder: 'Search…', className: 'grow', value: filter.q,
            onChange: e => setFilter({ ...filter, q: e.target.value })
          }),
          React.createElement('select', {
            value: filter.status, onChange: e => setFilter({ ...filter, status: e.target.value })
          }, [
            React.createElement('option', { key: 'all', value: 'all' }, 'All'),
            React.createElement('option', { key: 'open', value: 'open' }, 'Open'),
            React.createElement('option', { key: 'done', value: 'done' }, 'Completed'),
          ]),
          React.createElement('select', {
            value: filter.priority, onChange: e => setFilter({ ...filter, priority: e.target.value })
          }, [
            React.createElement('option', { key: 'all', value: 'all' }, 'Any priority'),
            ...PRIORITIES.map(p => React.createElement('option', { key: p.id, value: p.id }, p.label))
          ]),
          React.createElement('button', { className: 'btn', onClick: clearCompleted, disabled: !todos.some(t => t.completed) }, 'Clear completed'),
        )
      ),

      React.createElement('div', { className: 'list' },
        filtered.length === 0
          ? React.createElement('div', { className: 'muted' }, 'No tasks match your filters.')
          : filtered.map(t => React.createElement(TodoItem, { key: t.id, todo: t, updateTodo, removeTodo }))
      ),

      React.createElement('div', { className: 'footer' },
        'Built with React. Local-only demo; collaboration and sync are out of scope for this version.'
      )
    );
  }

  function TodoItem({ todo, updateTodo, removeTodo }) {
    const [editing, setEditing] = React.useState(false);
    const [form, setForm] = React.useState(todo);
    React.useEffect(() => setForm(todo), [todo.id]);

    const prioClass = todo.priority === 'high' ? 'priority-high' : todo.priority === 'medium' ? 'priority-medium' : 'priority-low';

    return React.createElement('div', { className: `todo ${todo.completed ? 'completed' : ''}` },
      React.createElement('input', {
        type: 'checkbox', checked: !!todo.completed,
        onChange: e => updateTodo(todo.id, { completed: e.target.checked })
      }),
      editing ? (
        React.createElement('div', { className: 'grow' },
          React.createElement('input', {
            className: 'grow', value: form.title, onChange: e => setForm({ ...form, title: e.target.value })
          }),
          React.createElement('div', { className: 'row', style: { marginTop: 6 } },
            React.createElement('select', {
              value: form.priority, onChange: e => setForm({ ...form, priority: e.target.value })
            }, PRIORITIES.map(p => React.createElement('option', { key: p.id, value: p.id }, p.label))),
            React.createElement('input', {
              type: 'date', value: form.due || '', onChange: e => setForm({ ...form, due: e.target.value })
            }),
          ),
          React.createElement('textarea', {
            rows: 2, value: form.notes || '', onChange: e => setForm({ ...form, notes: e.target.value }),
            style: { width: '100%', marginTop: 6 }
          })
        )
      ) : (
        React.createElement('div', { className: 'grow' },
          React.createElement('div', { className: 'row', style: { justifyContent: 'space-between' } },
            React.createElement('div', { style: { fontWeight: 600 } }, todo.title),
            React.createElement('div', { className: `badge ${prioClass}` }, `Priority: ${todo.priority}`)
          ),
          (todo.notes && todo.notes.trim()) && React.createElement('div', { className: 'muted', style: { marginTop: 4 } }, todo.notes),
          React.createElement('div', { className: 'muted', style: { marginTop: 4 } },
            todo.due ? `Due: ${todo.due}` : 'No due date'
          )
        )
      ),
      React.createElement('div', { className: 'row' },
        editing
          ? React.createElement(React.Fragment, null,
              React.createElement('button', { className: 'btn success', onClick: () => { updateTodo(todo.id, form); setEditing(false); } }, 'Save'),
              React.createElement('button', { className: 'btn', onClick: () => { setForm(todo); setEditing(false); } }, 'Cancel'),
            )
          : React.createElement(React.Fragment, null,
              React.createElement('button', { className: 'btn', onClick: () => setEditing(true) }, 'Edit'),
              React.createElement('button', { className: 'btn danger', onClick: () => removeTodo(todo.id) }, 'Delete'),
            )
      )
    );
  }

  ReactDOM.createRoot(document.getElementById('root')).render(React.createElement(App));
})();


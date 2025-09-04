import { useState } from 'react';

function PriorityPill({ level }) {
  const map = {
    high: { label: 'High', cls: 'priority-high' },
    medium: { label: 'Medium', cls: 'priority-medium' },
    low: { label: 'Low', cls: 'priority-low' },
  };
  const p = map[level] || map.medium;
  return <span className={`pill ${p.cls}`}>Priority: {p.label}</span>;
}

export default function TodoItem({ task, onToggle, onDelete, onUpdate }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState({ title: task.title, notes: task.notes, dueDate: task.dueDate, priority: task.priority });

  function save() {
    const title = draft.title.trim();
    if (!title) return;
    onUpdate({ ...task, ...draft, title });
    setEditing(false);
  }

  return (
    <div className="card todo-item">
      <input type="checkbox" checked={task.completed} onChange={() => onToggle(task.id)} aria-label="Toggle complete" />

      <div>
        {editing ? (
          <div className="row" style={{ flexDirection: 'column', gap: 8 }}>
            <input value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} />
            <div className="row">
              <input type="date" value={draft.dueDate || ''} onChange={(e) => setDraft({ ...draft, dueDate: e.target.value })} />
              <select value={draft.priority} onChange={(e) => setDraft({ ...draft, priority: e.target.value })}>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
            </div>
            <textarea rows={3} placeholder="Notes" value={draft.notes} onChange={(e) => setDraft({ ...draft, notes: e.target.value })} />
          </div>
        ) : (
          <div>
            <div className="todo-title" style={{ textDecoration: task.completed ? 'line-through' : 'none' }}>{task.title}</div>
            <div className="todo-meta">
              <span>{task.dueDate ? `Due ${new Date(task.dueDate).toLocaleDateString()}` : 'No due date'}</span>
              {' '}
              <PriorityPill level={task.priority} />
            </div>
            {task.notes ? <div className="muted" style={{ marginTop: 6 }}>{task.notes}</div> : null}
          </div>
        )}
      </div>

      <div className="todo-actions">
        {editing ? (
          <>
            <button className="btn primary" onClick={save}>Save</button>
            <button className="btn" onClick={() => setEditing(false)}>Cancel</button>
          </>
        ) : (
          <>
            <button className="btn" onClick={() => setEditing(true)}>Edit</button>
            <button className="btn" onClick={() => onDelete(task.id)}>Delete</button>
          </>
        )}
      </div>
    </div>
  );
}


import TodoItem from './TodoItem.jsx'

export default function TodoList({ items, onToggle, onDelete, onUpdate }) {
  if (!items.length) return <div className="panel" style={{ textAlign: 'center', color: 'var(--muted)' }}>No tasks yet. Add your first one!</div>

  return (
    <div className="list">
      {items.map(t => (
        <TodoItem key={t.id} todo={t} onToggle={onToggle} onDelete={onDelete} onUpdate={onUpdate} />
      ))}
    </div>
  )
}


import TodoItem from './TodoItem.jsx';

export default function TodoList({ tasks, onToggle, onDelete, onUpdate }) {
  if (!tasks.length) {
    return <div className="card muted">No tasks match your filters.</div>;
  }
  return (
    <div className="list">
      {tasks.map((t) => (
        <TodoItem key={t.id} task={t} onToggle={onToggle} onDelete={onDelete} onUpdate={onUpdate} />
      ))}
    </div>
  );
}


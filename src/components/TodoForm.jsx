import { useEffect, useState } from 'react';

const emptyTask = {
  title: '',
  notes: '',
  dueDate: '',
  priority: 'medium',
};

export default function TodoForm({ onSubmit, initial }) {
  const [form, setForm] = useState(initial ?? emptyTask);

  useEffect(() => {
    setForm(initial ?? emptyTask);
  }, [initial]);

  function handleChange(e) {
    const { name, value } = e.target;
    setForm((f) => ({ ...f, [name]: value }));
  }

  function submit(e) {
    e.preventDefault();
    const title = form.title?.trim();
    if (!title) return;
    onSubmit({ ...form, title });
    if (!initial) setForm(emptyTask);
  }

  return (
    <form className="card" onSubmit={submit}>
      <div className="row stretch" style={{ marginBottom: 8 }}>
        <input
          name="title"
          placeholder="Add a task..."
          value={form.title}
          onChange={handleChange}
          aria-label="Task title"
        />
      </div>
      <div className="row" style={{ marginBottom: 8 }}>
        <input
          type="date"
          name="dueDate"
          value={form.dueDate}
          onChange={handleChange}
          aria-label="Due date"
        />
        <select name="priority" value={form.priority} onChange={handleChange} aria-label="Priority">
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </select>
      </div>
      <textarea
        name="notes"
        placeholder="Notes (optional)"
        value={form.notes}
        onChange={handleChange}
        rows={3}
        aria-label="Notes"
      />
      <div className="row" style={{ marginTop: 10, justifyContent: 'flex-end' }}>
        <button className="btn primary" type="submit">{initial ? 'Save' : 'Add Task'}</button>
      </div>
    </form>
  );
}


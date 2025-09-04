import { useEffect, useState } from 'react'

const empty = { title: '', notes: '', due: '', priority: 'medium' }

export default function TodoForm({ onSubmit, onCancel, initial }) {
  const [form, setForm] = useState(initial || empty)

  useEffect(() => { if (initial) setForm(initial) }, [initial])

  const change = (e) => setForm(prev => ({ ...prev, [e.target.name]: e.target.value }))

  const submit = (e) => {
    e.preventDefault()
    if (!form.title.trim()) return
    onSubmit({ ...form, title: form.title.trim() })
    if (!initial) setForm(empty)
  }

  return (
    <form className="panel" onSubmit={submit}>
      <div className="row">
        <input className="grow" name="title" placeholder="Add a task..." value={form.title} onChange={change} />
        <select name="priority" value={form.priority} onChange={change}>
          <option value="low">Low</option>
          <option value="medium">Medium</option>
          <option value="high">High</option>
        </select>
        <input type="date" name="due" value={form.due} onChange={change} />
        <button className="primary" type="submit">{initial ? 'Save' : 'Add'}</button>
        {onCancel && (
          <button type="button" className="ghost" onClick={onCancel}>Cancel</button>
        )}
      </div>
      <div style={{ marginTop: 8 }}>
        <textarea name="notes" placeholder="Notes (optional)" rows={2} className="grow" style={{ width: '100%' }} value={form.notes} onChange={change} />
      </div>
    </form>
  )
}


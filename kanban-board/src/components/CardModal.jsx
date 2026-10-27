import { useState } from "react";

const COLORS = ["blue", "purple", "pink", "orange", "green"];

export default function CardModal({ card, members, onSave, onClose }) {
  const [form, setForm] = useState({
    title: card.title,
    description: card.description || "",
    dueDate: card.dueDate ? card.dueDate.slice(0, 10) : "",
    labels: card.labels || [],
    assignees: card.assignees || [],
  });
  const [label, setLabel] = useState({ text: "", color: "blue" });
  const [error, setError] = useState("");

  const toggle = (id) =>
    setForm((f) => ({
      ...f,
      assignees: f.assignees.includes(id) ? f.assignees.filter((x) => x !== id) : [...f.assignees, id],
    }));

  const addLabel = () => {
    if (!label.text.trim()) return;
    setForm((f) => ({ ...f, labels: [...f.labels, { text: label.text.trim(), color: label.color }] }));
    setLabel({ ...label, text: "" });
  };

  async function submit(e) {
    e.preventDefault();
    try {
      await onSave(card._id, { ...form, dueDate: form.dueDate || null });
    } catch (err) {
      setError(err.response?.data?.message || "Failed to save");
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <form className="modal" onClick={(e) => e.stopPropagation()} onSubmit={submit}>
        <h2>Edit card</h2>
        <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required />
        <textarea rows={4} placeholder="Description" value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })} />
        <label>Due date <input type="date" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} /></label>

        <div>
          <strong>Labels</strong>
          <div className="label-row">
            {form.labels.map((l, i) => (
              <span key={i} className={`task-tag tag-${l.color}`}>
                {l.text}{" "}
                <button type="button" className="link-btn" onClick={() => setForm((f) => ({ ...f, labels: f.labels.filter((_, j) => j !== i) }))}>×</button>
              </span>
            ))}
          </div>
          <div className="inline-form">
            <input placeholder="Label text" value={label.text} onChange={(e) => setLabel({ ...label, text: e.target.value })} />
            <select value={label.color} onChange={(e) => setLabel({ ...label, color: e.target.value })}>
              {COLORS.map((c) => <option key={c}>{c}</option>)}
            </select>
            <button type="button" className="btn" onClick={addLabel}>Add</button>
          </div>
        </div>

        <div>
          <strong>Assign members</strong>
          {members.map((m) => (
            <label key={m._id} className="check-row">
              <input type="checkbox" checked={form.assignees.includes(m._id)} onChange={() => toggle(m._id)} />
              {m.name}
            </label>
          ))}
        </div>

        {error && <p className="form-error">{error}</p>}
        <div className="inline-form">
          <button className="btn" type="submit">Save</button>
          <button type="button" className="link-btn" onClick={onClose}>Cancel</button>
        </div>
      </form>
    </div>
  );
}

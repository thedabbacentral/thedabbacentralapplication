import React, { useState } from "react";

export default function AddColumnForm({ onAdd }) {
  const [title, setTitle] = useState("");

  const submit = (e) => {
    e.preventDefault();
    if (!title.trim()) return;
    onAdd(title.trim());
    setTitle("");
  };

  return (
    <div className="add-column">
      <form onSubmit={submit} className="add-column-form">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="New column title"
        />
        <button type="submit">Create column</button>
      </form>
    </div>
  );
}

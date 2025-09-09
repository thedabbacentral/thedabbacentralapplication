import React, { useState } from "react";

export default function AddCardForm({ onAdd }) {
  const [text, setText] = useState("");

  const submit = (e) => {
    e.preventDefault();
    if (!text.trim()) return;
    onAdd(text.trim());
    setText("");
  };

  return (
    <form onSubmit={submit} className="add-card-form">
      <input
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Add a card..."
        aria-label="Add card"
      />
      <button type="submit">Add</button>
    </form>
  );
}

import React, { useEffect, useId, useState } from "react";

export default function SearchableSelect({
  label,
  options = [],
  value,
  onChange,
  placeholder = "Search and select an option",
  disabled = false,
  required = false,
}) {
  const listId = useId();
  const selected = options.find((option) => String(option.id) === String(value));
  const [query, setQuery] = useState(selected?.label || "");

  useEffect(() => {
    setQuery(selected?.label || "");
  }, [selected?.label, value]);

  function handleChange(nextValue) {
    setQuery(nextValue);
    const match = options.find((option) => option.label.toLowerCase() === nextValue.trim().toLowerCase());
    onChange(match ? String(match.id) : "");
  }

  return (
    <label className="gf-searchable-select">
      <span>{label}</span>
      <input
        type="text"
        list={listId}
        value={query}
        onChange={(event) => handleChange(event.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        required={required}
        autoComplete="off"
        aria-label={label}
        aria-invalid={Boolean(query && !selected)}
      />
      <datalist id={listId}>
        {options.map((option) => (
          <option key={option.id} value={option.label} />
        ))}
      </datalist>
      {!options.length && !disabled && <small>No active options are configured. Ask an administrator to configure this item first.</small>}
    </label>
  );
}

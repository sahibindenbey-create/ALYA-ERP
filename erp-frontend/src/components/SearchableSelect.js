import React, { useState, useRef, useEffect } from "react";
import "./SearchableSelect.css";

/**
 * props:
 *  - options: [{ value, label, sublabel }]
 *  - value: seçili value
 *  - onChange: (value, option) => void
 *  - placeholder
 */
const SearchableSelect = ({ options, value, onChange, placeholder = "Seçiniz..." }) => {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const ref = useRef(null);

  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const selected = options.find(o => String(o.value) === String(value));

  const filtered = options.filter(o =>
    (o.label || "").toLowerCase().includes(search.toLowerCase()) ||
    (o.sublabel || "").toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="ssel-container" ref={ref}>
      <div className="ssel-input" onClick={() => setOpen(!open)}>
        {selected ? (
          <span>{selected.sublabel ? `${selected.sublabel} — ${selected.label}` : selected.label}</span>
        ) : (
          <span className="ssel-placeholder">{placeholder}</span>
        )}
        <span className="ssel-arrow">▾</span>
      </div>
      {open && (
        <div className="ssel-dropdown">
          <input
            className="ssel-search"
            autoFocus
            placeholder="Ara (kod veya ad)..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <div className="ssel-list">
            {filtered.slice(0, 50).map(o => (
              <div
                key={o.value}
                className="ssel-item"
                onClick={() => { onChange(o.value, o); setOpen(false); setSearch(""); }}
              >
                {o.sublabel && <span className="ssel-item-sub">{o.sublabel}</span>}
                <span>{o.label}</span>
              </div>
            ))}
            {filtered.length === 0 && <div className="ssel-empty">Sonuç bulunamadı</div>}
          </div>
        </div>
      )}
    </div>
  );
};

export default SearchableSelect;

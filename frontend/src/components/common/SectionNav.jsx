import { useRef } from "react";
export function SectionNav({ items, value, onChange, label = "Sections" }) {
  const buttons = useRef([]);
  const choose = (i) => {
    const index = (i + items.length) % items.length;
    onChange(items[index]);
    buttons.current[index]?.focus();
  };
  return (
    <div className="section-tabs" role="group" aria-label={label}>
      {items.map((item, index) => (
        <button
          ref={(el) => {
            buttons.current[index] = el;
          }}
          key={item}
          type="button"
          aria-pressed={value === item}
          onClick={() => onChange(item)}
          onKeyDown={(e) => {
            if (e.key === "ArrowRight") {
              e.preventDefault();
              choose(index + 1);
            }
            if (e.key === "ArrowLeft") {
              e.preventDefault();
              choose(index - 1);
            }
            if (e.key === "Home") {
              e.preventDefault();
              choose(0);
            }
            if (e.key === "End") {
              e.preventDefault();
              choose(items.length - 1);
            }
          }}
        >
          {item}
        </button>
      ))}
    </div>
  );
}

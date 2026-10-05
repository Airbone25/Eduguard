export function SectionNav<T extends string>({
  items,
  value,
  onChange,
  label,
}: {
  items: readonly T[];
  value: T;
  onChange: (value: T) => void;
  label: string;
}) {
  return (
    <nav className="section-nav" aria-label={label}>
      {items.map((item) => (
        <button
          type="button"
          key={item}
          aria-current={value === item ? "page" : undefined}
          onClick={() => onChange(item)}
        >
          {item}
        </button>
      ))}
    </nav>
  );
}

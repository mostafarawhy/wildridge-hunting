export function CheckRow({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onChange}
      className="flex items-center gap-3 w-full text-start group cursor-pointer"
    >
      <span
        className="flex-shrink-0 w-4 h-4 border flex items-center justify-center transition-colors duration-150"
        style={{
          borderColor: checked
            ? "var(--color-action-primary)"
            : "var(--color-shop-divider)",
          backgroundColor: checked
            ? "var(--color-action-primary)"
            : "transparent",
          borderRadius: "var(--radius-none)",
        }}
      >
        {checked && (
          <svg width="9" height="9" viewBox="0 0 9 9" fill="none">
            <path
              d="M1.5 4.5L3.5 6.5L7.5 2.5"
              stroke="var(--primitive-white)"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        )}
      </span>
      <span
        className="text-body flex-1 transition-colors duration-150"
        style={{
          color: checked
            ? "var(--primitive-black)"
            : "var(--color-content-tertiary)",
          fontWeight: checked ? "var(--font-medium)" : "var(--font-normal)",
        }}
      >
        {label}
      </span>
    </button>
  );
}

export function ToggleRow({
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
      className="flex items-center justify-between w-full py-0.5 group cursor-pointer"
    >
      <span
        className="text-body transition-colors duration-150 "
        style={{
          color: checked
            ? "var(--primitive-black)"
            : "var(--color-content-tertiary)",
          fontWeight: checked ? "var(--font-medium)" : "var(--font-normal)",
        }}
      >
        {label}
      </span>
      <span
        className="relative flex-shrink-0 w-9 h-5 transition-colors duration-200 "
        style={{
          backgroundColor: checked
            ? "var(--color-action-primary)"
            : "var(--color-shop-divider)",
          borderRadius: "var(--radius-full)",
        }}
      >
        <span
          className="absolute top-0.5 w-4 h-4 transition-all duration-200"
          style={{
            backgroundColor: "var(--primitive-white)",
            borderRadius: "var(--radius-full)",
            boxShadow: "var(--shadow-sm)",
            insetInlineStart: checked ? "calc(100% - 1.125rem)" : "0.125rem",
          }}
        />
      </span>
    </button>
  );
}

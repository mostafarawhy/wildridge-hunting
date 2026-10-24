export function ActivePill({
  label,
  onRemove,
}: {
  label: string;
  onRemove: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onRemove}
      className="inline-flex items-center gap-1.5 px-2.5 py-1 text-eyebrow tracking-wide uppercase transition-opacity hover:opacity-75"
      style={{
        backgroundColor: "color-mix(in srgb, var(--color-action-primary) 8%, transparent)",
        color: "var(--color-action-primary)",
        border: "1px solid color-mix(in srgb, var(--color-action-primary) 20%, transparent)",
        borderRadius: "var(--radius-none)",
        fontWeight: "var(--font-medium)",
      }}
    >
      {label}
      <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
        <path
          d="M1 1L7 7M7 1L1 7"
          stroke="var(--color-action-primary)"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
      </svg>
    </button>
  );
}

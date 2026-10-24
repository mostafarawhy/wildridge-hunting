export type VerificationStatusTone =
  | "success"
  | "warning"
  | "danger"
  | "neutral";

const STATUS_ACCENT: Record<VerificationStatusTone, string> = {
  success: "var(--color-status-success)",
  warning: "var(--color-status-warning)",
  danger: "var(--color-status-danger)",
  neutral: "var(--color-status-neutral-text)",
};

export default function VerificationStatusPanel({
  type,
  eyebrow,
  children,
}: {
  type: VerificationStatusTone;
  eyebrow: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className="flex flex-col gap-3 p-5"
      style={{
        backgroundColor: "#ffffff",
        border: "1px solid var(--color-shop-divider)",
        borderRadius: "var(--radius-none)",
      }}
    >
      <p
        style={{
          fontSize: "var(--text-eyebrow)",
          fontWeight: "var(--font-bold)",
          letterSpacing: "var(--tracking-widest)",
          textTransform: "uppercase",
          color: STATUS_ACCENT[type],
        }}
      >
        {eyebrow}
      </p>
      {children}
    </div>
  );
}

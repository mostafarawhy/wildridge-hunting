import { isDemoMode } from "@/lib/config/demo";

export default function DemoBanner({ message }: { message: string }) {
  if (!isDemoMode()) return null;

  return (
    <div
      role="note"
      style={{
        backgroundColor: "var(--primitive-black)",
        color: "var(--primitive-white)",
        fontSize: "0.75rem",
        lineHeight: 1.4,
        textAlign: "center",
        padding: "0.375rem 1rem",
      }}
    >
      {message}
    </div>
  );
}

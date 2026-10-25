import { isDemoMode } from "@/lib/config/demo";

interface DemoBannerProps {
  message: string;
  shortMessage?: string;
}

export default function DemoBanner({ message, shortMessage }: DemoBannerProps) {
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
      {shortMessage ? (
        <>
          <span className="sm:hidden">{shortMessage}</span>
          <span className="hidden sm:inline">{message}</span>
        </>
      ) : (
        message
      )}
    </div>
  );
}

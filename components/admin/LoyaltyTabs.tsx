import Link from "next/link";

interface Props {
  active: "program" | "activity";
}

const TABS = [
  { key: "program", label: "Program", href: "/admin/loyalty" },
  { key: "activity", label: "Activity", href: "/admin/loyalty/activity" },
] as const;

export default function LoyaltyTabs({ active }: Props) {
  return (
    <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1.5rem" }}>
      {TABS.map((tab) => (
        <Link
          key={tab.key}
          href={tab.href}
          aria-current={active === tab.key ? "page" : undefined}
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            height: "2.5rem",
            paddingInline: "1.25rem",
            fontSize: "var(--text-body-sm)",
            fontWeight: "var(--font-bold)",
            letterSpacing: "var(--tracking-widest)",
            textTransform: "uppercase",
            textDecoration: "none",
            backgroundColor: "#0b0b0b",
            color: "#ffffff",
            border: "none",
            borderRadius: "0",
            opacity: active === tab.key ? 1 : 0.45,
          }}
        >
          {tab.label}
        </Link>
      ))}
    </div>
  );
}

interface TrustSignalsProps {
  signals: Array<{ key: string; icon: string; label: string }>;
}

export default function TrustSignals({ signals }: TrustSignalsProps) {
  return (
    <div
      className={`grid grid-cols-1 ${signals.length === 2 ? "sm:grid-cols-2" : "sm:grid-cols-3"}`}
      style={{
        borderTop: "1px solid var(--color-shop-divider)",
        borderBottom: "1px solid var(--color-shop-divider)",
      }}
    >
      {signals.map((item, i) => (
        <div
          key={item.key}
          className={`flex items-center gap-2.5 py-3 sm:px-3 ${
            i === 0
              ? "sm:ps-0"
              : "border-t sm:border-t-0 sm:border-s border-[color:var(--color-shop-divider)]"
          }`}
        >
          <svg
            width="19"
            height="19"
            viewBox="0 0 24 24"
            fill="none"
            stroke="var(--primitive-black)"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="flex-shrink-0"
            aria-hidden="true"
          >
            <path d={item.icon} />
          </svg>
          <span
            className="text-xs"
            style={{
              color: "var(--color-auth-label-text)",
              lineHeight: 1.4,
            }}
          >
            {item.label}
          </span>
        </div>
      ))}
    </div>
  );
}

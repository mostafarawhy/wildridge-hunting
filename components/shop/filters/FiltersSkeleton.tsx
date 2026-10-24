export function FiltersSkeleton() {
  return (
    <aside
      aria-hidden="true"
      className="w-full"
      style={{ backgroundColor: "var(--color-shop-bg)" }}
    >
      {["", "", "", "", ""].map((_, i) => (
        <div
          key={i}
          className="px-5 py-5"
          style={{ borderBottom: "1px solid var(--color-shop-divider)" }}
        >
          <div className="sk-shimmer h-2 w-20 mb-5" />
          {[70, 55, 80, 60].map((w, j) => (
            <div
              key={j}
              className="sk-shimmer h-2 mb-3.5"
              style={{ width: `${w}%` }}
            />
          ))}
        </div>
      ))}
    </aside>
  );
}

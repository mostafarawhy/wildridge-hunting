interface Column<T> {
  key: string;
  header: React.ReactNode;
  render: (row: T) => React.ReactNode;
  align?: "start" | "end";
  mobile?: "head" | "hide";
}

interface Props<T> {
  columns: Column<T>[];
  rows: T[];
  getRowKey: (row: T) => string;
  emptyMessage?: string;
  onRowClick?: (row: T) => void;
}

const cardLabelStyle: React.CSSProperties = {
  fontSize: "var(--text-label)",
  fontWeight: "var(--font-semibold)",
  letterSpacing: "var(--tracking-wide)",
  textTransform: "uppercase",
  color: "#6b6b6b",
};

export default function DataTable<T>({
  columns,
  rows,
  getRowKey,
  emptyMessage = "No records found.",
  onRowClick,
}: Props<T>) {
  const phoneColumns = columns.filter((col) => col.mobile !== "hide");
  const markedHead = phoneColumns.filter((col) => col.mobile === "head");
  const headColumns =
    markedHead.length > 0
      ? markedHead
      : phoneColumns.filter((col) => col.header !== "").slice(0, 1);
  const endColumns = phoneColumns.filter(
    (col) => col.header === "" && !headColumns.includes(col),
  );
  const fieldColumns = phoneColumns.filter(
    (col) => !headColumns.includes(col) && !endColumns.includes(col),
  );

  return (
    <>
      <div className="lg:hidden">
        {rows.length === 0 ? (
          <div
            style={{
              backgroundColor: "#ffffff",
              border: "1px solid var(--color-shop-divider)",
              padding: "2rem 1rem",
              textAlign: "center",
              fontSize: "var(--text-body)",
              color: "#6b6b6b",
            }}
          >
            {emptyMessage}
          </div>
        ) : (
          <div
            style={{
              backgroundColor: "#ffffff",
              border: "1px solid var(--color-shop-divider)",
            }}
          >
            {rows.map((row, i) => (
              <div
                key={getRowKey(row)}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                style={{
                  padding: "0.75rem 1rem",
                  borderTop:
                    i > 0 ? "1px solid var(--color-shop-divider)" : undefined,
                  cursor: onRowClick ? "pointer" : undefined,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "0.75rem",
                      flex: 1,
                      minWidth: 0,
                      fontSize: "var(--text-body)",
                      color: "#0b0b0b",
                    }}
                  >
                    {headColumns.map((col, h) => (
                      <div
                        key={col.key}
                        style={{
                          minWidth: 0,
                          flexShrink: h === headColumns.length - 1 ? 1 : 0,
                        }}
                      >
                        {col.render(row)}
                      </div>
                    ))}
                  </div>
                  {endColumns.map((col) => (
                    <div key={col.key} style={{ flexShrink: 0 }}>
                      {col.render(row)}
                    </div>
                  ))}
                  {onRowClick && endColumns.length === 0 && (
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 16 16"
                      fill="none"
                      stroke="#6b6b6b"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                      style={{ flexShrink: 0 }}
                    >
                      <path d="M6 3l5 5-5 5" />
                    </svg>
                  )}
                </div>
                {fieldColumns.length > 0 && (
                  <dl style={{ margin: "0.5rem 0 0" }}>
                    {fieldColumns.map((col) => (
                      <div
                        key={col.key}
                        style={{
                          display: "grid",
                          gridTemplateColumns: "minmax(0, 7.5rem) minmax(0, 1fr)",
                          gap: "0.75rem",
                          alignItems: "baseline",
                          padding: "0.25rem 0",
                        }}
                      >
                        <dt style={cardLabelStyle}>{col.header}</dt>
                        <dd
                          style={{
                            margin: 0,
                            minWidth: 0,
                            fontSize: "var(--text-body)",
                            color: "#0b0b0b",
                            overflowWrap: "anywhere",
                          }}
                        >
                          {col.render(row)}
                        </dd>
                      </div>
                    ))}
                  </dl>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <div
        className="hidden lg:block"
        style={{
          backgroundColor: "#ffffff",
          border: "1px solid var(--color-shop-divider)",
          borderRadius: "0",
          overflowX: "auto",
          overflowY: "hidden",
          overscrollBehaviorX: "contain",
        }}
      >
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ borderBottom: "1px solid var(--color-shop-divider)" }}>
              {columns.map((col) => (
                <th
                  key={col.key}
                  style={{
                    padding: "0.75rem 1rem",
                    fontSize: "var(--text-label)",
                    fontWeight: "var(--font-semibold)",
                    letterSpacing: "var(--tracking-wide)",
                    textTransform: "uppercase",
                    color: "#6b6b6b",
                    textAlign: col.align === "end" ? "right" : "left",
                    whiteSpace: "nowrap",
                  }}
                >
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length}
                  style={{
                    padding: "3rem 1rem",
                    textAlign: "center",
                    fontSize: "var(--text-body)",
                    color: "#6b6b6b",
                  }}
                >
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              rows.map((row, i) => (
                <tr
                  key={getRowKey(row)}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                  style={{
                    borderTop:
                      i > 0 ? "1px solid var(--color-shop-divider)" : undefined,
                    cursor: onRowClick ? "pointer" : undefined,
                    transition: onRowClick ? "background-color 150ms" : undefined,
                  }}
                  onMouseEnter={
                    onRowClick
                      ? (e) => {
                          (e.currentTarget as HTMLElement).style.backgroundColor =
                            "#f5f5f5";
                        }
                      : undefined
                  }
                  onMouseLeave={
                    onRowClick
                      ? (e) => {
                          (e.currentTarget as HTMLElement).style.backgroundColor =
                            "transparent";
                        }
                      : undefined
                  }
                >
                  {columns.map((col) => (
                    <td
                      key={col.key}
                      style={{
                        padding: "0.875rem 1rem",
                        fontSize: "var(--text-body)",
                        color: "#0b0b0b",
                        textAlign: col.align === "end" ? "right" : "left",
                      }}
                    >
                      {col.render(row)}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}

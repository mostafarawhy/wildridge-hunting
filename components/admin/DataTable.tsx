interface Column<T> {
  key: string;
  header: React.ReactNode;
  render: (row: T) => React.ReactNode;
  align?: "start" | "end";
}

interface Props<T> {
  columns: Column<T>[];
  rows: T[];
  getRowKey: (row: T) => string;
  emptyMessage?: string;
  onRowClick?: (row: T) => void;
}

export default function DataTable<T>({
  columns,
  rows,
  getRowKey,
  emptyMessage = "No records found.",
  onRowClick,
}: Props<T>) {
  return (
    <div
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
  );
}

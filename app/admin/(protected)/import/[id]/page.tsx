import { notFound } from "next/navigation";
import Link from "next/link";
import { requireStaff } from "@/lib/auth-staff";
import {
  getImportDetail,
  type ImportDetailAddonChange,
  type ImportDetailChange,
} from "@/lib/db/queries/import-history";
import { formatDateTime } from "@/lib/utils/date";
import { STAFF_ROLE_LABELS } from "@/lib/utils/staff-permissions";
import { columnLabel, formatFileSize } from "@/lib/utils/catalog-import";
import { AdminPageHeader } from "@/components/admin";
import AdminPaginationBar from "@/components/admin/AdminPaginationBar";
import CopyTextButton from "@/components/admin/CopyTextButton";
import DemoViewOnlyNote from "@/components/admin/DemoViewOnlyNote";
import DataTable from "@/components/admin/DataTable";
import ImportFileDownloadButton from "@/components/admin/ImportFileDownloadButton";
import ImportProblemsTable from "@/components/admin/ImportProblemsTable";

const PAGE_SIZE = 50;
const RED = "#991b1b";
const GREEN = "#166534";

const eyebrow: React.CSSProperties = {
  fontSize: "var(--text-eyebrow)",
  fontWeight: "var(--font-bold)",
  letterSpacing: "var(--tracking-widest)",
  textTransform: "uppercase",
  color: "var(--color-action-primary)",
};

const card: React.CSSProperties = {
  backgroundColor: "#ffffff",
  border: "1px solid var(--color-shop-divider)",
  padding: "1.25rem 1.5rem",
};

const cardStyle: React.CSSProperties = {
  backgroundColor: "#ffffff",
  border: "1px solid var(--color-shop-divider)",
};

const labelStyle: React.CSSProperties = {
  fontSize: "var(--text-label)",
  fontWeight: "var(--font-semibold)",
  letterSpacing: "var(--tracking-wide)",
  textTransform: "uppercase",
  color: "#6b6b6b",
};

const valueStyle: React.CSSProperties = {
  fontSize: "var(--text-body)",
  color: "#0b0b0b",
};

const commitBtn: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  height: "2.5rem",
  paddingInline: "1.25rem",
  fontSize: "var(--text-body-sm)",
  fontWeight: "var(--font-bold)",
  letterSpacing: "var(--tracking-widest)",
  textTransform: "uppercase",
  border: "none",
  borderRadius: "0",
  cursor: "pointer",
  backgroundColor: "#0b0b0b",
  color: "#ffffff",
  textDecoration: "none",
};

const mono: React.CSSProperties = {
  color: "#0b0b0b",
  fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
  fontSize: "var(--text-body-sm)",
};

const STATUS_LABEL: Record<string, string> = {
  DRAFT: "Draft",
  PUBLISHED: "Published",
  ARCHIVED: "Archived",
};

function plural(n: number, one: string, many: string) {
  return `${n} ${n === 1 ? one : many}`;
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div
      style={{
        backgroundColor: "#ffffff",
        border: "1px solid var(--color-shop-divider)",
        padding: "1.25rem 1.5rem",
      }}
    >
      <p
        style={{
          fontSize: "var(--text-label)",
          fontWeight: "var(--font-semibold)",
          letterSpacing: "var(--tracking-wide)",
          textTransform: "uppercase",
          color: "#4b4b4b",
          marginBottom: "0.5rem",
        }}
      >
        {label}
      </p>
      <p
        style={{
          fontSize: "var(--text-heading)",
          fontWeight: "var(--font-bold)",
          color: "#0b0b0b",
          lineHeight: "var(--leading-tight)",
        }}
      >
        {value}
      </p>
    </div>
  );
}

function Pill({
  color,
  bg,
  children,
}: {
  color: string;
  bg: string;
  children: React.ReactNode;
}) {
  return (
    <span
      style={{
        display: "inline-block",
        padding: "0.125rem 0.5rem",
        fontSize: "var(--text-label)",
        fontWeight: "var(--font-semibold)",
        color,
        backgroundColor: bg,
      }}
    >
      {children}
    </span>
  );
}

function whatChanged(change: ImportDetailChange) {
  if (change.action === "create") {
    const created = change.created;
    const parts: string[] = [];
    if (created?.publishStatus) {
      parts.push(`Status ${STATUS_LABEL[created.publishStatus] ?? created.publishStatus}`);
    }
    if (created?.openingStock != null && created.openingStock > 0) {
      parts.push(`opening stock ${created.openingStock}`);
    }
    if (created && created.specCount > 0) {
      parts.push(plural(created.specCount, "specification", "specifications"));
    }
    if (created && created.imageCount > 0) {
      parts.push(`Images: ${created.imageCount}`);
    }
    if (created && created.addonCount > 0) {
      parts.push(`Add-ons: ${created.addonCount}`);
    }
    if (created && created.accessoryCount > 0) {
      parts.push(`Accessories: ${created.accessoryCount}`);
    }
    return <span style={{ color: "#0b0b0b" }}>{parts.length > 0 ? parts.join(" · ") : "—"}</span>;
  }

  const { specs, images, addons, accessories } = change;

  if (change.fields.length === 0 && !specs && !images && !addons && !accessories) {
    return <span style={{ color: "#6b6b6b" }}>—</span>;
  }

  return (
    <div>
      {change.fields.map((f) => (
        <p key={f.column} style={{ marginBottom: "0.25rem", color: "#0b0b0b" }}>
          <span style={{ fontWeight: "var(--font-semibold)", color: "#0b0b0b" }}>
            {columnLabel(f.column)}:
          </span>
          <span style={{ color: "#4b4b4b" }}>
            {" "}
            {f.from} → {f.to}
          </span>
        </p>
      ))}
      <LineDiff title="Specifications" lines={specs} />
      <LineDiff title="Images" lines={images} />
      <LineDiff title="Add-ons" lines={addons} />
      <LineDiff title="Accessories" lines={accessories} />
    </div>
  );
}

function LineDiff({
  title,
  lines,
}: {
  title: string;
  lines: { before: string[]; after: string[] } | null;
}) {
  if (!lines) return null;
  const removed = lines.before.filter((l) => !lines.after.includes(l));
  const added = lines.after.filter((l) => !lines.before.includes(l));
  return (
    <div style={{ marginBottom: "0.25rem" }}>
      <p style={{ fontWeight: "var(--font-semibold)", color: "#0b0b0b" }}>{title}</p>
      {removed.map((line) => (
        <p key={`-${line}`} style={{ ...mono, color: RED, textDecoration: "line-through" }}>
          {line}
        </p>
      ))}
      {added.map((line) => (
        <p key={`+${line}`} style={{ ...mono, color: GREEN }}>
          + {line}
        </p>
      ))}
    </div>
  );
}

function addonWhatChanged(change: ImportDetailAddonChange) {
  if (change.action === "create") {
    return <span style={{ color: "#0b0b0b" }}>New add-on</span>;
  }
  if (change.fields.length === 0) {
    return <span style={{ color: "#6b6b6b" }}>—</span>;
  }
  return (
    <div>
      {change.fields.map((f) => (
        <p key={f.column} style={{ marginBottom: "0.25rem", color: "#0b0b0b" }}>
          <span style={{ fontWeight: "var(--font-semibold)", color: "#0b0b0b" }}>
            {columnLabel(f.column)}:
          </span>
          <span style={{ color: "#4b4b4b" }}>
            {" "}
            {f.from} → {f.to}
          </span>
        </p>
      ))}
    </div>
  );
}

function DetailRows({ rows }: { rows: { label: string; value: React.ReactNode }[] }) {
  return (
    <div style={{ padding: "0 1.25rem" }}>
      {rows.map((row, idx) => (
        <div
          key={row.label}
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            gap: "1rem",
            padding: "0.875rem 0",
            borderBottom:
              idx < rows.length - 1 ? "1px solid var(--color-shop-divider)" : "none",
          }}
        >
          <p style={{ ...labelStyle, flexShrink: 0 }}>{row.label}</p>
          <div style={{ ...valueStyle, textAlign: "end", minWidth: 0 }}>{row.value}</div>
        </div>
      ))}
    </div>
  );
}

interface Props {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ page?: string }>;
}

export default async function AdminImportDetailPage({ params, searchParams }: Props) {
  await requireStaff("catalog:import");
  const { id } = await params;
  const { page: pageParam } = await searchParams;
  const page = Math.max(1, Number(pageParam ?? 1) || 1);

  const detail = await getImportDetail(id, page, PAGE_SIZE);
  if (!detail) notFound();

  const {
    batch,
    problems,
    downloads,
    changes,
    addonChanges,
    total,
    specTables,
    addonsCreated,
    addonsUpdated,
    addonsUnchanged,
    galleries,
    linkLists,
    accessoryLists,
  } = detail;
  const imported = batch.status === "COMPLETED";
  const failed = batch.status === "FAILED";
  const statusLabel = imported ? "Imported" : "Not imported";
  const when = formatDateTime(batch.createdAt, "en");
  const uploader = batch.uploadedBy
    ? `${batch.uploadedBy.name} · ${STAFF_ROLE_LABELS[batch.uploadedBy.role]}`
    : "—";
  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      <div>
        <Link
          href="/admin/import"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "0.375rem",
            fontSize: "var(--text-body-sm)",
            color: "#6b6b6b",
            marginBottom: "1.25rem",
            textDecoration: "none",
          }}
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            aria-hidden="true"
          >
            <path
              d="M19 12H5M12 5l-7 7 7 7"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          Back to catalog import
        </Link>

        <AdminPageHeader
          title={batch.filename}
          subtitle={`${statusLabel} ${when} (Dubai time) by ${batch.uploadedBy ? batch.uploadedBy.name : "unknown staff"}`}
          actions={
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.5rem",
                flexWrap: "wrap",
              }}
            >
              <Pill
                color={imported ? GREEN : RED}
                bg={imported ? "#dcfce7" : "#fee2e2"}
              >
                {statusLabel}
              </Pill>
              <Link
                href={`/admin/audit?entityType=ImportBatch&entityId=${batch.id}`}
                style={commitBtn}
              >
                Audit log
              </Link>
              {batch.hasFile ? (
                <ImportFileDownloadButton
                  batchId={batch.id}
                  filename={batch.filename}
                  variant="button"
                />
              ) : (
                <span
                  style={{ fontSize: "var(--text-body-sm)", color: "#6b6b6b" }}
                >
                  File not stored
                </span>
              )}
            </div>
          }
        />
        <DemoViewOnlyNote permission="catalog:import" />
      </div>

      {imported && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(10rem, 1fr))",
            gap: "1rem",
          }}
        >
          <Stat label="New" value={batch.createdCount ?? 0} />
          <Stat label="Updated" value={batch.updatedCount ?? 0} />
          <Stat label="Unchanged" value={batch.unchangedCount ?? 0} />
          <Stat label="Spec tables" value={specTables} />
          {galleries !== null && <Stat label="Galleries" value={galleries} />}
          {addonsCreated !== null && <Stat label="Add-ons new" value={addonsCreated} />}
          {addonsUpdated !== null && <Stat label="Add-ons updated" value={addonsUpdated} />}
          {addonsUnchanged !== null && <Stat label="Add-ons unchanged" value={addonsUnchanged} />}
          {linkLists !== null && <Stat label="Add-on lists" value={linkLists} />}
          {accessoryLists !== null && <Stat label="Accessory lists" value={accessoryLists} />}
        </div>
      )}

      {failed && (
        <>
          <div style={{ ...card, borderInlineStart: `3px solid ${RED}` }}>
            <p style={{ ...eyebrow, color: RED }}>Nothing was imported</p>
            <p style={{ marginTop: "0.5rem", color: "#0b0b0b" }}>
              No product, add-on, image, stock level or specification was
              changed by this attempt.
            </p>
          </div>
          {problems.length > 0 && (
            <ImportProblemsTable issues={problems} fileName={batch.filename} />
          )}
        </>
      )}

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(20rem, 1fr))",
          gap: "1.5rem",
          alignItems: "start",
        }}
      >
        <div style={cardStyle}>
          <div
            style={{
              padding: "1rem 1.25rem",
              borderBottom: "1px solid var(--color-shop-divider)",
            }}
          >
            <p style={labelStyle}>Details</p>
          </div>
          <DetailRows
            rows={[
              { label: "Uploaded by", value: uploader },
              { label: "When", value: `${when} (Dubai time)` },
              { label: "Product rows", value: batch.totalRows },
              {
                label: "File size",
                value:
                  batch.fileSizeBytes !== null
                    ? formatFileSize(batch.fileSizeBytes)
                    : "—",
              },
              {
                label: "Fingerprint (SHA-256)",
                value: batch.fileSha256 ? (
                  <div>
                    <p style={{ ...mono, wordBreak: "break-all" }}>
                      {batch.fileSha256}
                    </p>
                    <CopyTextButton value={batch.fileSha256} />
                  </div>
                ) : (
                  "—"
                ),
              },
              {
                label: "Import ID",
                value: (
                  <span style={{ ...mono, color: "#6b6b6b" }}>{batch.id}</span>
                ),
              },
            ]}
          />
        </div>

        <div style={cardStyle}>
          <div
            style={{
              padding: "1rem 1.25rem",
              borderBottom: "1px solid var(--color-shop-divider)",
            }}
          >
            <p style={labelStyle}>Original file</p>
          </div>
          <div style={{ padding: "1rem 1.25rem" }}>
            <p
              style={{
                ...valueStyle,
                fontSize: "var(--text-body-sm)",
                color: "#4b4b4b",
              }}
            >
              {batch.hasFile
                ? "Stored privately. Only staff who can import catalogs can download it, and every download is logged."
                : "No copy of this file was stored. Imports made before file storage, and files that weren't a valid template, have none."}
            </p>
            <p
              style={{
                ...labelStyle,
                marginTop: "1.25rem",
                marginBottom: "0.5rem",
              }}
            >
              {downloads.length === 20
                ? "Latest 20 downloads"
                : `Downloads · ${downloads.length}`}
            </p>
            {downloads.length === 0 ? (
              <p style={{ fontSize: "var(--text-body-sm)", color: "#6b6b6b" }}>
                No downloads yet.
              </p>
            ) : (
              downloads.map((d, i) => (
                <div
                  key={`${d.createdAt}-${i}`}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    gap: "1rem",
                    padding: "0.5rem 0",
                    borderTop:
                      i > 0 ? "1px solid var(--color-shop-divider)" : "none",
                  }}
                >
                  <span style={valueStyle}>{d.staffName}</span>
                  <span
                    style={{
                      fontSize: "var(--text-body-sm)",
                      color: "#6b6b6b",
                    }}
                  >
                    {formatDateTime(d.createdAt, "en")}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {imported && (
        <div style={card}>
          <p style={{ ...eyebrow, marginBottom: "1rem" }}>
            Products changed · {total}
          </p>
          <DataTable
            rows={changes}
            getRowKey={(c) => `${c.productId}-${c.row ?? "specs"}`}
            emptyMessage="No product changes were recorded for this import."
            columns={[
              {
                key: "sku",
                header: "SKU",
                render: (c) => <span style={mono}>{c.sku}</span>,
              },
              {
                key: "action",
                header: "Action",
                render: (c) =>
                  c.action === "create" ? (
                    <Pill color="#166534" bg="#dcfce7">
                      New
                    </Pill>
                  ) : (
                    <Pill color="#1e40af" bg="#dbeafe">
                      Update
                    </Pill>
                  ),
              },
              {
                key: "product",
                header: "Product",
                render: (c) =>
                  c.productDeleted ? (
                    <span>{c.name} (deleted)</span>
                  ) : (
                    <Link
                      href={`/admin/products/${c.productId}`}
                      style={{
                        color: "var(--color-action-primary)",
                        textDecoration: "none",
                      }}
                    >
                      {c.name}
                    </Link>
                  ),
              },
              {
                key: "changed",
                header: "What changed",
                render: (c) => whatChanged(c),
              },
            ]}
          />
          <AdminPaginationBar totalPages={totalPages} />
          {(batch.unchangedCount ?? 0) > 0 && (
            <p
              style={{
                marginTop: "0.75rem",
                fontSize: "var(--text-body-sm)",
                color: "#4b4b4b",
              }}
            >
              {plural(batch.unchangedCount ?? 0, "product", "products")} in the
              file already matched the store and aren&apos;t listed.
            </p>
          )}
        </div>
      )}

      {imported && addonChanges.length > 0 && (
        <div style={card}>
          <p style={{ ...eyebrow, marginBottom: "1rem" }}>
            Add-ons changed · {addonChanges.length}
          </p>
          <DataTable
            rows={addonChanges}
            getRowKey={(a) => `${a.id}-${a.row ?? "addon"}`}
            emptyMessage="No add-on changes were recorded for this import."
            columns={[
              {
                key: "addonId",
                header: "Add-on ID",
                render: (a) => <span style={mono}>{a.addonId}</span>,
              },
              {
                key: "action",
                header: "Action",
                render: (a) =>
                  a.action === "create" ? (
                    <Pill color="#166534" bg="#dcfce7">
                      New
                    </Pill>
                  ) : (
                    <Pill color="#1e40af" bg="#dbeafe">
                      Update
                    </Pill>
                  ),
              },
              {
                key: "name",
                header: "Add-on",
                render: (a) => (
                  <span>{a.name}</span>
                ),
              },
              {
                key: "changed",
                header: "What changed",
                render: (a) => addonWhatChanged(a),
              },
            ]}
          />
        </div>
      )}
    </div>
  );
}

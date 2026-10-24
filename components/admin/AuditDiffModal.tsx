"use client";

import { useState } from "react";
import Link from "next/link";
import Modal from "@/components/ui/Modal";
import { formatDateTime } from "@/lib/utils/date";
import {
  auditActionLabel,
  auditEntityLabel,
  auditEntityHref,
} from "@/lib/utils/audit-taxonomy";
import type { AuditLogListItem } from "@/lib/db/queries/audit-log";

interface Props {
  row: AuditLogListItem | null;
  onClose: () => void;
}

const MONO = "ui-monospace, SFMono-Regular, Menlo, monospace";
const ISO_RE =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})?$/;

type FieldStatus = "ADDED" | "CHANGED" | "REMOVED";

interface FieldDiff {
  key: string;
  status: FieldStatus;
  before?: unknown;
  after?: unknown;
}

const PILL_STYLE: Record<FieldStatus, { color: string; bg: string }> = {
  ADDED: { color: "#166534", bg: "#dcfce7" },
  CHANGED: { color: "#1e40af", bg: "#dbeafe" },
  REMOVED: { color: "#991b1b", bg: "#fee2e2" },
};

function isPlainObj(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === "object" && !Array.isArray(v);
}

function isLong(v: unknown): boolean {
  return typeof v === "string" && (v.length > 60 || v.includes("\n"));
}

function humanizeKey(key: string): string {
  const withSpaces = key
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[_.]/g, " ");
  const lower = withSpaces.toLowerCase().trim();
  return lower.charAt(0).toUpperCase() + lower.slice(1);
}

function buildFieldDiffs(before: unknown, after: unknown): FieldDiff[] {
  const b = (before ?? {}) as Record<string, unknown>;
  const a = (after ?? {}) as Record<string, unknown>;
  const keys = [...new Set([...Object.keys(b), ...Object.keys(a)])].sort();

  const diffs: FieldDiff[] = [];
  for (const key of keys) {
    const inB = key in b;
    const inA = key in a;
    if (!inB && inA) {
      diffs.push({ key, status: "ADDED", after: a[key] });
    } else if (inB && !inA) {
      diffs.push({ key, status: "REMOVED", before: b[key] });
    } else if (
      inB &&
      inA &&
      JSON.stringify(b[key]) !== JSON.stringify(a[key])
    ) {
      diffs.push({ key, status: "CHANGED", before: b[key], after: a[key] });
    }
  }
  return diffs;
}

// Every value MUST carry an explicit color — an inherited/undefined color is
// how numbers like 0 or -1 previously rendered invisible against the modal.
function renderValue(v: unknown) {
  let content: string;
  if (v === null || v === undefined) {
    content = "null";
  } else if (
    typeof v === "string" &&
    ISO_RE.test(v) &&
    !isNaN(new Date(v).getTime())
  ) {
    content = formatDateTime(v, "en");
  } else if (typeof v === "object") {
    content = JSON.stringify(v);
  } else {
    content = String(v);
  }
  return (
    <span
      dir="ltr"
      style={{
        fontFamily: MONO,
        fontSize: "var(--text-body-sm)",
        color: v == null ? "#9a9a9a" : "#0b0b0b",
      }}
    >
      {content}
    </span>
  );
}

function InfoCell({
  label,
  children,
  dir,
  mono,
  valueColor = "#0b0b0b",
}: {
  label: string;
  children: React.ReactNode;
  dir?: "ltr";
  mono?: boolean;
  valueColor?: string;
}) {
  return (
    <div>
      <div style={{ fontSize: "var(--text-body-sm)", color: "#6b6b6b" }}>
        {label}
      </div>
      <div
        dir={dir}
        style={{
          fontSize: "var(--text-body)",
          color: valueColor,
          fontFamily: mono ? MONO : undefined,
        }}
      >
        {children}
      </div>
    </div>
  );
}

function ValueCell({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div style={{ fontSize: "var(--text-body-sm)", color: "#6b6b6b" }}>
        {label}
      </div>
      <div style={{ marginTop: "0.125rem" }}>{children}</div>
    </div>
  );
}

function ChangedValue({ before, after }: { before: unknown; after: unknown }) {
  if (isLong(before) || isLong(after)) {
    return (
      <div
        style={{ display: "flex", flexDirection: "column", gap: "0.625rem" }}
      >
        <ValueCell label="before">{renderValue(before)}</ValueCell>
        <ValueCell label="after">{renderValue(after)}</ValueCell>
      </div>
    );
  }
  return (
    <div
      style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}
    >
      <ValueCell label="before">{renderValue(before)}</ValueCell>
      <ValueCell label="after">{renderValue(after)}</ValueCell>
    </div>
  );
}

function FieldRow({ diff, isFirst }: { diff: FieldDiff; isFirst: boolean }) {
  const pill = PILL_STYLE[diff.status];
  return (
    <div
      style={{
        padding: "0.875rem 1rem",
        borderTop: isFirst ? undefined : "1px solid #e3e3e3",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
        <span
          style={{
            display: "inline-block",
            padding: "0.125rem 0.5rem",
            fontSize: "var(--text-label)",
            fontWeight: "var(--font-semibold)",
            textTransform: "uppercase",
            borderRadius: 0,
            color: pill.color,
            backgroundColor: pill.bg,
          }}
        >
          {diff.status}
        </span>
        <span
          style={{
            fontSize: "var(--text-body)",
            fontWeight: "var(--font-bold)",
            color: "#0b0b0b",
          }}
        >
          {humanizeKey(diff.key)}
        </span>
      </div>
      <div style={{ marginTop: "0.5rem" }}>
        {diff.status === "ADDED" && (
          <ValueCell label="after">{renderValue(diff.after)}</ValueCell>
        )}
        {diff.status === "REMOVED" && (
          <ValueCell label="before">{renderValue(diff.before)}</ValueCell>
        )}
        {diff.status === "CHANGED" && (
          <ChangedValue before={diff.before} after={diff.after} />
        )}
      </div>
    </div>
  );
}

function NoChanges() {
  return (
    <p style={{ color: "#6b6b6b", fontSize: "var(--text-body-sm)" }}>
      No field-level changes recorded.
    </p>
  );
}

function CreatedSummary({ diffs }: { diffs: FieldDiff[] }) {
  const entries = diffs.filter(
    (d) => d.after !== null && d.after !== undefined,
  );
  if (entries.length === 0) {
    return <NoChanges />;
  }
  return (
    <div>
      <h4 style={{ margin: 0, ...labelHeading }}>Created with</h4>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "0.5rem 1rem",
          padding: "0.875rem 1rem",
          marginTop: "0.5rem",
          border: "1px solid #e3e3e3",
          backgroundColor: "#ffffff",
        }}
      >
        {entries.map((d) => (
          <div key={d.key}>
            <div style={{ fontSize: "var(--text-body-sm)", color: "#6b6b6b" }}>
              {humanizeKey(d.key)}
            </div>
            <div style={{ marginTop: "0.125rem" }}>{renderValue(d.after)}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function DiffBody({ row }: { row: AuditLogListItem }) {
  const { before, after } = row;

  if (before == null && after == null) {
    return <NoChanges />;
  }

  const beforeOk = before == null || isPlainObj(before);
  const afterOk = after == null || isPlainObj(after);
  if (!beforeOk || !afterOk) {
    return (
      <p style={{ color: "#6b6b6b", fontSize: "var(--text-body-sm)" }}>
        Values are not field-structured — see raw JSON below.
      </p>
    );
  }

  const diffs = buildFieldDiffs(before, after);
  if (diffs.length === 0) {
    return <NoChanges />;
  }

  if (diffs.length > 0 && diffs.every((d) => d.status === "ADDED")) {
    return <CreatedSummary diffs={diffs} />;
  }

  return (
    <div style={{ border: "1px solid #e3e3e3", backgroundColor: "#ffffff" }}>
      {diffs.map((diff, i) => (
        <FieldRow key={diff.key} diff={diff} isFirst={i === 0} />
      ))}
    </div>
  );
}

function EntityLink({
  href,
  label,
  onClose,
}: {
  href: string;
  label: string;
  onClose: () => void;
}) {
  const [hover, setHover] = useState(false);
  return (
    <Link
      href={href}
      onClick={onClose}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: "inline-block",
        marginTop: "0.75rem",
        fontSize: "var(--text-body-sm)",
        color: "inherit",
        textDecoration: hover ? "underline" : "none",
      }}
    >
      View {label} →
    </Link>
  );
}

function TraceLink({
  href,
  onClose,
  children,
}: {
  href: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const [hover, setHover] = useState(false);
  return (
    <Link
      href={href}
      onClick={onClose}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        color: "inherit",
        textDecoration: hover ? "underline" : "none",
        cursor: "pointer",
      }}
    >
      {children}
    </Link>
  );
}

function RawBlock({ label, value }: { label: string; value: unknown }) {
  return (
    <div
      style={{
        border: "1px solid #e3e3e3",
        padding: "0.875rem 1rem",
        backgroundColor: "#ffffff",
      }}
    >
      <div
        style={{
          fontSize: "var(--text-label)",
          fontWeight: "var(--font-semibold)",
          letterSpacing: "var(--tracking-wide)",
          textTransform: "uppercase",
          color: "#6b6b6b",
        }}
      >
        {label}
      </div>
      <pre
        dir="ltr"
        style={{
          margin: 0,
          fontFamily: MONO,
          fontSize: "var(--text-body-sm)",
          overflowX: "auto",
          color: "#0b0b0b",
        }}
      >
        {JSON.stringify(value, null, 2)}
      </pre>
    </div>
  );
}

const labelHeading: React.CSSProperties = {
  fontSize: "var(--text-label)",
  fontWeight: "var(--font-semibold)",
  letterSpacing: "var(--tracking-wide)",
  textTransform: "uppercase",
  color: "#6b6b6b",
};

export default function AuditDiffModal({ row, onClose }: Props) {
  const [rawOpen, setRawOpen] = useState(false);
  const entityHref =
    row != null ? auditEntityHref(row.entityType, row.entityId) : null;

  return (
    <Modal
      open={row != null}
      onClose={onClose}
      ariaLabel="Audit entry details"
      maxWidth={680}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          maxHeight: "calc(100dvh - 3rem)",
        }}
      >
        {row && (
          <>
            <div style={{ padding: "1.75rem 1.5rem 1.5rem", flexShrink: 0 }}>
              <h3
                style={{
                  fontSize: "var(--text-body-lg)",
                  fontWeight: "var(--font-bold)",
                  color: "#0b0b0b",
                  margin: 0,
                }}
              >
                {auditActionLabel(row.action)}
              </h3>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: "0.5rem 1rem",
                  padding: "0.875rem 1rem",
                  marginTop: "0.875rem",
                  border: "1px solid #e3e3e3",
                  backgroundColor: "#ffffff",
                }}
              >
                <InfoCell label="Entity">
                  {auditEntityLabel(row.entityType)}
                </InfoCell>
                {row.entityId != null && (
                  <InfoCell
                    label="Entity ID"
                    dir="ltr"
                    mono
                    valueColor="#9a9a9a"
                  >
                    {row.entityId}
                  </InfoCell>
                )}
                <InfoCell label="Actor">
                  {row.actorId != null ? (
                    <TraceLink
                      href={`/admin/audit?${new URLSearchParams({
                        actorType: row.actorType,
                        actorId: row.actorId,
                      }).toString()}`}
                      onClose={onClose}
                    >
                      {row.actorName}
                    </TraceLink>
                  ) : (
                    row.actorName
                  )}
                </InfoCell>
                <InfoCell label="When">
                  {formatDateTime(row.createdAt, "en")}
                </InfoCell>
              </div>

              {entityHref && (
                <EntityLink
                  href={entityHref}
                  label={auditEntityLabel(row.entityType)}
                  onClose={onClose}
                />
              )}
            </div>

            <div
              style={{
                padding: "0 1.5rem 1.25rem",
                overflowY: "auto",
                flex: 1,
              }}
            >
              <DiffBody row={row} />

              {isPlainObj(row.metadata) &&
                Object.keys(row.metadata).length > 0 && (
                  <div style={{ marginTop: "1.5rem" }}>
                    <h4 style={{ margin: 0, ...labelHeading }}>Metadata</h4>
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "1fr 1fr",
                        gap: "0.5rem 1rem",
                        padding: "0.875rem 1rem",
                        marginTop: "0.5rem",
                        border: "1px solid #e3e3e3",
                        backgroundColor: "#ffffff",
                      }}
                    >
                      {(() => {
                        const sourceIdVal = row.metadata.sourceId;
                        const hasSourceId =
                          typeof sourceIdVal === "string" &&
                          sourceIdVal.length > 0;
                        return Object.entries(row.metadata).map(
                          ([key, value]) => {
                            const isSourceKey =
                              key === "sourceId" || key === "sourceCode";
                            const linkable =
                              isSourceKey &&
                              hasSourceId &&
                              typeof value === "string" &&
                              value.length > 0;
                            return (
                              <div key={key}>
                                <div
                                  style={{
                                    fontSize: "var(--text-body-sm)",
                                    color: "#6b6b6b",
                                  }}
                                >
                                  {humanizeKey(key)}
                                </div>
                                <div style={{ marginTop: "0.125rem" }}>
                                  {linkable ? (
                                    <TraceLink
                                      href={`/admin/audit?${new URLSearchParams(
                                        {
                                          entityType: "Coupon",
                                          entityId: sourceIdVal as string,
                                        },
                                      ).toString()}`}
                                      onClose={onClose}
                                    >
                                      {renderValue(value)}
                                    </TraceLink>
                                  ) : (
                                    renderValue(value)
                                  )}
                                </div>
                              </div>
                            );
                          },
                        );
                      })()}
                    </div>
                  </div>
                )}

              <button
                type="button"
                onClick={() => setRawOpen((o) => !o)}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  height: "2.5rem",
                  paddingInline: "1.25rem",
                  marginTop: "1.25rem",
                  fontSize: "var(--text-body-sm)",
                  color: "#ffffff",
                  backgroundColor: "black",
                  border: "1px solid #e3e3e3",
                  borderRadius: 0,
                  cursor: "pointer",
                }}
              >
                {rawOpen ? "Hide raw data" : "Show raw data"}
              </button>

              {rawOpen && (
                <div
                  style={{
                    marginTop: "0.625rem",
                    display: "flex",
                    flexDirection: "column",
                    gap: "0.75rem",
                  }}
                >
                  <RawBlock label="Before" value={row.before} />
                  <RawBlock label="After" value={row.after} />
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}

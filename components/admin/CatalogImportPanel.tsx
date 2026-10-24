"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import DataTable from "@/components/admin/DataTable";
import {
  checkCatalogImportAction,
  commitCatalogImportAction,
  prepareCatalogImageUploadsAction,
} from "@/lib/actions/catalog-import";
import {
  MAX_IMPORT_FILE_BYTES,
  MAX_IMPORT_REQUEST_BYTES,
  columnLabel,
  issuesToCsv,
  type CatalogImportImageFile,
  type CatalogImportSummary,
  type ImportChange,
  type ImportIssue,
} from "@/lib/utils/catalog-import";
import { uploadImportImages } from "@/lib/utils/catalog-image-upload";
import { sniffImageType, type ImportImageTarget, type ImportImageType } from "@/lib/utils/image-sniff";

type Phase = "idle" | "checking" | "checked" | "committing" | "committed";

type CommitDone = {
  batchId: string;
  fileName: string;
  created: number;
  updated: number;
  unchanged: number;
};

const PROBLEMS_PREVIEW = 100;
const MAX_IMAGE_FILES = 2000;
const IMAGES_HELP =
  "For the photos your workbook names: gallery photos on the Images sheet. Each file name must match the workbook exactly, extension included. JPG, PNG or WebP, up to 5 MB each. Photos already in a product's gallery don't need selecting again. Leave this empty if the workbook changes no images.";
const REQUEST_TOO_LARGE =
  "This import is too large to send in one go. Split the workbook or its images into smaller imports.";

function requestBytes(fileBytes: number, jsonFields: string[]): number {
  return jsonFields.reduce((sum, f) => sum + new TextEncoder().encode(f).length, fileBytes);
}
const RED = "#991b1b";

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
  backgroundColor: "#0b0b0b",
  color: "#ffffff",
  textDecoration: "none",
  borderRadius: "0",
  border: "none",
  cursor: "pointer",
};

const secondaryBtn: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  height: "2.25rem",
  paddingInline: 0,
  fontSize: "var(--text-body-sm)",
  fontWeight: "var(--font-semibold)",
  border: "none",
  borderRadius: "0",
  textDecoration: "underline",
  textUnderlineOffset: "3px",
  color: "#0b0b0b",
  backgroundColor: "transparent",
  cursor: "pointer",
};

const textBtn: React.CSSProperties = {
  background: "none",
  border: "none",
  padding: 0,
  fontSize: "var(--text-body-sm)",
  fontWeight: "var(--font-semibold)",
  color: "#0b0b0b",
  textDecoration: "underline",
  cursor: "pointer",
};

const mono: React.CSSProperties = {
  color: "#0b0b0b",
  fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
  fontSize: "var(--text-body-sm)",
};

const visuallyHidden: React.CSSProperties = {
  position: "absolute",
  width: 1,
  height: 1,
  margin: -1,
  padding: 0,
  overflow: "hidden",
  clip: "rect(0 0 0 0)",
  whiteSpace: "nowrap",
  border: 0,
};

const STEPS = ["Template", "Check file", "Review", "Commit"];

const STATUS_LABEL = {
  DRAFT: "Draft",
  PUBLISHED: "Published",
  ARCHIVED: "Archived",
} as const;

function plural(n: number, one: string, many: string) {
  return `${n} ${n === 1 ? one : many}`;
}

function formatSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function StepBar({ current, allDone }: { current: number; allDone: boolean }) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(4, 1fr)",
        backgroundColor: "#ffffff",
        border: "1px solid var(--color-shop-divider)",
      }}
    >
      {STEPS.map((label, i) => {
        const done = allDone || i < current;
        const active = !allDone && i === current;
        return (
          <div
            key={label}
            style={{
              padding: "0.75rem 1rem",
              fontSize: "var(--text-body-sm)",
              fontWeight: active ? "var(--font-semibold)" : "var(--font-normal)",
              color: active ? "#0b0b0b" : "#4b4b4b",
              boxShadow: active
                ? "inset 0 -2px 0 var(--color-action-primary)"
                : undefined,
              borderInlineStart:
                i > 0 ? "1px solid var(--color-shop-divider)" : undefined,
            }}
          >
            <span
              style={{
                marginInlineEnd: "0.5rem",
                color: active ? "#0b0b0b" : "#4b4b4b",
              }}
            >
              {done ? "✓" : i + 1}
            </span>
            {label}
          </div>
        );
      })}
    </div>
  );
}

function Stat({
  label,
  value,
  danger,
}: {
  label: string;
  value: number;
  danger?: boolean;
}) {
  return (
    <div
      style={{
        backgroundColor: "#ffffff",
        border: `1px solid ${danger ? RED : "var(--color-shop-divider)"}`,
        padding: "1.25rem 1.5rem",
      }}
    >
      <p
        style={{
          fontSize: "var(--text-label)",
          fontWeight: "var(--font-semibold)",
          letterSpacing: "var(--tracking-wide)",
          textTransform: "uppercase",
          color: danger ? RED : "#4b4b4b",
          marginBottom: "0.5rem",
        }}
      >
        {label}
      </p>
      <p
        style={{
          fontSize: "var(--text-heading)",
          fontWeight: "var(--font-bold)",
          color: danger ? RED : "#0b0b0b",
          lineHeight: "var(--leading-tight)",
        }}
      >
        {value}
      </p>
    </div>
  );
}

function Pill({ color, bg, children }: { color: string; bg: string; children: React.ReactNode }) {
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

function changesCell(change: ImportChange) {
  if (change.action === "create") {
    const parts: string[] = [`Status ${STATUS_LABEL[change.publishStatus]}`];
    if (change.openingStock !== null && change.openingStock > 0) {
      parts.push(`opening stock ${change.openingStock}`);
    }
    if (change.specRows !== null && change.specRows > 0) {
      parts.push(plural(change.specRows, "specification", "specifications"));
    }
    if (change.imageRows !== null && change.imageRows > 0) {
      parts.push(`Images: ${change.imageRows}`);
    }
    if (change.accessoryRows !== null && change.accessoryRows > 0) {
      parts.push(`Accessories: ${change.accessoryRows}`);
    }
    return <span style={{ color: "#0b0b0b" }}>{parts.join(" · ")}</span>;
  }
  const fieldCount = change.fields.filter(
    (f) => f.column !== "specs" && f.column !== "images" && f.column !== "accessories",
  ).length;
  const hasSpecs = change.fields.some((f) => f.column === "specs");
  const hasImages = change.fields.some((f) => f.column === "images");
  const hasAccessories = change.fields.some((f) => f.column === "accessories");
  const detailText =
    fieldCount > 0
      ? `${plural(fieldCount, "detail", "details")}${hasSpecs ? " and specifications" : ""}`
      : hasSpecs
        ? "Specifications"
        : null;
  const summaryText = [
    detailText,
    hasImages ? "Gallery replaced" : null,
    hasAccessories ? "Accessory list replaced" : null,
  ]
    .filter(Boolean)
    .join(" · ");
  return (
    <details>
      <summary style={{ cursor: "pointer", color: "#0b0b0b" }}>{summaryText}</summary>
      <ul style={{ listStyle: "none", margin: "0.5rem 0 0", padding: 0 }}>
        {change.fields.map((f) => (
          <li key={f.column} style={{ marginBottom: "0.25rem", color: "#0b0b0b" }}>
            <span style={{ fontWeight: "var(--font-semibold)", color: "#0b0b0b" }}>
              {columnLabel(f.column)}:
            </span>
            <span style={{ color: "#4b4b4b" }}>
              {" "}
              {f.from} → {f.to}
            </span>
          </li>
        ))}
      </ul>
    </details>
  );
}

export default function CatalogImportPanel() {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [phase, setPhase] = useState<Phase>("idle");
  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const [clientError, setClientError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [summary, setSummary] = useState<CatalogImportSummary | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [done, setDone] = useState<CommitDone | null>(null);
  const [failedBatchId, setFailedBatchId] = useState<string | null>(null);
  const [images, setImages] = useState<File[]>([]);
  const [imageInfo, setImageInfo] = useState<CatalogImportImageFile[]>([]);
  const [draggingImages, setDraggingImages] = useState(false);
  const [imageError, setImageError] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState<{
    done: number;
    total: number;
  } | null>(null);

  function clearImages() {
    setImages([]);
    setImageInfo([]);
    setImageError(null);
    setDraggingImages(false);
  }

  async function selectImages(list: File[]) {
    if (list.length === 0) return;
    setActionError(null);
    setFailedBatchId(null);
    if (list.length > MAX_IMAGE_FILES) {
      setImages([]);
      setImageInfo([]);
      setImageError("Select at most 2,000 images.");
      return;
    }
    const seen = new Set<string>();
    for (const f of list) {
      if (seen.has(f.name)) {
        setImages([]);
        setImageInfo([]);
        setImageError(`Two selected images are both named ${f.name}.`);
        return;
      }
      seen.add(f.name);
    }
    const info = await Promise.all(
      list.map(async (f) => ({
        name: f.name,
        size: f.size,
        type: sniffImageType(new Uint8Array(await f.slice(0, 16).arrayBuffer())),
      })),
    );
    setImageError(null);
    setImages(list);
    setImageInfo(info);
  }

  function reset() {
    setPhase("idle");
    setFile(null);
    clearImages();
    setUploadProgress(null);
    setDragging(false);
    setClientError(null);
    setActionError(null);
    setSummary(null);
    setShowAll(false);
    setConfirmOpen(false);
    setDone(null);
    setFailedBatchId(null);
  }

  function selectFile(f: File | undefined) {
    if (!f) return;
    setActionError(null);
    setFailedBatchId(null);
    if (!/\.xlsx$/i.test(f.name)) {
      setFile(null);
      setClientError("Only .xlsx files can be imported. In Excel choose File › Save As › Excel Workbook (.xlsx).");
      return;
    }
    if (f.size === 0) {
      setFile(null);
      setClientError("This file is empty. Choose the filled-in template.");
      return;
    }
    if (f.size > MAX_IMPORT_FILE_BYTES) {
      setFile(null);
      setClientError("The file is larger than 4 MB. Split it into smaller imports.");
      return;
    }
    setClientError(null);
    setFile(f);
  }

  function runCheck() {
    if (!file) return;
    const chosen = file;
    setActionError(null);
    setFailedBatchId(null);
    const imagesJson = JSON.stringify(imageInfo);
    if (requestBytes(chosen.size, [imagesJson]) > MAX_IMPORT_REQUEST_BYTES) {
      setClientError(REQUEST_TOO_LARGE);
      return;
    }
    setPhase("checking");
    const fd = new FormData();
    fd.set("file", chosen);
    fd.set("images", imagesJson);
    startTransition(async () => {
      const res = await checkCatalogImportAction(fd);
      if (!res.success) {
        setActionError(res.error);
        setPhase("idle");
        return;
      }
      setSummary(res.data);
      setShowAll(false);
      setPhase("checked");
    });
  }

  function runCommit() {
    if (!file || !summary) return;
    const chosen = file;
    const { counts, fileHash, uploads } = summary;
    setConfirmOpen(false);
    setActionError(null);
    const imagesJson = JSON.stringify(imageInfo);
    const estimatedUploadsJson = JSON.stringify(
      uploads.map((u) => ({
        name: u.name,
        target: u.target,
        key: `catalog/${"0".repeat(36)}/${"0".repeat(36)}.${"x".repeat(4)}`,
      })),
    );
    if (requestBytes(chosen.size, [imagesJson, estimatedUploadsJson]) > MAX_IMPORT_REQUEST_BYTES) {
      setActionError(REQUEST_TOO_LARGE);
      return;
    }
    setPhase("committing");
    const fd = new FormData();
    fd.set("file", chosen);
    fd.set("expectedHash", fileHash);
    fd.set("expectedCreate", String(counts.create));
    fd.set("expectedUpdate", String(counts.update));
    fd.set("expectedUnchanged", String(counts.unchanged));
    fd.set("expectedGalleries", String(counts.galleries));
    fd.set("expectedImageRows", String(counts.imageRows));
    fd.set("expectedAccessoryLists", String(counts.accessoryLists));
    fd.set("images", imagesJson);
    startTransition(async () => {
      if (uploads.length > 0) {
        const byName = new Map(images.map((f) => [f.name, f]));
        const infoByName = new Map(imageInfo.map((i) => [i.name, i]));
        const files: {
          name: string;
          size: number;
          type: ImportImageType;
          target: ImportImageTarget;
        }[] = [];
        let missing: string | null = null;
        for (const { name, target } of uploads) {
          const info = infoByName.get(name);
          if (!byName.has(name) || !info || info.type === null) {
            missing = name;
            break;
          }
          files.push({ name, size: info.size, type: info.type, target });
        }
        if (missing !== null) {
          setActionError(`The image ${missing} is no longer selected. Check the file again.`);
          setSummary(null);
          setPhase("idle");
          return;
        }
        const prepared = await prepareCatalogImageUploadsAction({ files });
        if (!prepared.success) {
          setActionError(prepared.error);
          setPhase("checked");
          return;
        }
        setUploadProgress({ done: 0, total: files.length });
        const { failed } = await uploadImportImages(
          prepared.data.uploads,
          byName,
          (done, total) => setUploadProgress({ done, total }),
        );
        setUploadProgress(null);
        if (failed.length > 0) {
          setActionError(
            `${plural(failed.length, "image", "images")} didn't upload. Check your connection and commit again.`,
          );
          setPhase("checked");
          return;
        }
        const uploadsJson = JSON.stringify(
          prepared.data.uploads.map((u) => ({ name: u.name, target: u.target, key: u.key })),
        );
        if (requestBytes(chosen.size, [imagesJson, uploadsJson]) > MAX_IMPORT_REQUEST_BYTES) {
          setActionError(REQUEST_TOO_LARGE);
          setPhase("checked");
          return;
        }
        fd.set("uploadId", prepared.data.uploadId);
        fd.set("uploads", uploadsJson);
      }
      const res = await commitCatalogImportAction(fd);
      if (!res.success) {
        setActionError(res.error);
        setFailedBatchId(res.batchId ?? null);
        setSummary(null);
        setPhase("idle");
        return;
      }
      setDone({
        batchId: res.data.batchId,
        fileName: chosen.name,
        created: res.data.created,
        updated: res.data.updated,
        unchanged: res.data.unchanged,
      });
      setPhase("committed");
      router.refresh();
    });
  }

  function downloadReport(issues: ImportIssue[]) {
    const base = (file?.name ?? summary?.fileName ?? "catalog").replace(/\.xlsx$/i, "");
    const blob = new Blob([issuesToCsv(issues)], {
      type: "text/csv;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${base}-check-report.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  const showUpload = phase === "idle" || phase === "checking";
  const checking = phase === "checking";
  const stepIndex =
    phase === "idle" || phase === "checking" ? 1 : phase === "checked" ? 2 : 3;

  const errorIssues = summary ? summary.issues.filter((i) => i.severity === "error") : [];
  const warningIssues = summary ? summary.issues.filter((i) => i.severity === "warning") : [];
  const shownProblems = showAll ? errorIssues : errorIssues.slice(0, PROBLEMS_PREVIEW);
  const counts = summary?.counts;
  const writesAnything = counts
    ? counts.create + counts.update > 0
    : false;

  const errorLine = actionError ?? clientError ?? imageError;
  const imagesTotalBytes = images.reduce((sum, f) => sum + f.size, 0);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      <StepBar current={stepIndex} allDone={phase === "committed"} />

      {showUpload && (
        <div style={card}>
          <label
            onDragOver={(e) => {
              e.preventDefault();
              if (!checking) setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              if (!checking) selectFile(e.dataTransfer.files[0]);
            }}
            style={{
              position: "relative",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: "0.375rem",
              padding: "2rem 1rem",
              textAlign: "center",
              border: `1px dashed ${dragging ? "#0b0b0b" : "#b5b5b5"}`,
              cursor: checking ? "not-allowed" : "pointer",
            }}
          >
            <input
              type="file"
              accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              disabled={checking}
              style={visuallyHidden}
              onChange={(e) => {
                const chosen = e.target.files?.[0];
                selectFile(chosen);
                e.target.value = "";
              }}
            />
            {file ? (
              <>
                <span style={{ fontWeight: "var(--font-semibold)", color: "#0b0b0b" }}>
                  {file.name}
                </span>
                <span style={{ fontSize: "var(--text-body-sm)", color: "#4b4b4b" }}>
                  {formatSize(file.size)}
                </span>
                <span style={{ fontSize: "var(--text-body-sm)", fontWeight: "var(--font-semibold)", textDecoration: "underline", color: "#0b0b0b" }}>
                  Change file
                </span>
              </>
            ) : (
              <>
                <span style={{ fontWeight: "var(--font-semibold)", color: "#0b0b0b" }}>
                  Drop your filled-in template here, or click to choose a file
                </span>
                <span style={{ fontSize: "var(--text-body-sm)", color: "#4b4b4b" }}>
                  .xlsx, up to 4 MB
                </span>
              </>
            )}
          </label>
          <p style={{ ...eyebrow, marginTop: "1.25rem", marginBottom: "0.5rem" }}>
            Images (optional)
          </p>
          <label
            onDragOver={(e) => {
              e.preventDefault();
              if (!checking) setDraggingImages(true);
            }}
            onDragLeave={() => setDraggingImages(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDraggingImages(false);
              if (!checking) void selectImages(Array.from(e.dataTransfer.files));
            }}
            style={{
              position: "relative",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: "0.375rem",
              padding: "2rem 1rem",
              textAlign: "center",
              border: `1px dashed ${draggingImages ? "#0b0b0b" : "#b5b5b5"}`,
              cursor: checking ? "not-allowed" : "pointer",
            }}
          >
            <input
              type="file"
              multiple
              accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
              disabled={checking}
              style={visuallyHidden}
              onChange={(e) => {
                const chosen = Array.from(e.target.files ?? []);
                void selectImages(chosen);
                e.target.value = "";
              }}
            />
            {images.length > 0 ? (
              <>
                <span style={{ fontWeight: "var(--font-semibold)", color: "#0b0b0b" }}>
                  {plural(images.length, "image", "images")} · {formatSize(imagesTotalBytes)}
                </span>
                <span style={{ fontSize: "var(--text-body-sm)", fontWeight: "var(--font-semibold)", textDecoration: "underline", color: "#0b0b0b" }}>
                  Change images
                </span>
              </>
            ) : (
              <>
                <span style={{ fontWeight: "var(--font-semibold)", color: "#0b0b0b" }}>
                  Drop the image files here, or click to choose them
                </span>
                <span style={{ fontSize: "var(--text-body-sm)", color: "#4b4b4b" }}>
                  JPG, PNG or WebP, up to 5 MB each
                </span>
              </>
            )}
          </label>
          {images.length > 0 && (
            <div style={{ marginTop: "0.75rem" }}>
              <button
                type="button"
                onClick={clearImages}
                disabled={checking}
                style={secondaryBtn}
              >
                Clear
              </button>
            </div>
          )}
          <p style={{ marginTop: "0.75rem", fontSize: "var(--text-body-sm)", color: "#4b4b4b" }}>
            {IMAGES_HELP}
          </p>
          <p style={{ marginTop: "0.75rem", fontSize: "var(--text-body-sm)", color: "#4b4b4b" }}>
            Checking writes nothing. Every row is checked against the same rules as the product form.
          </p>
          {errorLine && (
            <p role="alert" style={{ marginTop: "0.75rem", fontSize: "var(--text-body-sm)", color: RED }}>
              {errorLine}
            </p>
          )}
          {failedBatchId && (
            <p style={{ marginTop: "0.5rem", fontSize: "var(--text-body-sm)", color: "#4b4b4b" }}>
              This attempt is saved in the import history.{" "}
              <Link
                href={`/admin/import/${failedBatchId}`}
                style={{ color: "var(--color-action-primary)" }}
              >
                View details
              </Link>
            </p>
          )}
          <div style={{ marginTop: "1rem" }}>
            <button
              type="button"
              onClick={runCheck}
              disabled={!file || checking}
              style={{
                ...commitBtn,
                opacity: !file || checking ? 0.6 : 1,
                cursor: !file || checking ? "not-allowed" : "pointer",
              }}
            >
              {checking ? "Checking…" : "Check file"}
            </button>
          </div>
        </div>
      )}

      {summary?.refused && (phase === "checked" || phase === "committing") && (
        <div style={{ ...card, borderInlineStart: `3px solid ${RED}` }}>
          <p style={{ ...eyebrow, color: RED }}>This file can&apos;t be checked</p>
          <ul style={{ listStyle: "none", margin: "0.75rem 0 0", padding: 0 }}>
            {summary.issues.map((issue, i) => (
              <li key={i} style={{ marginBottom: "0.625rem", color: "#0b0b0b" }}>
                <p style={{ color: "#0b0b0b" }}>{issue.problem}</p>
                {issue.fix && (
                  <p style={{ fontSize: "var(--text-body-sm)", color: "#4b4b4b" }}>
                    How to fix: {issue.fix}
                  </p>
                )}
              </li>
            ))}
          </ul>
          <div style={{ marginTop: "1rem" }}>
            <button type="button" onClick={reset} style={secondaryBtn}>
              Check another file
            </button>
          </div>
        </div>
      )}

      {summary && counts && !summary.refused && (phase === "checked" || phase === "committing") && (
        <>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(10rem, 1fr))",
              gap: "1rem",
            }}
          >
            <Stat label="Create" value={counts.create} />
            <Stat label="Update" value={counts.update} />
            <Stat label="Unchanged" value={counts.unchanged} />
            <Stat label="Galleries" value={counts.galleries} />
            <Stat label="Accessory lists" value={counts.accessoryLists} />
            <Stat label="Warnings" value={counts.warnings} />
            <Stat label="Problems" value={counts.errors} danger={counts.errors > 0} />
          </div>

          {counts.errors > 0 && (
            <div style={card}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: "1rem",
                  marginBottom: "1rem",
                  flexWrap: "wrap",
                }}
              >
                <p style={{ ...eyebrow, color: RED }}>
                  {plural(counts.errors, "problem", "problems")} to fix · nothing can be imported yet
                </p>
                <button
                  type="button"
                  onClick={() => downloadReport(summary.issues)}
                  style={{
                    ...commitBtn,
                    backgroundColor: "var(--color-action-primary)",
                    color: "#ffffff",
                  }}
                >
                  Download problem report
                </button>
              </div>
              <DataTable
                rows={shownProblems.map((issue, i) => ({ issue, i }))}
                getRowKey={(r) => String(r.i)}
                columns={[
                  {
                    key: "where",
                    header: "Where in your file",
                    render: ({ issue }) => (
                      <div>
                        <p style={{ color: "#0b0b0b" }}>
                          {issue.sheet === null
                            ? "Whole file"
                            : issue.row === null
                              ? `${issue.sheet} sheet`
                              : `${issue.sheet} sheet · row ${issue.row}`}
                        </p>
                        {issue.column && (
                          <p style={{ color: "#0b0b0b" }}>{columnLabel(issue.column)}</p>
                        )}
                        {issue.column && (
                          <p style={{ ...mono, color: "#4b4b4b" }}>column {issue.column}</p>
                        )}
                      </div>
                    ),
                  },
                  {
                    key: "sku",
                    header: "SKU",
                    render: ({ issue }) => <span style={{ ...mono, color: "#0b0b0b" }}>{issue.sku ?? "—"}</span>,
                  },
                  {
                    key: "found",
                    header: "You entered",
                    render: ({ issue }) => <span style={{ ...mono, color: "#0b0b0b" }}>{issue.found ?? "—"}</span>,
                  },
                  {
                    key: "problem",
                    header: "What's wrong and how to fix it",
                    render: ({ issue }) => (
                      <div>
                        <p style={{ color: "#0b0b0b" }}>{issue.problem}</p>
                        {issue.fix && (
                          <p style={{ fontSize: "var(--text-body-sm)", color: "#4b4b4b" }}>
                            {issue.fix}
                          </p>
                        )}
                      </div>
                    ),
                  },
                ]}
              />
              {!showAll && errorIssues.length > PROBLEMS_PREVIEW && (
                <div style={{ marginTop: "0.75rem" }}>
                  <button type="button" onClick={() => setShowAll(true)} style={textBtn}>
                    Show all {errorIssues.length} problems
                  </button>
                </div>
              )}
              {summary.issuesTruncated && (
                <p style={{ marginTop: "0.75rem", fontSize: "var(--text-body-sm)", color: RED }}>
                  Showing the first 5,000 problems. Fix these and check again.
                </p>
              )}
              <p style={{ marginTop: "0.75rem", fontSize: "var(--text-body-sm)", color: "#4b4b4b" }}>
                Fix these in your file, save it, and check it again.
              </p>
              <div style={{ marginTop: "1rem" }}>
                <button type="button" onClick={reset} style={secondaryBtn}>
                  Check another file
                </button>
              </div>
            </div>
          )}

          {counts.warnings > 0 && (
            <div
              style={{
                backgroundColor: "#fffbeb",
                border: "1px solid #fde68a",
                padding: "1.25rem 1.5rem",
              }}
            >
              <p style={{ ...eyebrow, color: "#92400e" }}>
                {plural(counts.warnings, "warning", "warnings")} · these don&apos;t block the import
              </p>
              <ul
                style={{
                  listStyle: "none",
                  margin: "0.75rem 0 0",
                  padding: 0,
                  maxHeight: "16rem",
                  overflowY: "auto",
                  color: "#78350f",
                  fontSize: "var(--text-body-sm)",
                }}
              >
                {warningIssues.map((w, i) => {
                  const label = [
                    w.row !== null ? `Row ${w.row}` : null,
                    w.sku,
                    columnLabel(w.column),
                  ]
                    .filter(Boolean)
                    .join(" · ");
                  const prefix = w.sheet !== null || w.row !== null ? label : (w.found ?? "");
                  return (
                    <li key={i} style={{ marginBottom: "0.375rem", color: "#78350f" }}>
                      {prefix !== "" ? `${prefix}: ` : ""}
                      {w.problem} {w.fix ?? ""}
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          {counts.errors === 0 && writesAnything && (
            <div style={card}>
              <p style={{ ...eyebrow, color: "var(--color-action-primary)", marginBottom: "1rem" }}>What will change</p>
              {summary.changes.length > 0 && (
              <DataTable
                rows={summary.changes}
                getRowKey={(c) => `${c.sku}-${c.row ?? "specs"}`}
                columns={[
                  {
                    key: "sku",
                    header: "SKU",
                    render: (c) => <span style={{ ...mono, color: "#0b0b0b" }}>{c.sku}</span>,
                  },
                  {
                    key: "action",
                    header: "Action",
                    render: (c) =>
                      c.action === "create" ? (
                        <Pill color="#166534" bg="#dcfce7">New</Pill>
                      ) : (
                        <Pill color="#1e40af" bg="#dbeafe">Update</Pill>
                      ),
                  },
                  { key: "name", header: "Product", render: (c) => c.name },
                  { key: "changes", header: "Changes", render: (c) => changesCell(c) },
                ]}
              />
              )}
              {actionError && (
                <p role="alert" style={{ marginTop: "0.75rem", fontSize: "var(--text-body-sm)", color: RED }}>
                  {actionError}
                </p>
              )}
              {uploadProgress && (
                <p style={{ marginTop: "0.75rem", fontSize: "var(--text-body-sm)", color: "#4b4b4b" }}>
                  Uploading images {uploadProgress.done} of {uploadProgress.total}
                </p>
              )}
              <div style={{ marginTop: "1rem", display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
                <button type="button" onClick={reset} style={secondaryBtn}>
                  Check another file
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmOpen(true)}
                  disabled={phase === "committing"}
                  style={{
                    ...commitBtn,
                    opacity: phase === "committing" ? 0.6 : 1,
                    cursor: phase === "committing" ? "not-allowed" : "pointer",
                  }}
                >
                  {uploadProgress ? "Uploading images…" : "Commit import"}
                </button>
              </div>
            </div>
          )}

          {counts.errors === 0 && !writesAnything && (
            <div style={card}>
              <p style={{ color: "#0b0b0b" }}>
                Nothing to change. Everything in this file already matches the store.
              </p>
              <div style={{ marginTop: "1rem" }}>
                <button type="button" onClick={reset} style={secondaryBtn}>
                  Check another file
                </button>
              </div>
            </div>
          )}

          <ConfirmDialog
            open={confirmOpen}
            onClose={() => setConfirmOpen(false)}
            onConfirm={runCommit}
            destructive={false}
            title="Commit this import?"
            message={`${plural(counts.create, "product is", "products are")} created and ${counts.update} updated, with ${plural(counts.specTables, "spec table", "spec tables")} and ${plural(counts.galleries, "gallery", "galleries")} written, with ${plural(counts.accessoryLists, "accessory list", "accessory lists")} replaced. All of it applies or none of it does. Stock of existing products is never changed.`}
            confirmLabel="Commit import"
            cancelLabel="Cancel"
            isPending={phase === "committing"}
          />
        </>
      )}

      {phase === "committed" && done && (
        <div style={{ ...card, borderInlineStart: "3px solid #166534" }}>
          <p style={{ ...eyebrow, color: "#166534" }}>Import committed</p>
          <p style={{ marginTop: "0.5rem", color: "#0b0b0b" }}>
            {done.fileName} · {done.created} created, {done.updated} updated, {done.unchanged} unchanged. New products are drafts unless the file set a status.
          </p>
          <div style={{ marginTop: "1rem", display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
            <Link href="/admin/products" style={commitBtn}>
              View products
            </Link>
            <Link href={`/admin/import/${done.batchId}`} style={secondaryBtn}>
              View import
            </Link>
            <button type="button" onClick={reset} style={secondaryBtn}>
              Import another file
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

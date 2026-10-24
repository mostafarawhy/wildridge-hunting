"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/Toast";
import { mintOrderComplianceDocumentUrl } from "@/lib/actions/admin-documents";
import { archiveOrderComplianceAction } from "@/lib/actions/order-fulfilment";

interface TileProps {
  orderId: string;
  documentId: string;
  label: string;
  filename: string;
  mimeType: string | null;
  declaredNumber: string | null;
  copiedOn: string | null;
  canAccess: boolean;
  hiddenReason: string;
}

const btnBase: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  height: "2rem",
  paddingInline: "0.875rem",
  fontSize: "var(--text-body-sm)",
  fontWeight: "var(--font-bold)",
  letterSpacing: "var(--tracking-widest)",
  textTransform: "uppercase",
  backgroundColor: "#0b0b0b",
  color: "#ffffff",
  border: "none",
  borderRadius: "0",
  cursor: "pointer",
  textDecoration: "none",
};

function extOf(filename: string): string {
  const m = filename.toLowerCase().match(/\.([a-z0-9]+)$/);
  return m ? m[1].toUpperCase() : "";
}

function isImage(mimeType: string | null, filename: string): boolean {
  if (mimeType) return mimeType.startsWith("image/");
  return [".jpg", ".jpeg", ".png", ".webp", ".gif"].some((ext) =>
    filename.toLowerCase().endsWith(ext),
  );
}

export default function ComplianceDocumentTile({
  orderId,
  documentId,
  label,
  filename,
  mimeType,
  declaredNumber,
  copiedOn,
  canAccess,
  hiddenReason,
}: TileProps) {
  const imageDoc = isImage(mimeType, filename);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (!canAccess || !imageDoc) return;
    let cancelled = false;
    mintOrderComplianceDocumentUrl(orderId, documentId, "preview").then(
      (result) => {
        if (cancelled) return;
        if (result.success) setPreviewUrl(result.data.url);
        else setFailed(true);
      },
    );
    return () => {
      cancelled = true;
    };
  }, [orderId, documentId, canAccess, imageDoc]);

  async function open() {
    setPending(true);
    const result = await mintOrderComplianceDocumentUrl(
      orderId,
      documentId,
      "view",
    );
    setPending(false);
    if (!result.success) {
      setFailed(true);
      return;
    }
    window.open(result.data.url, "_blank", "noopener,noreferrer");
  }

  async function download() {
    setPending(true);
    const result = await mintOrderComplianceDocumentUrl(
      orderId,
      documentId,
      "download",
    );
    setPending(false);
    if (!result.success) {
      setFailed(true);
      return;
    }
    const a = window.document.createElement("a");
    a.href = result.data.url;
    a.download = filename;
    window.document.body.appendChild(a);
    a.click();
    window.document.body.removeChild(a);
  }

  const boxBase: React.CSSProperties = {
    width: "96px",
    height: "96px",
    flexShrink: 0,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    border: "1px solid var(--color-shop-divider)",
    backgroundColor: "#f5f5f5",
    fontSize: "var(--text-label)",
    color: "#6b6b6b",
    textTransform: "uppercase",
  };

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "1rem",
        flexWrap: "wrap",
        padding: "0.875rem 0",
      }}
    >
      {canAccess && imageDoc && previewUrl ? (
        <img
          src={previewUrl}
          alt={label}
          draggable={false}
          style={{
            width: "96px",
            height: "96px",
            objectFit: "cover",
            display: "block",
            flexShrink: 0,
          }}
        />
      ) : (
        <div style={boxBase}>
          {!canAccess ? "Hidden" : imageDoc ? (failed ? "Unavailable" : "") : extOf(filename)}
        </div>
      )}

      <div style={{ flex: "1 1 0", minWidth: "160px" }}>
        <p
          style={{
            fontSize: "var(--text-body)",
            fontWeight: "var(--font-medium)",
            color: "#0b0b0b",
            margin: 0,
          }}
        >
          {label}
        </p>
        <p
          dir="ltr"
          style={{
            fontSize: "var(--text-label)",
            color: "#6b6b6b",
            margin: "0.125rem 0 0",
            textAlign: "start",
          }}
        >
          {filename}
        </p>
        {declaredNumber && canAccess && (
          <p
            dir="ltr"
            style={{
              fontSize: "var(--text-body-sm)",
              color: "#0b0b0b",
              fontFamily: "var(--font-mono)",
              margin: "0.25rem 0 0",
              textAlign: "start",
            }}
          >
            {declaredNumber}
          </p>
        )}
        <p
          style={{
            fontSize: "var(--text-body-sm)",
            color: copiedOn ? "#6b6b6b" : "#92400e",
            margin: "0.25rem 0 0",
          }}
        >
          {copiedOn ? `Copied to this order on ${copiedOn}` : "Not copied yet"}
        </p>
        {!canAccess && (
          <p
            style={{
              fontSize: "var(--text-body-sm)",
              color: "#6b6b6b",
              margin: "0.25rem 0 0",
            }}
          >
            {hiddenReason}
          </p>
        )}
      </div>

      {canAccess &&
        (failed ? (
          <span style={{ fontSize: "var(--text-body-sm)", color: "#6b6b6b" }}>
            Unavailable
          </span>
        ) : (
          <span style={{ display: "inline-flex", gap: "0.5rem" }}>
            <button
              type="button"
              onClick={open}
              disabled={pending}
              style={{ ...btnBase, opacity: pending ? 0.6 : 1 }}
            >
              Open
            </button>
            <button
              type="button"
              onClick={download}
              disabled={pending}
              style={{ ...btnBase, opacity: pending ? 0.6 : 1 }}
            >
              Download
            </button>
          </span>
        ))}
    </div>
  );
}

export function ArchiveNowButton({
  orderId,
  label = "Archive now",
}: {
  orderId: string;
  label?: string;
}) {
  const router = useRouter();
  const toast = useToast();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function run() {
    setError(null);
    startTransition(async () => {
      const result = await archiveOrderComplianceAction({ orderId });
      if (!result.success) {
        setError(result.error);
        return;
      }
      if (result.data.failed > 0) {
        setError(
          `${result.data.archived} copied, ${result.data.failed} could not be copied. Try again.`,
        );
      } else {
        toast.success("Documents copied to this order.");
      }
      router.refresh();
    });
  }

  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: "0.75rem" }}>
      <button
        type="button"
        onClick={run}
        disabled={isPending}
        style={{
          ...btnBase,
          height: "2.5rem",
          paddingInline: "1.25rem",
          opacity: isPending ? 0.6 : 1,
          cursor: isPending ? "not-allowed" : "pointer",
        }}
      >
        {label}
      </button>
      {error && (
        <span style={{ fontSize: "var(--text-body-sm)", color: "#991b1b" }}>
          {error}
        </span>
      )}
    </span>
  );
}

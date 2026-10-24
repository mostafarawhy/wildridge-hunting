"use client";

import { useState } from "react";
import { mintPaymentProofUrl } from "@/lib/actions/admin-documents";

interface Props {
  orderId: string;
  paymentId: string;
  filename: string;
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
  border: "none",
  borderRadius: "0",
  cursor: "pointer",
  textDecoration: "none",
};

function OpenControl({
  orderId,
  paymentId,
}: {
  orderId: string;
  paymentId: string;
}) {
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(false);

  async function handleClick() {
    setPending(true);
    const result = await mintPaymentProofUrl(orderId, paymentId, "view");
    setPending(false);
    if (!result.success) {
      setFailed(true);
      return;
    }
    window.open(result.data.url, "_blank", "noopener,noreferrer");
  }

  if (failed) {
    return (
      <span style={{ fontSize: "var(--text-body-sm)", color: "#6b6b6b" }}>
        Unavailable
      </span>
    );
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={pending}
      style={{
        ...btnBase,
        backgroundColor: "#0b0b0b",
        color: "#ffffff",
      }}
    >
      Open
    </button>
  );
}

function DownloadControl({
  orderId,
  paymentId,
  filename,
}: {
  orderId: string;
  paymentId: string;
  filename: string;
}) {
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(false);

  async function handleClick() {
    setPending(true);
    const result = await mintPaymentProofUrl(orderId, paymentId, "download");
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

  if (failed) {
    return (
      <span style={{ fontSize: "var(--text-body-sm)", color: "#6b6b6b" }}>
        Unavailable
      </span>
    );
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={pending}
      style={{
        ...btnBase,
        backgroundColor: "#0b0b0b",
        color: "#ffffff",
      }}
    >
      Download
    </button>
  );
}

export default function PaymentProofActions({
  orderId,
  paymentId,
  filename,
}: Props) {
  return (
    <span style={{ display: "inline-flex", gap: "0.5rem" }}>
      <OpenControl orderId={orderId} paymentId={paymentId} />
      <DownloadControl
        orderId={orderId}
        paymentId={paymentId}
        filename={filename}
      />
    </span>
  );
}

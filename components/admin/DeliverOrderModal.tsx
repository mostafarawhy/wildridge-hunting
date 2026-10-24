"use client";

import { useState, useTransition } from "react";
import {
  markOrderDeliveredAction,
  recordDeliveryDetailsAction,
} from "@/lib/actions/order-fulfilment";
import { mintDeliveryProofUrl } from "@/lib/actions/admin-documents";
import { dubaiDay } from "@/lib/utils/date";
import AdminFileField from "@/components/admin/AdminFileField";

interface Props {
  orderId: string;
  mode: "deliver" | "details";
  regulated: boolean;
  loyaltyPoints: number;
  onClose: () => void;
  onSuccess: () => void;
}

const MAX_PROOF_BYTES = 5 * 1024 * 1024;

const btnBase: React.CSSProperties = {
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
  transition: "opacity 150ms",
};

const textAction: React.CSSProperties = {
  backgroundColor: "transparent",
  color: "#0b0b0b",
  border: "none",
  paddingInline: 0,
  textDecoration: "underline",
  textUnderlineOffset: "3px",
};

const fieldStyle: React.CSSProperties = {
  width: "100%",
  padding: "0.5rem 0.625rem",
  fontSize: "var(--text-body)",
  color: "#0b0b0b",
  backgroundColor: "#ffffff",
  border: "1px solid var(--color-shop-divider)",
  borderRadius: "0",
  outline: "none",
  boxSizing: "border-box",
};

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: "var(--text-body-sm)",
  color: "#0b0b0b",
  marginBottom: "0.25rem",
};

const errorStyle: React.CSSProperties = {
  fontSize: "var(--text-body-sm)",
  color: "#991b1b",
  marginTop: "0.25rem",
};

export default function DeliverOrderModal({
  orderId,
  mode,
  regulated,
  loyaltyPoints,
  onClose,
  onSuccess,
}: Props) {
  const [isPending, startTransition] = useTransition();
  const todayDubai = dubaiDay(new Date());

  const [deliveredOn, setDeliveredOn] = useState(todayDubai);
  const [receivedBy, setReceivedBy] = useState("");
  const [idChecked, setIdChecked] = useState(false);
  const [proof, setProof] = useState<File | null>(null);
  const [note, setNote] = useState("");
  const [proofError, setProofError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const idLabel = regulated
    ? "The recipient's ID was checked against the buyer's verified identity at handover."
    : "The recipient's ID was checked at handover.";

  function handleProof(file: File) {
    if (file.size > MAX_PROOF_BYTES) {
      setProof(null);
      setProofError("Proof must be 5 MB or smaller.");
      return;
    }
    if (!["image/jpeg", "image/png", "application/pdf"].includes(file.type)) {
      setProof(null);
      setProofError("Proof must be a JPEG, PNG or PDF.");
      return;
    }
    setProofError(null);
    setProof(file);
  }

  function submit() {
    setError(null);
    if (!deliveredOn) {
      setError("Enter the date the order was delivered.");
      return;
    }
    if (deliveredOn > todayDubai) {
      setError("The delivered date cannot be in the future.");
      return;
    }
    if (receivedBy.trim().length < 2) {
      setError("Enter the name of the person who received the order.");
      return;
    }
    if (regulated && !idChecked) {
      setError("Confirm the recipient's ID was checked before continuing.");
      return;
    }

    const formData = new FormData();
    formData.append("orderId", orderId);
    formData.append("deliveredOn", deliveredOn);
    formData.append("receivedBy", receivedBy.trim());
    if (idChecked) formData.append("idChecked", "true");
    if (note.trim()) formData.append("note", note.trim());
    if (proof) formData.append("proof", proof);
    if (mode === "deliver") formData.append("expectedStatus", "SHIPPED");

    startTransition(async () => {
      const result =
        mode === "deliver"
          ? await markOrderDeliveredAction(formData)
          : await recordDeliveryDetailsAction(formData);
      if (result.success) {
        onSuccess();
      } else {
        setError(result.error);
      }
    });
  }

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 400,
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "center",
        backgroundColor: "rgba(0,0,0,0.5)",
        overflowY: "auto",
      }}
      onClick={isPending ? undefined : onClose}
    >
      <div
        style={{
          backgroundColor: "#ffffff",
          width: "100%",
          maxWidth: "520px",
          padding: "2rem",
          margin: "2rem 1rem",
          position: "relative",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2
          style={{
            fontSize: "var(--text-body-lg)",
            fontWeight: "var(--font-bold)",
            color: "#0b0b0b",
            marginBottom: "0.625rem",
            paddingInlineEnd: "2rem",
          }}
        >
          {mode === "deliver" ? "Mark delivered" : "Add handover details"}
        </h2>
        <p
          style={{
            fontSize: "var(--text-body)",
            color: "#6b6b6b",
            marginBottom: "1.25rem",
            lineHeight: "var(--leading-relaxed)",
          }}
        >
          Record who received the order. This becomes part of the order&apos;s
          compliance record under your name.
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          <div>
            <label htmlFor="do-delivered-on" style={labelStyle}>
              Delivered on
            </label>
            <input
              id="do-delivered-on"
              type="date"
              value={deliveredOn}
              max={todayDubai}
              disabled={isPending}
              onChange={(e) => setDeliveredOn(e.target.value)}
              style={fieldStyle}
            />
          </div>

          <div>
            <label htmlFor="do-received-by" style={labelStyle}>
              Received by
            </label>
            <input
              id="do-received-by"
              type="text"
              value={receivedBy}
              maxLength={120}
              disabled={isPending}
              onChange={(e) => setReceivedBy(e.target.value)}
              style={fieldStyle}
            />
          </div>

          <label
            style={{
              display: "flex",
              gap: "0.625rem",
              alignItems: "flex-start",
              cursor: isPending ? "not-allowed" : "pointer",
            }}
          >
            <input
              type="checkbox"
              checked={idChecked}
              disabled={isPending}
              onChange={(e) => setIdChecked(e.target.checked)}
              style={{ marginTop: "0.2rem", flexShrink: 0 }}
            />
            <span
              style={{
                fontSize: "var(--text-body-sm)",
                color: "#0b0b0b",
                lineHeight: "var(--leading-relaxed)",
              }}
            >
              {idLabel}
              {regulated ? " Required for this order." : ""}
            </span>
          </label>

          <AdminFileField
            name="Proof of delivery (optional)"
            spec="JPEG, PNG or PDF, max 5 MB."
            file={proof}
            onSelect={handleProof}
            onRemove={() => setProof(null)}
            busy={isPending}
            error={proofError}
          />

          <div>
            <label htmlFor="do-note" style={labelStyle}>
              Staff note
            </label>
            <textarea
              id="do-note"
              value={note}
              rows={3}
              maxLength={1000}
              disabled={isPending}
              onChange={(e) => setNote(e.target.value)}
              style={{ ...fieldStyle, resize: "vertical" }}
            />
            <p
              style={{
                fontSize: "var(--text-body-sm)",
                color: "#6b6b6b",
                marginTop: "0.25rem",
              }}
            >
              Staff only. Never shown to the customer.
            </p>
          </div>
        </div>

        {mode === "deliver" && (
          <p
            style={{
              fontSize: "var(--text-body-sm)",
              color: "#0b0b0b",
              marginTop: "1.25rem",
            }}
          >
            {loyaltyPoints > 0
              ? `Delivering credits ${loyaltyPoints.toLocaleString("en-US")} points and emails the customer.`
              : "Delivering emails the customer."}
          </p>
        )}

        {error && <p style={{ ...errorStyle, marginTop: "0.75rem" }}>{error}</p>}

        <div style={{ display: "flex", gap: "0.75rem", marginTop: "1.5rem" }}>
          <button
            type="button"
            onClick={submit}
            disabled={isPending}
            style={{
              ...btnBase,
              backgroundColor: "var(--color-action-primary)",
              color: "#ffffff",
              cursor: isPending ? "not-allowed" : "pointer",
              opacity: isPending ? 0.6 : 1,
            }}
          >
            {mode === "deliver" ? "Mark delivered" : "Save handover details"}
          </button>
          <button
            type="button"
            onClick={onClose}
            disabled={isPending}
            style={{ ...btnBase, ...textAction }}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

const proofBtn: React.CSSProperties = {
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
};

export function DeliveryProofActions({
  orderId,
  filename,
}: {
  orderId: string;
  filename: string;
}) {
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(false);

  async function open() {
    setPending(true);
    const result = await mintDeliveryProofUrl(orderId, "view");
    setPending(false);
    if (!result.success) {
      setFailed(true);
      return;
    }
    window.open(result.data.url, "_blank", "noopener,noreferrer");
  }

  async function download() {
    setPending(true);
    const result = await mintDeliveryProofUrl(orderId, "download");
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
    <span style={{ display: "inline-flex", gap: "0.5rem" }}>
      <button type="button" onClick={open} disabled={pending} style={proofBtn}>
        Open
      </button>
      <button
        type="button"
        onClick={download}
        disabled={pending}
        style={proofBtn}
      >
        Download
      </button>
    </span>
  );
}

"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/Toast";
import { recordOrderSerialsAction } from "@/lib/actions/order-fulfilment";
import {
  noSerialNeedsOverride,
  serialUnitsFor,
} from "@/lib/utils/order-serials";
import type {
  SerialLineInput,
  SerialTrackingKind,
} from "@/lib/utils/order-serials";
import type { OrderStatus } from "@/lib/db/queries/order";

interface FormProps {
  orderId: string;
  expectedStatus: OrderStatus;
  items: SerialLineInput[];
  canOverride: boolean;
  requireComplete?: boolean;
  correction?: boolean;
  saveLabel?: string;
  onSaved: () => void;
  onCancel: () => void;
}

interface UnitDraft {
  value: string;
  noSerial: boolean;
}

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
  cursor: "pointer",
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

const smallText: React.CSSProperties = {
  fontSize: "var(--text-body-sm)",
  color: "#6b6b6b",
  margin: 0,
};

function unitKey(orderItemId: string, unitIndex: number): string {
  return `${orderItemId}:${unitIndex}`;
}

export function SerialCaptureForm({
  orderId,
  expectedStatus,
  items,
  canOverride,
  requireComplete = false,
  correction = false,
  saveLabel,
  onSaved,
  onCancel,
}: FormProps) {
  const toast = useToast();
  const [correctionReason, setCorrectionReason] = useState("");
  const [reasonError, setReasonError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const units = serialUnitsFor(items);

  const [drafts, setDrafts] = useState<Record<string, UnitDraft>>(() => {
    const initial: Record<string, UnitDraft> = {};
    for (const u of units) {
      initial[unitKey(u.orderItemId, u.unitIndex)] = {
        value: u.value ?? "",
        noSerial: u.overrideReason !== null,
      };
    }
    return initial;
  });
  const [unitErrors, setUnitErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);

  function patch(key: string, next: Partial<UnitDraft>) {
    setDrafts((prev) => ({ ...prev, [key]: { ...prev[key], ...next } }));
    setUnitErrors((prev) => {
      if (!(key in prev)) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }

  function applyLotToAll(orderItemId: string, lineUnits: typeof units) {
    const first = drafts[unitKey(orderItemId, 1)]?.value ?? "";
    setDrafts((prev) => {
      const next = { ...prev };
      for (const u of lineUnits) {
        const key = unitKey(u.orderItemId, u.unitIndex);
        next[key] = { ...next[key], value: first, noSerial: false };
      }
      return next;
    });
  }

  function applyNoSerialToAll(lineUnits: typeof units) {
    setDrafts((prev) => {
      const next = { ...prev };
      for (const u of lineUnits) {
        const key = unitKey(u.orderItemId, u.unitIndex);
        next[key] = { ...next[key], value: "", noSerial: true };
      }
      return next;
    });
    setUnitErrors({});
  }

  function noSerialAllowed(tracking: SerialTrackingKind): boolean {
    return !noSerialNeedsOverride(tracking) || canOverride;
  }

  function save() {
    setFormError(null);
    setReasonError(null);

    const reasonTrimmed = correctionReason.trim();
    if (correction && (reasonTrimmed.length < 10 || reasonTrimmed.length > 300)) {
      setReasonError("Give a reason for the correction (10 to 300 characters).");
      return;
    }

    const nextErrors: Record<string, string> = {};
    const payload: {
      orderItemId: string;
      unitIndex: number;
      value?: string;
      noSerial?: true;
    }[] = [];
    let allAnswered = true;

    for (const u of units) {
      const key = unitKey(u.orderItemId, u.unitIndex);
      const draft = drafts[key];
      if (!draft) continue;
      const value = draft.value.trim();
      const answered = draft.noSerial || value.length > 0;
      if (!answered) {
        allAnswered = false;
        if (requireComplete) {
          nextErrors[key] = "Enter a serial or lot number.";
        }
        continue;
      }
      const unchanged = u.recorded
        ? draft.noSerial
          ? u.overrideReason !== null
          : u.value === value
        : false;
      if (unchanged) continue;
      if (draft.noSerial && !noSerialAllowed(u.tracking)) {
        nextErrors[key] =
          "Only staff with override permission can mark this unit as having no serial.";
        continue;
      }
      payload.push(
        draft.noSerial
          ? { orderItemId: u.orderItemId, unitIndex: u.unitIndex, noSerial: true }
          : { orderItemId: u.orderItemId, unitIndex: u.unitIndex, value },
      );
    }

    if (Object.keys(nextErrors).length > 0) {
      setUnitErrors(nextErrors);
      return;
    }
    if (payload.length === 0) {
      if (requireComplete && allAnswered && !correction) {
        onSaved();
        return;
      }
      setFormError("Enter at least one serial or lot number.");
      return;
    }

    startTransition(async () => {
      const result = await recordOrderSerialsAction({
        orderId,
        expectedStatus,
        units: payload,
        ...(correction ? { correctionReason: reasonTrimmed } : {}),
      });
      if (result.success) {
        toast.success(correction ? "Serials corrected." : "Serials saved.");
        onSaved();
        return;
      }
      if (result.errorCode === "NO_CHANGES") {
        onSaved();
        return;
      }
      if (result.unit) {
        setUnitErrors({
          [unitKey(result.unit.orderItemId, result.unit.unitIndex)]:
            result.error,
        });
      } else {
        setFormError(result.error);
      }
    });
  }

  const lineIds = Array.from(new Set(units.map((u) => u.orderItemId)));

  return (
    <div>
      <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
        {lineIds.map((lineId) => {
          const lineUnits = units.filter((u) => u.orderItemId === lineId);
          const head = lineUnits[0];
          const kindLabel = head.kind === "LOT" ? "Lot" : "Serial";
          const lineNoSerialAllowed = noSerialAllowed(head.tracking);
          const fieldLabel =
            head.tracking === "NONE" ? "Serial (if it has one)" : kindLabel;
          return (
            <div key={lineId}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "baseline",
                  gap: "0.75rem",
                  marginBottom: "0.5rem",
                }}
              >
                <p
                  style={{
                    fontSize: "var(--text-body)",
                    fontWeight: "var(--font-semibold)",
                    color: "#0b0b0b",
                    margin: 0,
                  }}
                >
                  {head.name}{" "}
                  <span style={{ ...smallText, fontWeight: "var(--font-regular)" }}>
                    · {head.tracking === "NONE" ? "Serial optional" : kindLabel}{" "}
                    · {lineUnits.length}{" "}
                    {lineUnits.length === 1 ? "unit" : "units"}
                  </span>
                </p>
                <span
                  style={{
                    display: "inline-flex",
                    gap: "1rem",
                    flexWrap: "wrap",
                  }}
                >
                  {head.kind === "LOT" && lineUnits.length > 1 && (
                    <button
                      type="button"
                      disabled={isPending}
                      onClick={() => applyLotToAll(lineId, lineUnits)}
                      style={{ ...textAction, fontSize: "var(--text-body-sm)" }}
                    >
                      Use this lot for every unit
                    </button>
                  )}
                  {lineNoSerialAllowed && lineUnits.length > 1 && (
                    <button
                      type="button"
                      disabled={isPending}
                      onClick={() => applyNoSerialToAll(lineUnits)}
                      style={{ ...textAction, fontSize: "var(--text-body-sm)" }}
                    >
                      No serial for every unit
                    </button>
                  )}
                </span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "0.625rem" }}>
                {lineUnits.map((u) => {
                  const key = unitKey(u.orderItemId, u.unitIndex);
                  const draft = drafts[key];
                  const err = unitErrors[key];
                  const inputId = `serial-${key}`;
                  return (
                    <div key={key}>
                      <label
                        htmlFor={inputId}
                        style={{
                          display: "block",
                          fontSize: "var(--text-body-sm)",
                          color: "#0b0b0b",
                          marginBottom: "0.25rem",
                        }}
                      >
                        {fieldLabel} · unit {u.unitIndex}
                      </label>
                      <input
                        id={inputId}
                        type="text"
                        dir="ltr"
                        value={draft?.value ?? ""}
                        disabled={isPending || (draft?.noSerial ?? false)}
                        maxLength={100}
                        onChange={(e) => patch(key, { value: e.target.value })}
                        style={{
                          ...fieldStyle,
                          backgroundColor: draft?.noSerial ? "#f5f5f5" : "#ffffff",
                          border: `1px solid ${err ? "#991b1b" : "var(--color-shop-divider)"}`,
                        }}
                      />
                      {lineNoSerialAllowed && (
                        <label
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "0.375rem",
                            marginTop: "0.25rem",
                            fontSize: "var(--text-body-sm)",
                            color: "#6b6b6b",
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={draft?.noSerial ?? false}
                            disabled={isPending}
                            onChange={(e) =>
                              patch(
                                key,
                                e.target.checked
                                  ? { noSerial: true, value: "" }
                                  : { noSerial: false },
                              )
                            }
                          />
                          No serial on this item
                        </label>
                      )}
                      {err && (
                        <p
                          style={{
                            fontSize: "var(--text-body-sm)",
                            color: "#991b1b",
                            margin: "0.25rem 0 0",
                          }}
                        >
                          {err}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {correction && (
        <div style={{ marginTop: "1.25rem" }}>
          <label
            htmlFor="serial-correction-reason"
            style={{
              display: "block",
              fontSize: "var(--text-body-sm)",
              color: "#0b0b0b",
              marginBottom: "0.25rem",
            }}
          >
            Reason for the correction
          </label>
          <textarea
            id="serial-correction-reason"
            value={correctionReason}
            rows={3}
            maxLength={300}
            disabled={isPending}
            onChange={(e) => {
              setCorrectionReason(e.target.value);
              setReasonError(null);
            }}
            style={{
              ...fieldStyle,
              resize: "vertical",
              border: `1px solid ${reasonError ? "#991b1b" : "var(--color-shop-divider)"}`,
            }}
          />
          <p
            style={{
              fontSize: "var(--text-body-sm)",
              color: reasonError ? "#991b1b" : "#6b6b6b",
              margin: "0.25rem 0 0",
            }}
          >
            {reasonError ??
              "10 to 300 characters. Recorded on the audit log with your name."}
          </p>
        </div>
      )}

      {formError && (
        <p
          style={{
            fontSize: "var(--text-body-sm)",
            color: "#991b1b",
            marginTop: "0.75rem",
          }}
        >
          {formError}
        </p>
      )}

      <div style={{ display: "flex", gap: "0.75rem", marginTop: "1.5rem" }}>
        <button
          type="button"
          onClick={save}
          disabled={isPending}
          style={{
            ...btnBase,
            backgroundColor: "var(--color-action-primary)",
            color: "#ffffff",
            cursor: isPending ? "not-allowed" : "pointer",
            opacity: isPending ? 0.6 : 1,
          }}
        >
          {saveLabel ?? (correction ? "Save correction" : "Save serials")}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={isPending}
          style={{ ...btnBase, ...textAction }}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

interface ModalProps {
  orderId: string;
  expectedStatus: OrderStatus;
  items: SerialLineInput[];
  canOverride: boolean;
  correction?: boolean;
  onClose: () => void;
}

export default function SerialCaptureModal({
  orderId,
  expectedStatus,
  items,
  canOverride,
  correction = false,
  onClose,
}: ModalProps) {
  const router = useRouter();

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
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: "#ffffff",
          width: "100%",
          maxWidth: "560px",
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
          {correction ? "Correct serials" : "Record serials"}
        </h2>
        <p
          style={{
            fontSize: "var(--text-body)",
            color: "#6b6b6b",
            marginBottom: "1.25rem",
            lineHeight: "var(--leading-relaxed)",
          }}
        >
          {correction
            ? "This order has already shipped. Change only the units that were recorded wrongly. The correction and your reason are kept on the audit log."
            : "Enter the serial or lot number of every unit before this order is packed. Each entry is recorded against your name."}
        </p>
        <SerialCaptureForm
          orderId={orderId}
          expectedStatus={expectedStatus}
          items={items}
          canOverride={canOverride}
          correction={correction}
          onSaved={() => {
            onClose();
            router.refresh();
          }}
          onCancel={onClose}
        />
      </div>
    </div>
  );
}

export function CorrectSerialsButton({
  orderId,
  status,
  items,
  canOverride,
}: {
  orderId: string;
  status: OrderStatus;
  items: SerialLineInput[];
  canOverride: boolean;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        style={{
          ...btnBase,
          backgroundColor: "#0b0b0b",
          color: "#ffffff",
          cursor: "pointer",
        }}
      >
        Correct serials
      </button>
      {open && (
        <SerialCaptureModal
          orderId={orderId}
          expectedStatus={status}
          items={items}
          canOverride={canOverride}
          correction
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}

"use client";

import { useState, useTransition } from "react";
import { transitionOrderAction } from "@/lib/actions/orders";
import { ORDER_STATUS_LABELS } from "@/lib/utils/order-status";
import { isHttpUrl } from "@/lib/utils/tracking-url";
import { dubaiDay } from "@/lib/utils/date";
import { serialsComplete } from "@/lib/utils/order-serials";
import type { SerialLineInput } from "@/lib/utils/order-serials";
import { SerialCaptureForm } from "@/components/admin/SerialCaptureModal";
import type { OrderStatus } from "@/lib/db/queries/order";

interface Props {
  orderId: string;
  fromStatus: OrderStatus;
  target: OrderStatus;
  path: OrderStatus[];
  serialItems: SerialLineInput[];
  canOverrideSerials: boolean;
  onClose: () => void;
  onSuccess: (target: OrderStatus) => void;
}

type Step = "review" | "serials" | "shipment";

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

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "0.5rem 0.75rem",
  fontSize: "var(--text-body)",
  color: "#0b0b0b",
  backgroundColor: "#ffffff",
  border: "1px solid var(--color-shop-divider)",
  borderRadius: "0",
  outline: "none",
  boxSizing: "border-box",
};

const fieldLabel: React.CSSProperties = {
  display: "block",
  fontSize: "var(--text-label)",
  fontWeight: "var(--font-semibold)",
  color: "#6b6b6b",
  marginBottom: "0.375rem",
};

const errorText: React.CSSProperties = {
  fontSize: "var(--text-body-sm)",
  color: "#991b1b",
  marginTop: "0.25rem",
};

export default function MoveOrderModal({
  orderId,
  fromStatus,
  target,
  path,
  serialItems,
  canOverrideSerials,
  onClose,
  onSuccess,
}: Props) {
  const needsShipment = path.includes("SHIPPED");
  const [needsSerials] = useState(
    () => path.includes("READY_TO_SHIP") && !serialsComplete(serialItems),
  );
  const steps: Step[] = [
    ...(path.length > 1 || needsSerials ? (["review"] as Step[]) : []),
    ...(needsSerials ? (["serials"] as Step[]) : []),
    ...(needsShipment ? (["shipment"] as Step[]) : []),
  ];
  const [step, setStep] = useState<Step>(steps[0] ?? "review");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [carrier, setCarrier] = useState("");
  const [trackingNumber, setTrackingNumber] = useState("");
  const [trackingUrl, setTrackingUrl] = useState("");
  const [shippedOn, setShippedOn] = useState(() => dubaiDay(new Date()));
  const [parcels, setParcels] = useState("1");
  const [estimatedDelivery, setEstimatedDelivery] = useState("");
  const [shipmentNote, setShipmentNote] = useState("");
  const [shipmentErrors, setShipmentErrors] = useState<
    Partial<
      Record<
        | "carrier"
        | "trackingNumber"
        | "trackingUrl"
        | "shippedOn"
        | "parcels"
        | "estimatedDelivery",
        string
      >
    >
  >({});
  const todayDubai = dubaiDay(new Date());

  function validateShipment() {
    const errors: typeof shipmentErrors = {};
    const carrierTrimmed = carrier.trim();
    if (carrierTrimmed.length < 2 || carrierTrimmed.length > 80) {
      errors.carrier = "Enter the carrier (2 to 80 characters).";
    }
    if (!trackingNumber.trim()) {
      errors.trackingNumber = "A tracking number is required.";
    }
    const trimmedUrl = trackingUrl.trim();
    if (trimmedUrl && !isHttpUrl(trimmedUrl)) {
      errors.trackingUrl =
        "Enter a full tracking link starting with https:// or http://, or leave it blank.";
    }
    if (!shippedOn) {
      errors.shippedOn = "Enter the date the order shipped.";
    } else if (shippedOn > todayDubai) {
      errors.shippedOn = "The shipped date cannot be in the future.";
    }
    const parcelNumber = Number(parcels);
    if (
      parcels.trim() === "" ||
      !Number.isInteger(parcelNumber) ||
      parcelNumber < 1 ||
      parcelNumber > 50
    ) {
      errors.parcels = "Enter a whole number of parcels from 1 to 50.";
    }
    if (estimatedDelivery && shippedOn) {
      const latest = new Date(
        new Date(`${shippedOn}T00:00:00.000Z`).getTime() + 60 * 864e5,
      )
        .toISOString()
        .slice(0, 10);
      if (estimatedDelivery < shippedOn) {
        errors.estimatedDelivery =
          "Estimated delivery cannot be before the shipped date.";
      } else if (estimatedDelivery > latest) {
        errors.estimatedDelivery =
          "Estimated delivery must be within 60 days of the shipped date.";
      }
    }
    setShipmentErrors(errors);
    return Object.keys(errors).length === 0;
  }

  function submit() {
    setError(null);

    if (needsShipment && !validateShipment()) {
      if (step !== "shipment") setStep("shipment");
      return;
    }

    startTransition(async () => {
      const result = await transitionOrderAction({
        orderId,
        expectedStatus: fromStatus,
        toStatus: target,
        ...(needsShipment
          ? {
              carrier: carrier.trim(),
              trackingNumber: trackingNumber.trim(),
              trackingUrl: trackingUrl.trim() || undefined,
              shippedOn,
              parcelCount: Number(parcels),
              estimatedDelivery: estimatedDelivery || undefined,
              shipmentNote: shipmentNote.trim() || undefined,
            }
          : {}),
      });
      if (result.success) {
        onSuccess(target);
      } else {
        setError(result.error);
      }
    });
  }

  function advance() {
    const next = steps[steps.indexOf(step) + 1];
    if (next) {
      setStep(next);
      return;
    }
    submit();
  }

  function goBack() {
    const prev = steps[steps.indexOf(step) - 1];
    if (prev) setStep(prev);
  }

  const isLastStep = steps.indexOf(step) === steps.length - 1;
  const primaryLabel = isLastStep
    ? `Move to ${ORDER_STATUS_LABELS[target]}`
    : "Continue";

  const chain = path.map((s) => ORDER_STATUS_LABELS[s]).join(" → ");

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
          maxWidth: "480px",
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
          Move to {ORDER_STATUS_LABELS[target]}
        </h2>

        {step === "review" && (
          <>
            <p
              style={{
                fontSize: "var(--text-body)",
                color: "#6b6b6b",
                marginBottom: "1rem",
                lineHeight: "var(--leading-relaxed)",
              }}
            >
              Every status below is logged, each under your name.
            </p>
            <div
              style={{
                backgroundColor: "#f5f5f5",
                border: "1px solid #e3e3e3",
                padding: "0.75rem",
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
                {chain}
              </p>
            </div>
          </>
        )}

        {step === "serials" && (
          <>
            <p
              style={{
                fontSize: "var(--text-body)",
                color: "#6b6b6b",
                marginBottom: "1rem",
                lineHeight: "var(--leading-relaxed)",
              }}
            >
              Record every serial or lot number before this order can be
              packed. They are saved before the order moves.
            </p>
            <SerialCaptureForm
              orderId={orderId}
              expectedStatus={fromStatus}
              items={serialItems}
              canOverride={canOverrideSerials}
              requireComplete
              saveLabel={isLastStep ? "Save and move" : "Save and continue"}
              onSaved={advance}
              onCancel={goBack}
            />
          </>
        )}

        {step === "shipment" && (
          <>
            <p
              style={{
                fontSize: "var(--text-body)",
                color: "#6b6b6b",
                marginBottom: "1rem",
                lineHeight: "var(--leading-relaxed)",
              }}
            >
              Enter the shipment details. The customer will be notified by
              email.
            </p>

            <label htmlFor="mo-carrier" style={fieldLabel}>
              Carrier
            </label>
            <input
              id="mo-carrier"
              type="text"
              value={carrier}
              maxLength={80}
              onChange={(e) => {
                setCarrier(e.target.value);
                setShipmentErrors((prev) => ({ ...prev, carrier: undefined }));
              }}
              placeholder="e.g. Aramex"
              style={{
                ...inputStyle,
                border: `1px solid ${shipmentErrors.carrier ? "#991b1b" : "var(--color-shop-divider)"}`,
              }}
            />
            {shipmentErrors.carrier && (
              <p style={errorText}>{shipmentErrors.carrier}</p>
            )}

            <label
              htmlFor="mo-tracking-number"
              style={{ ...fieldLabel, marginTop: "1rem" }}
            >
              Tracking Number
            </label>
            <input
              id="mo-tracking-number"
              type="text"
              dir="ltr"
              value={trackingNumber}
              onChange={(e) => {
                setTrackingNumber(e.target.value);
                setShipmentErrors((prev) => ({
                  ...prev,
                  trackingNumber: undefined,
                }));
              }}
              placeholder="e.g. 1Z999AA10123456784"
              style={{
                ...inputStyle,
                border: `1px solid ${shipmentErrors.trackingNumber ? "#991b1b" : "var(--color-shop-divider)"}`,
              }}
            />
            {shipmentErrors.trackingNumber && (
              <p style={errorText}>{shipmentErrors.trackingNumber}</p>
            )}

            <label
              htmlFor="mo-tracking-url"
              style={{ ...fieldLabel, marginTop: "1rem" }}
            >
              Tracking link (optional)
            </label>
            <input
              id="mo-tracking-url"
              type="text"
              dir="ltr"
              value={trackingUrl}
              onChange={(e) => {
                setTrackingUrl(e.target.value);
                setShipmentErrors((prev) => ({
                  ...prev,
                  trackingUrl: undefined,
                }));
              }}
              placeholder="https://..."
              style={{
                ...inputStyle,
                border: `1px solid ${shipmentErrors.trackingUrl ? "#991b1b" : "var(--color-shop-divider)"}`,
              }}
            />
            {shipmentErrors.trackingUrl && (
              <p style={errorText}>{shipmentErrors.trackingUrl}</p>
            )}

            <div style={{ display: "flex", gap: "0.75rem", marginTop: "1rem" }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <label htmlFor="mo-shipped-on" style={fieldLabel}>
                  Shipped on
                </label>
                <input
                  id="mo-shipped-on"
                  type="date"
                  value={shippedOn}
                  max={todayDubai}
                  onChange={(e) => {
                    setShippedOn(e.target.value);
                    setShipmentErrors((prev) => ({
                      ...prev,
                      shippedOn: undefined,
                    }));
                  }}
                  style={{
                    ...inputStyle,
                    border: `1px solid ${shipmentErrors.shippedOn ? "#991b1b" : "var(--color-shop-divider)"}`,
                  }}
                />
                {shipmentErrors.shippedOn && (
                  <p style={errorText}>{shipmentErrors.shippedOn}</p>
                )}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <label htmlFor="mo-parcels" style={fieldLabel}>
                  Parcels
                </label>
                <input
                  id="mo-parcels"
                  type="number"
                  min={1}
                  max={50}
                  step={1}
                  dir="ltr"
                  value={parcels}
                  onChange={(e) => {
                    setParcels(e.target.value);
                    setShipmentErrors((prev) => ({
                      ...prev,
                      parcels: undefined,
                    }));
                  }}
                  style={{
                    ...inputStyle,
                    border: `1px solid ${shipmentErrors.parcels ? "#991b1b" : "var(--color-shop-divider)"}`,
                  }}
                />
                {shipmentErrors.parcels && (
                  <p style={errorText}>{shipmentErrors.parcels}</p>
                )}
              </div>
            </div>

            <label
              htmlFor="mo-estimated-delivery"
              style={{ ...fieldLabel, marginTop: "1rem" }}
            >
              Estimated delivery (optional)
            </label>
            <input
              id="mo-estimated-delivery"
              type="date"
              value={estimatedDelivery}
              min={shippedOn || undefined}
              onChange={(e) => {
                setEstimatedDelivery(e.target.value);
                setShipmentErrors((prev) => ({
                  ...prev,
                  estimatedDelivery: undefined,
                }));
              }}
              style={{
                ...inputStyle,
                border: `1px solid ${shipmentErrors.estimatedDelivery ? "#991b1b" : "var(--color-shop-divider)"}`,
              }}
            />
            {shipmentErrors.estimatedDelivery && (
              <p style={errorText}>{shipmentErrors.estimatedDelivery}</p>
            )}

            <label
              htmlFor="mo-shipment-note"
              style={{ ...fieldLabel, marginTop: "1rem" }}
            >
              Note to the customer (optional)
            </label>
            <textarea
              id="mo-shipment-note"
              value={shipmentNote}
              rows={3}
              maxLength={500}
              onChange={(e) => setShipmentNote(e.target.value)}
              style={{ ...inputStyle, resize: "vertical" }}
            />
          </>
        )}

        {error && (
          <p style={{ ...errorText, marginTop: "0.75rem" }}>{error}</p>
        )}

        {step !== "serials" && (
        <div style={{ display: "flex", gap: "0.75rem", marginTop: "1.5rem" }}>
          <button
            type="button"
            onClick={advance}
            disabled={isPending}
            style={{
              ...btnBase,
              backgroundColor: "var(--color-action-primary)",
              color: "#ffffff",
              cursor: isPending ? "not-allowed" : "pointer",
              opacity: isPending ? 0.6 : 1,
            }}
          >
            {isPending && (
              <span
                aria-hidden="true"
                style={{
                  display: "inline-block",
                  width: "0.875em",
                  height: "0.875em",
                  border: "2px solid currentColor",
                  borderTopColor: "transparent",
                  borderRadius: "50%",
                  marginInlineEnd: "0.5rem",
                  flexShrink: 0,
                }}
              />
            )}
            {primaryLabel}
          </button>
          {step !== "review" ? (
            <button
              type="button"
              onClick={goBack}
              disabled={isPending}
              style={{ ...btnBase, ...textAction }}
            >
              Back
            </button>
          ) : (
            <button
              type="button"
              onClick={onClose}
              disabled={isPending}
              style={{ ...btnBase, ...textAction }}
            >
              Cancel
            </button>
          )}
        </div>
        )}
      </div>
    </div>
  );
}

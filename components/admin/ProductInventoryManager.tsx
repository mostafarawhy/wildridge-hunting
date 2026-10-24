"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/Toast";
import Modal from "@/components/ui/Modal";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import { adjustProductStockAction } from "@/lib/actions/stock";
import type { ProductStockMovementItem } from "@/lib/db/queries/products";
import { MANUAL_STOCK_MOVEMENT_TYPES } from "@/lib/validations/product";
import type { StockMovementType } from "@/app/generated/prisma/client";
import { formatDateTime } from "@/lib/utils/date";

interface Props {
  productId: string;
  stockQuantity: number;
  reservedQuantity: number;
  lowStockThreshold: number;
  movements: ProductStockMovementItem[];
}

const card: React.CSSProperties = {
  backgroundColor: "#ffffff",
  border: "1px solid var(--color-auth-form-border)",
  borderRadius: "var(--radius-none)",
  padding: "1.5rem",
  display: "flex",
  flexDirection: "column",
  gap: "1.25rem",
};

const cardTitle: React.CSSProperties = {
  fontSize: "var(--text-body-lg)",
  fontWeight: "var(--font-bold)",
  color: "#0b0b0b",
  margin: 0,
};

const TYPE_LABELS: Record<StockMovementType, string> = {
  PURCHASE: "Purchase",
  SALE: "Sale",
  RETURN: "Return",
  MANUAL_ADJUSTMENT: "Manual Adjustment",
  IMPORT_ADJUSTMENT: "Import Adjustment",
  DAMAGE: "Damage",
};

type Direction = "add" | "remove";

const ADD_TYPES = MANUAL_STOCK_MOVEMENT_TYPES.filter(
  (t): t is "PURCHASE" | "RETURN" | "MANUAL_ADJUSTMENT" => t !== "DAMAGE",
);
const REMOVE_TYPES = MANUAL_STOCK_MOVEMENT_TYPES.filter(
  (t): t is "DAMAGE" | "MANUAL_ADJUSTMENT" =>
    t === "DAMAGE" || t === "MANUAL_ADJUSTMENT",
);

interface FieldErrors {
  quantity?: string;
  reason?: string;
}

export default function ProductInventoryManager({
  productId,
  stockQuantity,
  reservedQuantity,
  lowStockThreshold,
  movements,
}: Props) {
  const router = useRouter();
  const toast = useToast();

  const [modalOpen, setModalOpen] = useState(false);
  const [direction, setDirection] = useState<Direction>("add");
  const [type, setType] = useState<string>("PURCHASE");
  const [magnitude, setMagnitude] = useState("");
  const [reason, setReason] = useState("");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isLowStock = stockQuantity <= lowStockThreshold;

  function openModal() {
    setDirection("add");
    setType("PURCHASE");
    setMagnitude("");
    setReason("");
    setFieldErrors({});
    setIsSubmitting(false);
    setModalOpen(true);
  }

  function closeModal() {
    if (isSubmitting) return;
    setModalOpen(false);
  }

  function handleDirectionChange(d: Direction) {
    setDirection(d);
    setType(d === "add" ? "PURCHASE" : "DAMAGE");
    setFieldErrors({});
  }

  const magnitudeNum = parseInt(magnitude, 10);
  const validMagnitude = !isNaN(magnitudeNum) && magnitudeNum >= 1;
  const previewAfter = validMagnitude
    ? stockQuantity + (direction === "add" ? magnitudeNum : -magnitudeNum)
    : null;

  async function handleSubmit() {
    const errors: FieldErrors = {};
    const mag = parseInt(magnitude, 10);
    if (isNaN(mag) || mag < 1) {
      errors.quantity = "Enter a positive integer.";
    }
    if (!reason.trim()) {
      errors.reason = "Reason is required.";
    }
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    setIsSubmitting(true);
    setFieldErrors({});

    const delta = direction === "add" ? mag : -mag;
    const result = await adjustProductStockAction(productId, {
      delta,
      type,
      reason: reason.trim(),
    });

    if (result.success) {
      toast.success("Stock adjusted.");
      router.refresh();
      setModalOpen(false);
    } else {
      if (result.errorCode === "VALIDATION_ERROR" && result.fieldErrors) {
        const fe: FieldErrors = {};
        if (result.fieldErrors.delta) fe.quantity = result.fieldErrors.delta[0];
        if (result.fieldErrors.reason) fe.reason = result.fieldErrors.reason[0];
        setFieldErrors(fe);
      } else if (result.errorCode === "NEGATIVE_RESULT") {
        setFieldErrors({ quantity: result.error });
      } else {
        toast.error(result.error);
      }
    }

    setIsSubmitting(false);
  }

  return (
    <div style={card}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "baseline",
          paddingBottom: "0.875rem",
          borderBottom: "1px solid var(--color-shop-divider)",
        }}
      >
        <h2 style={cardTitle}>Inventory</h2>
        <button
          type="button"
          onClick={openModal}
          style={{
            padding: "0.5rem 1.125rem",
            fontSize: "var(--text-body)",
            backgroundColor: "#0b0b0b",
            color: "#ffffff",
            border: "1px solid #0b0b0b",
            cursor: "pointer",
          }}
        >
          Adjust stock
        </button>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gap: "0.75rem",
        }}
      >
        <Tile
          label="On hand"
          value={stockQuantity}
          valueColor={isLowStock ? "#854d0e" : "#0b0b0b"}
        />
        <Tile label="Reserved" value={reservedQuantity} valueColor="#6b6b6b" />
        <Tile label="Threshold" value={lowStockThreshold} />
      </div>

      {isLowStock && (
        <div>
          <span
            style={{
              display: "inline-block",
              padding: "0.125rem 0.5rem",
              fontSize: "var(--text-body-sm)",
              color: "#854d0e",
              backgroundColor: "#fef9c3",
            }}
          >
            Low stock
          </span>
        </div>
      )}

      {/* ── Recent movements ── */}
      <div style={{ display: "flex", flexDirection: "column" }}>
        {movements.length === 0 ? (
          <p
            style={{
              fontSize: "var(--text-body-sm)",
              color: "#6b6b6b",
              margin: 0,
            }}
          >
            No stock movements yet.
          </p>
        ) : (
          movements.map((m, i) => (
            <MovementRow key={m.id} movement={m} first={i === 0} />
          ))
        )}
      </div>

      <Modal
        open={modalOpen}
        onClose={closeModal}
        ariaLabel="Adjust stock"
        maxWidth={480}
      >
        <div>
          <div style={{ padding: "1.75rem 1.5rem 1.25rem" }}>
            <h3
              style={{
                fontSize: "var(--text-body-lg)",
                fontWeight: "var(--font-bold)",
                color: "#0b0b0b",
                margin: "0 0 1.25rem",
              }}
            >
              Adjust stock
            </h3>

            {/* Add / Remove segmented control */}
            <div
              style={{
                display: "flex",
                gap: "0.5rem",
                marginBottom: "1.25rem",
              }}
            >
              {(["add", "remove"] as Direction[]).map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => handleDirectionChange(d)}
                  disabled={isSubmitting}
                  style={{
                    flex: 1,
                    padding: "0.5rem 0",
                    fontSize: "var(--text-body)",
                    fontWeight: "var(--font-medium)",
                    backgroundColor: "#0b0b0b",
                    color: "#ffffff",
                    opacity: direction === d ? 1 : 0.4,
                    border: "none",
                    cursor: isSubmitting ? "not-allowed" : "pointer",
                  }}
                >
                  {d === "add" ? "Add" : "Remove"}
                </button>
              ))}
            </div>

            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "0.875rem",
              }}
            >
              <Select
                id="adj-type"
                label="Type"
                value={type}
                onChange={(e) => setType(e.target.value)}
                disabled={isSubmitting}
                required
              >
                {(direction === "add" ? ADD_TYPES : REMOVE_TYPES).map((t) => (
                  <option key={t} value={t}>
                    {TYPE_LABELS[t]}
                  </option>
                ))}
              </Select>

              <Input
                id="adj-quantity"
                label="Quantity"
                type="number"
                min={1}
                dir="ltr"
                value={magnitude}
                onChange={(e) => {
                  setMagnitude(e.target.value);
                  if (fieldErrors.quantity)
                    setFieldErrors((fe) => ({ ...fe, quantity: undefined }));
                }}
                disabled={isSubmitting}
                error={fieldErrors.quantity}
                required
              />

              <Input
                id="adj-reason"
                label="Reason"
                type="text"
                maxLength={200}
                value={reason}
                onChange={(e) => {
                  setReason(e.target.value);
                  if (fieldErrors.reason)
                    setFieldErrors((fe) => ({ ...fe, reason: undefined }));
                }}
                disabled={isSubmitting}
                error={fieldErrors.reason}
                required
              />

              <p
                dir="ltr"
                style={{
                  fontSize: "var(--text-body-sm)",
                  color: "#6b6b6b",
                  margin: 0,
                }}
              >
                {previewAfter !== null
                  ? `On hand ${stockQuantity} → ${previewAfter} after this adjustment`
                  : `On hand ${stockQuantity} — enter a quantity above`}
              </p>
            </div>
          </div>

          <div
            style={{
              borderTop: "1px solid var(--color-shop-divider, #e3e3e3)",
              padding: "1rem 1.5rem 1.25rem",
              display: "flex",
              justifyContent: "flex-end",
              gap: "0.75rem",
            }}
          >
            <button
              type="button"
              onClick={closeModal}
              disabled={isSubmitting}
              style={{
                fontSize: "var(--text-body)",
                background: "none",
                border: "none",
                padding: 0,
                textDecoration: "underline",
                cursor: isSubmitting ? "not-allowed" : "pointer",
                color: "#0b0b0b",
              }}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => {
                void handleSubmit();
              }}
              disabled={isSubmitting}
              style={{
                padding: "0.5rem 1.125rem",
                fontSize: "var(--text-body)",
                backgroundColor: "#0b0b0b",
                color: "#ffffff",
                border: "1px solid #0b0b0b",
                cursor: isSubmitting ? "not-allowed" : "pointer",
                opacity: isSubmitting ? 0.6 : 1,
              }}
            >
              {isSubmitting ? "Adjusting…" : "Adjust"}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

function Tile({
  label,
  value,
  valueColor = "#0b0b0b",
}: {
  label: string;
  value: number;
  valueColor?: string;
}) {
  return (
    <div
      style={{
        backgroundColor: "#f5f5f5",
        padding: "0.875rem 1rem",
        display: "flex",
        flexDirection: "column",
        gap: "0.25rem",
      }}
    >
      <span style={{ fontSize: "var(--text-body-sm)", color: "#6b6b6b" }}>
        {label}
      </span>
      <span
        dir="ltr"
        style={{
          fontSize: "var(--text-body-lg)",
          fontWeight: "var(--font-bold)",
          color: valueColor,
        }}
      >
        {value}
      </span>
    </div>
  );
}

function MovementRow({
  movement,
  first,
}: {
  movement: ProductStockMovementItem;
  first: boolean;
}) {
  const deltaPositive = movement.delta > 0;
  const deltaStr = deltaPositive
    ? `+${movement.delta}`
    : String(movement.delta);
  const deltaColor = deltaPositive ? "#166534" : "#991b1b";
  const staffLabel = movement.staffName ?? "System";

  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "flex-start",
        gap: "1rem",
        paddingBlock: "0.625rem",
        borderTop: first ? "none" : "1px solid var(--color-shop-divider)",
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "0.25rem",
          minWidth: 0,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.5rem",
            flexWrap: "wrap",
          }}
        >
          <span
            style={{
              display: "inline-block",
              padding: "0.125rem 0.5rem",
              fontSize: "var(--text-body-sm)",
              color: "#6b6b6b",
              backgroundColor: "#f3f4f6",
              whiteSpace: "nowrap",
            }}
          >
            {TYPE_LABELS[movement.type]}
          </span>
          <span style={{ fontSize: "var(--text-body-sm)", color: "#6b6b6b" }}>
            {movement.reason ?? "—"}
          </span>
        </div>
        <div style={{ display: "flex", gap: "0.375rem", alignItems: "center" }}>
          <span style={{ fontSize: 12, color: "#6b6b6b" }}>{staffLabel}</span>
          <span style={{ fontSize: 12, color: "#6b6b6b" }}>&middot;</span>
          <span dir="ltr" style={{ fontSize: 12, color: "#6b6b6b" }}>
            {formatDateTime(movement.createdAt, "en")}
          </span>
        </div>
      </div>

      <div
        dir="ltr"
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-end",
          gap: "0.125rem",
          flexShrink: 0,
        }}
      >
        <span
          style={{
            fontSize: "var(--text-body)",
            fontWeight: "var(--font-bold)",
            color: deltaColor,
          }}
        >
          {deltaStr}
        </span>
        <span style={{ fontSize: 12, color: "#6b6b6b" }}>
          {movement.quantityBefore} → {movement.quantityAfter}
        </span>
      </div>
    </div>
  );
}

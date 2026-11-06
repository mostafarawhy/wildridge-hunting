"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/Toast";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import Button from "@/components/ui/Button";
import {
  createShippingRateAction,
  updateShippingRateAction,
  deleteShippingRateAction,
  toggleShippingRateAction,
} from "@/lib/actions/shipping-rate";
import { formatAED } from "@/lib/utils/currency";
import type { AdminShippingRateItem, AssignableMethod } from "@/lib/db/queries/shipping";

interface Props {
  zoneId: string;
  rates: AdminShippingRateItem[];
  assignableMethods: AssignableMethod[];
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

export default function ShippingZoneRatesManager({ zoneId, rates, assignableMethods }: Props) {
  const router = useRouter();
  const toast = useToast();

  const [editId, setEditId] = useState<string | null>(null);
  const [editBasePrice, setEditBasePrice] = useState("");
  const [editDaysMin, setEditDaysMin] = useState("");
  const [editDaysMax, setEditDaysMax] = useState("");
  const [editErrors, setEditErrors] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);

  const [removeTarget, setRemoveTarget] = useState<{ id: string; methodNameEn: string } | null>(null);
  const [isRemoving, setIsRemoving] = useState(false);

  const [togglingId, setTogglingId] = useState<string | null>(null);

  const [addMethodId, setAddMethodId] = useState("");
  const [addBasePrice, setAddBasePrice] = useState("");
  const [addDaysMin, setAddDaysMin] = useState("");
  const [addDaysMax, setAddDaysMax] = useState("");
  const [addErrors, setAddErrors] = useState<Record<string, string>>({});
  const [isAdding, setIsAdding] = useState(false);

  function openEdit(rate: AdminShippingRateItem) {
    setEditId(rate.id);
    setEditBasePrice(String(rate.basePrice));
    setEditDaysMin(rate.estimatedDaysMin != null ? String(rate.estimatedDaysMin) : "");
    setEditDaysMax(rate.estimatedDaysMax != null ? String(rate.estimatedDaysMax) : "");
    setEditErrors({});
  }

  function closeEdit() {
    setEditId(null);
    setEditErrors({});
  }

  async function handleSave(rate: AdminShippingRateItem) {
    if (isSaving) return;
    setIsSaving(true);

    const result = await updateShippingRateAction(rate.id, {
      basePrice: editBasePrice,
      estimatedDaysMin: editDaysMin !== "" ? editDaysMin : null,
      estimatedDaysMax: editDaysMax !== "" ? editDaysMax : null,
      isActive: rate.isActive,
    });

    setIsSaving(false);

    if (!result.success) {
      if (result.fieldErrors) {
        const errs: Record<string, string> = {};
        for (const [k, msgs] of Object.entries(result.fieldErrors)) {
          if (msgs && msgs.length > 0) errs[k] = msgs[0];
        }
        setEditErrors(errs);
      }
      toast.error(result.error);
      return;
    }

    closeEdit();
    toast.success("Rate updated.");
    router.refresh();
  }

  async function handleToggle(rate: AdminShippingRateItem) {
    if (togglingId) return;
    setTogglingId(rate.id);

    const result = await toggleShippingRateAction(rate.id, !rate.isActive);

    setTogglingId(null);

    if (!result.success) {
      toast.error(result.error);
      return;
    }

    router.refresh();
  }

  async function handleConfirmRemove() {
    if (!removeTarget) return;
    setIsRemoving(true);

    const result = await deleteShippingRateAction(removeTarget.id);

    setIsRemoving(false);
    setRemoveTarget(null);

    if (!result.success) {
      toast.error(result.error);
      return;
    }

    toast.success("Rate removed.");
    router.refresh();
  }

  async function handleAdd() {
    if (isAdding) return;
    setIsAdding(true);

    const result = await createShippingRateAction(zoneId, {
      shippingMethodId: addMethodId,
      basePrice: addBasePrice,
      estimatedDaysMin: addDaysMin !== "" ? addDaysMin : null,
      estimatedDaysMax: addDaysMax !== "" ? addDaysMax : null,
      isActive: true,
    });

    setIsAdding(false);

    if (!result.success) {
      if (result.fieldErrors) {
        const errs: Record<string, string> = {};
        for (const [k, msgs] of Object.entries(result.fieldErrors)) {
          if (msgs && msgs.length > 0) errs[k] = msgs[0];
        }
        setAddErrors(errs);
      }
      toast.error(result.error);
      return;
    }

    setAddMethodId("");
    setAddBasePrice("");
    setAddDaysMin("");
    setAddDaysMax("");
    setAddErrors({});
    toast.success("Rate added.");
    router.refresh();
  }

  const addBasePriceNum = parseFloat(addBasePrice);
  const canAdd = addMethodId !== "" && !Number.isNaN(addBasePriceNum) && addBasePriceNum > 0;

  return (
    <div style={card}>
      <style>{`
        .palm-remove-btn { background: none; border: none; padding: 0; cursor: pointer; font-size: 13px; color: #6b6b6b; line-height: 1; transition: color 120ms; white-space: nowrap; flex-shrink: 0; }
        .palm-remove-btn:hover { color: #991b1b !important; }
        .palm-remove-btn:disabled { opacity: 0.4; cursor: default; }
      `}</style>

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "baseline",
          paddingBottom: "0.875rem",
          borderBottom: "1px solid var(--color-shop-divider)",
        }}
      >
        <h2 style={cardTitle}>Rates</h2>
        <span style={{ fontSize: 13, color: "var(--color-auth-input-placeholder)" }}>
          {rates.length} configured
        </span>
      </div>

      {rates.length === 0 ? (
        <p style={{ fontSize: "var(--text-body-sm)", color: "var(--color-auth-input-placeholder)", margin: 0 }}>
          No rates configured yet.
        </p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column" }}>
          {rates.map((rate) => {
            const isEditing = editId === rate.id;
            const rowMuted = !rate.isActive;

            return (
              <div
                key={rate.id}
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  alignItems: isEditing ? "flex-start" : "center",
                  justifyContent: "space-between",
                  gap: "1rem",
                  padding: "0.625rem 0",
                  borderBottom: "1px solid var(--color-shop-divider)",
                }}
              >
                <div style={{ display: "flex", flexDirection: "column", gap: "0.125rem", flexShrink: 0 }}>
                  <span style={{ fontSize: "var(--text-body)", fontWeight: 500, color: rowMuted ? "#9a9a9a" : "#0b0b0b" }}>
                    {rate.methodNameEn}
                  </span>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                    <span dir="ltr" style={{ fontSize: 13, color: "#9a9a9a" }}>
                      {rate.methodCode}
                    </span>
                    {!rate.methodIsActive && (
                      <span style={{ fontSize: 12, color: "#6b6b6b", backgroundColor: "#f3f4f6", padding: "0.125rem 0.375rem" }}>
                        method inactive
                      </span>
                    )}
                  </div>
                </div>

                {isEditing ? (
                  <div style={{ display: "flex", alignItems: "flex-end", gap: "0.75rem", flex: 1, minWidth: 0, flexWrap: "wrap" }}>
                    <div style={{ minWidth: "8rem" }}>
                      <Input
                        id={`edit-price-${rate.id}`}
                        label="Price"
                        value={editBasePrice}
                        onChange={(e) => setEditBasePrice(e.target.value)}
                        inputMode="decimal"
                        dir="ltr"
                        error={editErrors.basePrice}
                      />
                    </div>
                    <div style={{ minWidth: "6rem" }}>
                      <Input
                        id={`edit-min-${rate.id}`}
                        label="Days min"
                        value={editDaysMin}
                        onChange={(e) => setEditDaysMin(e.target.value)}
                        inputMode="numeric"
                        dir="ltr"
                        error={editErrors.estimatedDaysMin}
                      />
                    </div>
                    <div style={{ minWidth: "6rem" }}>
                      <Input
                        id={`edit-max-${rate.id}`}
                        label="Days max"
                        value={editDaysMax}
                        onChange={(e) => setEditDaysMax(e.target.value)}
                        inputMode="numeric"
                        dir="ltr"
                        error={editErrors.estimatedDaysMax}
                      />
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", paddingBottom: "0.25rem" }}>
                      <Button
                        type="button"
                        variant="primary"
                        size="sm"
                        loading={isSaving}
                        disabled={isSaving}
                        onClick={() => { void handleSave(rate); }}
                      >
                        Save
                      </Button>
                      <button
                        type="button"
                        onClick={closeEdit}
                        style={{ background: "none", border: "none", padding: 0, cursor: "pointer", fontSize: 13, color: "#6b6b6b", lineHeight: 1, whiteSpace: "nowrap" }}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "0.125rem" }}>
                      <span dir="ltr" style={{ fontVariantNumeric: "tabular-nums", fontSize: "var(--text-body)", color: rowMuted ? "#9a9a9a" : "#0b0b0b" }}>
                        {formatAED(rate.basePrice, "en")}
                      </span>
                      <span style={{ fontSize: 13, color: rowMuted ? "#9a9a9a" : "#6b6b6b" }}>
                        {rate.estimatedDaysMin != null && rate.estimatedDaysMax != null
                          ? `${rate.estimatedDaysMin}–${rate.estimatedDaysMax} days`
                          : "—"}
                      </span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", flexShrink: 0 }}>
                      <span style={{ fontSize: 13, color: rate.isActive ? "#166534" : "#6b6b6b", backgroundColor: rate.isActive ? "#dcfce7" : "#f3f4f6", padding: "0.125rem 0.5rem", whiteSpace: "nowrap" }}>
                        {rate.isActive ? "Active" : "Inactive"}
                      </span>
                      <button
                        type="button"
                        disabled={togglingId !== null}
                        onClick={() => { void handleToggle(rate); }}
                        style={{ background: "none", border: "none", padding: 0, cursor: togglingId !== null ? "not-allowed" : "pointer", fontSize: 13, color: "#6b6b6b", lineHeight: 1, whiteSpace: "nowrap", opacity: togglingId !== null ? 0.4 : 1, transition: "opacity 120ms" }}
                      >
                        {rate.isActive ? "Deactivate" : "Activate"}
                      </button>
                      <button
                        type="button"
                        onClick={() => openEdit(rate)}
                        style={{ background: "none", border: "none", padding: 0, cursor: "pointer", fontSize: 13, color: "#6b6b6b", lineHeight: 1, whiteSpace: "nowrap" }}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        className="palm-remove-btn"
                        aria-label={`Remove rate for ${rate.methodNameEn}`}
                        onClick={() => setRemoveTarget({ id: rate.id, methodNameEn: rate.methodNameEn })}
                      >
                        Remove
                      </button>
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      )}

      {assignableMethods.length === 0 ? (
        <p style={{ fontSize: "var(--text-body-sm)", color: "var(--color-auth-input-placeholder)", margin: 0 }}>
          All active methods have a rate in this zone.
        </p>
      ) : (
        <div style={{ display: "flex", alignItems: "flex-end", gap: "0.75rem", flexWrap: "wrap" }}>
          <div style={{ minWidth: "10rem", flex: "1 1 10rem" }}>
            <Select
              id="add-rate-method"
              label="Method"
              value={addMethodId}
              onChange={(e) => setAddMethodId(e.target.value)}
              disabled={isAdding}
              error={addErrors.shippingMethodId}
            >
              <option value="">Select a method…</option>
              {assignableMethods.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.nameEn}
                </option>
              ))}
            </Select>
          </div>
          <div style={{ minWidth: "8rem", flex: "1 1 8rem" }}>
            <Input
              id="add-rate-price"
              label="Price"
              value={addBasePrice}
              onChange={(e) => setAddBasePrice(e.target.value)}
              inputMode="decimal"
              dir="ltr"
              error={addErrors.basePrice}
            />
          </div>
          <div style={{ minWidth: "6rem", flex: "1 1 6rem" }}>
            <Input
              id="add-rate-days-min"
              label="Days min"
              value={addDaysMin}
              onChange={(e) => setAddDaysMin(e.target.value)}
              inputMode="numeric"
              dir="ltr"
              error={addErrors.estimatedDaysMin}
            />
          </div>
          <div style={{ minWidth: "6rem", flex: "1 1 6rem" }}>
            <Input
              id="add-rate-days-max"
              label="Days max"
              value={addDaysMax}
              onChange={(e) => setAddDaysMax(e.target.value)}
              inputMode="numeric"
              dir="ltr"
              error={addErrors.estimatedDaysMax}
            />
          </div>
          <button
            type="button"
            disabled={!canAdd || isAdding}
            onClick={() => { void handleAdd(); }}
            style={{
              padding: "0.625rem 1.125rem",
              fontSize: "var(--text-body)",
              backgroundColor: !canAdd || isAdding ? "#e3e3e3" : "#0b0b0b",
              color: !canAdd || isAdding ? "#9a9a9a" : "#ffffff",
              border: "1px solid transparent",
              cursor: !canAdd || isAdding ? "not-allowed" : "pointer",
              flexShrink: 0,
              transition: "background-color 120ms, color 120ms",
              whiteSpace: "nowrap",
              alignSelf: "flex-end",
              marginBottom: "0",
            }}
          >
            {isAdding ? "Adding…" : "Add"}
          </button>
        </div>
      )}

      <ConfirmDialog
        open={removeTarget !== null}
        onClose={() => {
          if (!isRemoving) setRemoveTarget(null);
        }}
        onConfirm={handleConfirmRemove}
        title="Remove rate"
        message={
          removeTarget
            ? `Remove the rate for "${removeTarget.methodNameEn}"? This method will no longer be offered for this zone.`
            : ""
        }
        confirmLabel="Remove"
        cancelLabel="Cancel"
        isPending={isRemoving}
        destructive
      />
    </div>
  );
}

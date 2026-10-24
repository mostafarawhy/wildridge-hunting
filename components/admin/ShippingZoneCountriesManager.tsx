"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/Toast";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import Select from "@/components/ui/Select";
import { getAllCountries, groupByContinent, getCountryName } from "@/lib/data/countries";
import {
  addZoneCountryAction,
  removeZoneCountryAction,
} from "@/lib/actions/shipping-zone";

interface Props {
  zoneId: string;
  memberCodes: string[];
  assignedCodes: string[];
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

export default function ShippingZoneCountriesManager({
  zoneId,
  memberCodes,
  assignedCodes,
}: Props) {
  const router = useRouter();
  const toast = useToast();

  const [removeTarget, setRemoveTarget] = useState<{ code: string; name: string } | null>(null);
  const [isRemoving, setIsRemoving] = useState(false);
  const [selectedCode, setSelectedCode] = useState("");
  const [isLinking, setIsLinking] = useState(false);

  const members = memberCodes
    .map((code) => ({ code, name: getCountryName(code) }))
    .sort((a, b) => a.name.localeCompare(b.name));

  const assignedSet = new Set(assignedCodes);
  const available = getAllCountries().filter((c) => !assignedSet.has(c.code));
  const groups = groupByContinent(available);

  async function handleAdd() {
    if (!selectedCode || isLinking) return;
    setIsLinking(true);

    const result = await addZoneCountryAction(zoneId, { country: selectedCode });

    setIsLinking(false);

    if (!result.success) {
      toast.error(result.error);
      return;
    }

    toast.success("Country added.");
    setSelectedCode("");
    router.refresh();
  }

  async function handleConfirmRemove() {
    if (!removeTarget) return;
    setIsRemoving(true);

    const result = await removeZoneCountryAction(zoneId, removeTarget.code);

    setIsRemoving(false);
    setRemoveTarget(null);

    if (!result.success) {
      toast.error(result.error);
      return;
    }

    toast.success("Country removed.");
    router.refresh();
  }

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
        <h2 style={cardTitle}>Countries</h2>
        <span style={{ fontSize: 13, color: "var(--color-auth-input-placeholder)" }}>
          {members.length} assigned
        </span>
      </div>

      {members.length === 0 ? (
        <p style={{ fontSize: "var(--text-body-sm)", color: "var(--color-auth-input-placeholder)", margin: 0 }}>
          No countries assigned yet.
        </p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column" }}>
          {members.map((member) => (
            <div
              key={member.code}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: "1rem",
                padding: "0.625rem 0",
                borderBottom: "1px solid var(--color-shop-divider)",
              }}
            >
              <div style={{ display: "flex", alignItems: "baseline", gap: "0.5rem", minWidth: 0 }}>
                <span style={{ fontSize: "var(--text-body)", color: "#0b0b0b", fontWeight: 500 }}>
                  {member.name}
                </span>
                <span dir="ltr" style={{ fontSize: 13, color: "#9a9a9a" }}>
                  {member.code}
                </span>
              </div>

              <button
                type="button"
                className="palm-remove-btn"
                aria-label={`Remove ${member.name}`}
                onClick={() => setRemoveTarget(member)}
              >
                Remove
              </button>
            </div>
          ))}
        </div>
      )}

      <div style={{ display: "flex", alignItems: "flex-end", gap: "0.75rem" }}>
        {available.length === 0 ? (
          <p style={{ fontSize: "var(--text-body-sm)", color: "var(--color-auth-input-placeholder)", margin: 0 }}>
            All countries are already assigned to a zone.
          </p>
        ) : (
          <>
            <div style={{ flex: 1, minWidth: 0 }}>
              <Select
                id="add-country-select"
                label="Add country"
                value={selectedCode}
                onChange={(e) => setSelectedCode(e.target.value)}
                disabled={isLinking}
              >
                <option value="">Select a country…</option>
                {groups.map((group) => (
                  <optgroup key={group.continent} label={group.continentName}>
                    {group.countries.map((c) => (
                      <option key={c.code} value={c.code}>
                        {c.name}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </Select>
            </div>
            <button
              type="button"
              disabled={!selectedCode || isLinking}
              onClick={() => { void handleAdd(); }}
              style={{
                padding: "0.625rem 1.125rem",
                fontSize: "var(--text-body)",
                backgroundColor: !selectedCode || isLinking ? "#e3e3e3" : "#0b0b0b",
                color: !selectedCode || isLinking ? "#9a9a9a" : "#ffffff",
                border: "1px solid transparent",
                cursor: !selectedCode || isLinking ? "not-allowed" : "pointer",
                flexShrink: 0,
                transition: "background-color 120ms, color 120ms",
                whiteSpace: "nowrap",
                alignSelf: "flex-end",
                marginBottom: "0",
              }}
            >
              {isLinking ? "Adding…" : "Add"}
            </button>
          </>
        )}
      </div>

      <ConfirmDialog
        open={removeTarget !== null}
        onClose={() => {
          if (!isRemoving) setRemoveTarget(null);
        }}
        onConfirm={handleConfirmRemove}
        title="Remove country"
        message={
          removeTarget
            ? `Remove "${removeTarget.name}" from this zone? It will no longer be served by this shipping zone.`
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

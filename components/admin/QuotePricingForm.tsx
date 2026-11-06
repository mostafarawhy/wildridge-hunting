"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/Toast";
import { setQuotePricingAction } from "@/lib/actions/quote";
import { multiplyMoney, sumMoney, formatAED } from "@/lib/utils/currency";
import ConfirmDialog from "@/components/ui/ConfirmDialog";

const summaryRowStyle: React.CSSProperties = {
  fontSize: "var(--text-body-sm)",
  color: "#6b6b6b",
};

const summaryTotalStyle: React.CSSProperties = {
  fontSize: "var(--text-body)",
  fontWeight: "var(--font-semibold)",
  color: "#0b0b0b",
  marginTop: "0.25rem",
};

interface QuoteItem {
  id: string;
  name: string;
  quantity: number;
  quotedUnitPriceAed: number | null;
  requestedQuantity: number | null;
  selectedAddons: {
    id: string;
    name: string;
    quantity: number;
    quotedUnitPriceAed: number | null;
  }[];
}

interface Props {
  quoteId: string;
  items: QuoteItem[];
  defaultSendNote: string;
  existingSendNote: string | null;
  existingShippingCostAed: number | null;
  existingShippingMethodLabel: string | null;
}

export default function QuotePricingForm({
  quoteId,
  items,
  defaultSendNote,
  existingSendNote,
  existingShippingCostAed,
  existingShippingMethodLabel,
}: Props) {
  const router = useRouter();
  const toast = useToast();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [prices, setPrices] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      items.map((item) => [
        item.id,
        item.quotedUnitPriceAed != null ? String(item.quotedUnitPriceAed) : "",
      ]),
    ),
  );
  const [quantities, setQuantities] = useState<Record<string, string>>(() =>
    Object.fromEntries(items.map((item) => [item.id, String(item.quantity)])),
  );
  const [addonQuantities, setAddonQuantities] = useState<
    Record<string, string>
  >(() =>
    Object.fromEntries(
      items.flatMap((item) =>
        item.selectedAddons.map((addon) => [addon.id, String(addon.quantity)]),
      ),
    ),
  );
  const [addonPrices, setAddonPrices] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      items.flatMap((item) =>
        item.selectedAddons.map((addon) => [
          addon.id,
          addon.quotedUnitPriceAed != null
            ? String(addon.quotedUnitPriceAed)
            : "",
        ]),
      ),
    ),
  );
  const [shippingCost, setShippingCost] = useState(
    existingShippingCostAed != null ? String(existingShippingCostAed) : "",
  );
  const [shippingMethodLabel, setShippingMethodLabel] = useState(
    existingShippingMethodLabel ?? "",
  );
  const [sendNote, setSendNote] = useState(
    existingSendNote ?? defaultSendNote ?? "",
  );
  const [internalNote, setInternalNote] = useState("");
  const [stockVerified, setStockVerified] = useState(false);
  const [saveOpen, setSaveOpen] = useState(false);

  const allPricesFilled =
    items.every((item) => {
      const val = parseFloat(prices[item.id] ?? "");
      return !isNaN(val) && val > 0;
    }) &&
    items.every((item) => {
      const qty = parseInt(quantities[item.id] ?? "", 10);
      return !isNaN(qty) && qty >= 1;
    }) &&
    items.every((item) =>
      item.selectedAddons.every((addon) => {
        const qty = parseInt(addonQuantities[addon.id] ?? "", 10);
        const unit = parseFloat(addonPrices[addon.id] ?? "");
        return !isNaN(qty) && qty >= 1 && !isNaN(unit) && unit > 0;
      }),
    ) &&
    (() => {
      const val = parseFloat(shippingCost);
      return !isNaN(val) && val >= 0;
    })() &&
    shippingMethodLabel.trim().length > 0 &&
    sendNote.trim().length > 0;

  const canSubmitQuote = allPricesFilled && stockVerified;

  const lineTotals = items.map((item) => {
    const unit = parseFloat(prices[item.id] ?? "0") || 0;
    const qty = parseInt(quantities[item.id] ?? "0", 10) || 0;
    return multiplyMoney(unit, qty);
  });
  const addonLineTotals = items.flatMap((item) =>
    item.selectedAddons.map((addon) => {
      const unit = parseFloat(addonPrices[addon.id] ?? "0") || 0;
      const qty = parseInt(addonQuantities[addon.id] ?? "0", 10) || 0;
      return multiplyMoney(unit, qty);
    }),
  );
  const goodsSubtotal = sumMoney(lineTotals);
  const addonSubtotal = sumMoney(addonLineTotals);
  const quotedTotal = sumMoney([goodsSubtotal, addonSubtotal]);
  const shippingCostNum = parseFloat(shippingCost) || 0;
  const grandTotal = sumMoney([quotedTotal, shippingCostNum]);

  function handleSavePricing() {
    setError(null);
    const lines = items.map((item) => ({
      itemId: item.id,
      quotedUnitPrice: parseFloat(prices[item.id] ?? "0"),
      quantity: parseInt(quantities[item.id] ?? "0", 10),
      addons: item.selectedAddons.map((addon) => ({
        selectedAddonId: addon.id,
        quantity: parseInt(addonQuantities[addon.id] ?? "0", 10),
        quotedUnitPrice: parseFloat(addonPrices[addon.id] ?? "0"),
      })),
    }));
    startTransition(async () => {
      const result = await setQuotePricingAction({
        quoteId,
        lines,
        internalNote: internalNote.trim() || undefined,
        shippingCost: parseFloat(shippingCost),
        shippingMethodLabel: shippingMethodLabel.trim(),
        sendNote: sendNote.trim(),
        stockAttestation: { stockVerified: true },
      });
      if (result.success) {
        setStockVerified(false);
        toast.success("Quote sent to the customer.");
        router.refresh();
      } else {
        setError(result.error);
      }
    });
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
    cursor: isPending ? "not-allowed" : "pointer",
    opacity: isPending ? 0.6 : 1,
    transition: "opacity 150ms",
  };

  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "0.5rem 0.75rem",
    fontSize: "var(--text-body)",
    color: "#0b0b0b",
    border: "1px solid var(--color-shop-divider)",
    borderRadius: "0",
    outline: "none",
    boxSizing: "border-box",
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      <div>
        <div
          style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}
        >
          {items.map((item, idx) => (
            <div key={item.id}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "1rem",
                  justifyContent: "space-between",
                }}
              >
                <div style={{ flex: 1 }}>
                  <p
                    style={{
                      fontSize: "var(--text-body)",
                      color: "#0b0b0b",
                      marginBottom: "0.25rem",
                    }}
                  >
                    {item.name}
                  </p>
                  {item.requestedQuantity != null && (
                    <p
                      style={{
                        fontSize: "var(--text-body-sm)",
                        color: "#6b6b6b",
                      }}
                    >
                      Requested {item.requestedQuantity}
                    </p>
                  )}
                  <input
                    type="number"
                    dir="ltr"
                    min="1"
                    step="1"
                    placeholder="Qty"
                    value={quantities[item.id] ?? ""}
                    onChange={(e) =>
                      setQuantities((prev) => ({
                        ...prev,
                        [item.id]: e.target.value,
                      }))
                    }
                    style={{
                      ...inputStyle,
                      width: "100px",
                      marginTop: "0.25rem",
                    }}
                  />
                </div>
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "flex-end",
                    gap: "0.25rem",
                    flexShrink: 0,
                  }}
                >
                  <input
                    type="number"
                    dir="ltr"
                    step="0.01"
                    min="0"
                    placeholder="Unit price (AED)"
                    value={prices[item.id] ?? ""}
                    onChange={(e) =>
                      setPrices((prev) => ({
                        ...prev,
                        [item.id]: e.target.value,
                      }))
                    }
                    style={{ ...inputStyle, width: "160px" }}
                  />
                  {prices[item.id] && parseFloat(prices[item.id]) > 0 && (
                    <p
                      style={{
                        fontSize: "var(--text-body-sm)",
                        color: "#6b6b6b",
                      }}
                    >
                      Line: {formatAED(lineTotals[idx], "en")}
                    </p>
                  )}
                </div>
              </div>
              {item.selectedAddons.length > 0 && (
                <div
                  style={{
                    marginTop: "0.5rem",
                    paddingInlineStart: "1rem",
                    display: "flex",
                    flexDirection: "column",
                    gap: "0.375rem",
                  }}
                >
                  {item.selectedAddons.map((addon) => (
                    <div
                      key={addon.id}
                      style={{
                        display: "flex",
                        flexWrap: "wrap",
                        alignItems: "center",
                        gap: "0.75rem",
                      }}
                    >
                      <p
                        className="grow basis-full sm:basis-0"
                        style={{
                          fontSize: "var(--text-body-sm)",
                          color: "#6b6b6b",
                        }}
                      >
                        {addon.name}
                      </p>
                      <input
                        type="number"
                        dir="ltr"
                        min="1"
                        step="1"
                        placeholder="Qty"
                        value={addonQuantities[addon.id] ?? ""}
                        onChange={(e) =>
                          setAddonQuantities((prev) => ({
                            ...prev,
                            [addon.id]: e.target.value,
                          }))
                        }
                        style={{ ...inputStyle, width: "100px" }}
                      />
                      <input
                        type="number"
                        dir="ltr"
                        step="0.01"
                        min="0"
                        placeholder="Unit price (AED)"
                        value={addonPrices[addon.id] ?? ""}
                        onChange={(e) =>
                          setAddonPrices((prev) => ({
                            ...prev,
                            [addon.id]: e.target.value,
                          }))
                        }
                        style={{ ...inputStyle, width: "160px" }}
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>

        {allPricesFilled && (
          <div style={{ marginTop: "0.75rem", textAlign: "end" }}>
            <p style={summaryRowStyle}>
              Goods: {formatAED(goodsSubtotal, "en")}
            </p>
            <p style={summaryRowStyle}>
              Add-ons: {formatAED(addonSubtotal, "en")}
            </p>
            <p style={summaryRowStyle}>
              Quoted total: {formatAED(quotedTotal, "en")}
            </p>
            <p style={summaryRowStyle}>
              Shipping: {formatAED(shippingCostNum, "en")}
            </p>
            <p style={summaryTotalStyle}>
              Customer pays: {formatAED(grandTotal, "en")}
            </p>
          </div>
        )}

        <div style={{ marginTop: "1rem" }}>
          <textarea
            value={internalNote}
            onChange={(e) => setInternalNote(e.target.value)}
            rows={3}
            placeholder="Internal note (optional)"
            style={{ ...inputStyle, resize: "vertical" }}
          />
        </div>

        <div
          style={{
            marginTop: "1rem",
            border: "1px solid var(--color-shop-divider)",
            padding: "0.875rem",
          }}
        >
          <p
            style={{
              fontSize: "var(--text-label)",
              fontWeight: "var(--font-semibold)",
              letterSpacing: "var(--tracking-wide)",
              textTransform: "uppercase",
              color: "#6b6b6b",
              marginBottom: "0.75rem",
            }}
          >
            Shipping
          </p>
          <div style={{ display: "flex", gap: "0.75rem" }}>
            <input
              type="number"
              dir="ltr"
              step="0.01"
              min="0"
              placeholder="Shipping cost (AED)"
              value={shippingCost}
              onChange={(e) => setShippingCost(e.target.value)}
              style={{ ...inputStyle, flex: 1 }}
            />
            <input
              type="text"
              placeholder="Shipping method label"
              value={shippingMethodLabel}
              onChange={(e) => setShippingMethodLabel(e.target.value)}
              style={{ ...inputStyle, flex: 1 }}
            />
          </div>
        </div>

        <div style={{ marginTop: "1rem" }}>
          <p
            style={{
              fontSize: "var(--text-body-sm)",
              color: "#c9a24a",
              marginBottom: "0.375rem",
            }}
          >
            Note to customer — required, sent with the quote
          </p>
          <textarea
            value={sendNote}
            onChange={(e) => setSendNote(e.target.value)}
            rows={4}
            placeholder="Note to customer (required)"
            style={{
              ...inputStyle,
              resize: "vertical",
              backgroundColor: "#fdf9f0",
              borderLeft: "3px solid #c9a24a",
            }}
          />
        </div>

        <div style={{ marginTop: "1rem" }}>
          <label
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: "0.625rem",
              fontSize: "var(--text-body-sm)",
              color: "#0b0b0b",
              cursor: "pointer",
            }}
          >
            <input
              type="checkbox"
              checked={stockVerified}
              onChange={(e) => setStockVerified(e.target.checked)}
              style={{ marginTop: "0.1875rem" }}
            />
            I have verified stock availability for these quantities against
            business records
          </label>
          <div
            style={{
              backgroundColor: "#fffbeb",
              border: "1px solid #fde68a",
              padding: "0.875rem 1rem",
              marginTop: "0.75rem",
            }}
          >
            <p
              style={{
                fontSize: "var(--text-body-sm)",
                color: "#78350f",
                lineHeight: "var(--leading-relaxed)",
              }}
            >
              Quote-converted orders do not adjust catalog stock. Update the
              product stock figures in the catalog once this order is committed.
            </p>
          </div>
        </div>

        <div style={{ marginTop: "1rem" }}>
          <button
            type="button"
            onClick={() => setSaveOpen(true)}
            disabled={isPending || !canSubmitQuote}
            style={{
              ...btnBase,
              backgroundColor: "#166534",
              color: "#ffffff",
              opacity: isPending || !canSubmitQuote ? 0.5 : 1,
              cursor: isPending || !canSubmitQuote ? "not-allowed" : "pointer",
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
            Save & Send Quote
          </button>
        </div>
      </div>

      {error && (
        <p style={{ fontSize: "var(--text-body-sm)", color: "#991b1b" }}>
          {error}
        </p>
      )}

      <ConfirmDialog
        open={saveOpen}
        onClose={() => setSaveOpen(false)}
        onConfirm={() => {
          setSaveOpen(false);
          handleSavePricing();
        }}
        title="Send quote to customer?"
        message="This sets the quote to Quoted and emails the pricing to the customer. They'll be able to review and accept it."
        confirmLabel="Save & Send Quote"
        cancelLabel="Cancel"
        isPending={isPending}
        destructive={false}
      />
    </div>
  );
}

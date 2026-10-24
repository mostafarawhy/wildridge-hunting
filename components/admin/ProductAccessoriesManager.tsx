"use client";

import { useRef, useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Reorder } from "framer-motion";
import { useToast } from "@/components/ui/Toast";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import AccessoryPickerModal from "@/components/admin/AccessoryPickerModal";
import FadeImage from "@/components/ui/FadeImage";
import { formatAED } from "@/lib/utils/currency";
import { getImageUrl } from "@/lib/utils/images";
import {
  unlinkAccessoryAction,
  reorderAccessoriesAction,
} from "@/lib/actions/product-accessory";
import type {
  ProductAccessoryItem,
  LinkableAccessory,
} from "@/lib/db/queries/products";

interface Props {
  productId: string;
  productName: string;
  accessories: ProductAccessoryItem[];
  linkable: LinkableAccessory[];
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

const mutedText: React.CSSProperties = {
  fontSize: "var(--text-body-sm)",
  color: "var(--color-auth-input-placeholder)",
  margin: 0,
};

function statusLabel(status: string): string | null {
  if (status === "DRAFT") return "Draft · hidden on store";
  if (status === "ARCHIVED") return "Archived · hidden on store";
  return null;
}

const blackButton: React.CSSProperties = {
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
  border: "none",
  borderRadius: "0",
  cursor: "pointer",
  flexShrink: 0,
};

export default function ProductAccessoriesManager({
  productId,
  productName,
  accessories,
  linkable,
}: Props) {
  const router = useRouter();
  const toast = useToast();

  const [order, setOrder] = useState<ProductAccessoryItem[]>(accessories);
  const [isSavingOrder, setIsSavingOrder] = useState(false);
  const [removeTarget, setRemoveTarget] = useState<ProductAccessoryItem | null>(
    null,
  );
  const [isRemoving, setIsRemoving] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);

  const orderRef = useRef(order);
  const isSavingOrderRef = useRef(false);
  const dragMovedRef = useRef(false);
  const orderAtDragStartRef = useRef<ProductAccessoryItem[]>([]);

  useEffect(() => {
    orderRef.current = order;
  }, [order]);

  const linkedKey = accessories.map((l) => l.linkId).join(",");
  const [prevLinkedKey, setPrevLinkedKey] = useState(linkedKey);
  if (prevLinkedKey !== linkedKey) {
    setPrevLinkedKey(linkedKey);
    setOrder(accessories);
  }

  async function saveOrder(newOrder: ProductAccessoryItem[]) {
    if (isSavingOrderRef.current) return;

    isSavingOrderRef.current = true;
    setIsSavingOrder(true);

    const result = await reorderAccessoriesAction(
      productId,
      newOrder.map((l) => l.linkId),
    );

    isSavingOrderRef.current = false;
    setIsSavingOrder(false);

    if (!result.success) {
      toast.error(result.error);
    } else {
      toast.success("Order updated.");
    }
    router.refresh();
  }

  async function handleConfirmRemove() {
    if (!removeTarget) return;
    setIsRemoving(true);

    const result = await unlinkAccessoryAction(removeTarget.linkId, productId);

    setIsRemoving(false);
    setRemoveTarget(null);

    if (!result.success) {
      toast.error(result.error);
      return;
    }

    toast.success("Accessory removed.");
    router.refresh();
  }

  const allLinked = linkable.every((item) => item.linked);

  return (
    <div style={card}>
      <style>{`
        .palm-remove-btn { background: none; border: none; padding: 0; cursor: pointer; font-size: 13px; color: #0b0b0b; text-decoration: underline; line-height: 1; transition: color 120ms; white-space: nowrap; flex-shrink: 0; }
        .palm-remove-btn:hover { color: #991b1b !important; }
        .palm-remove-btn:disabled { opacity: 0.4; cursor: default; }
      `}</style>

      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: "1rem",
          paddingBottom: "0.875rem",
          borderBottom: "1px solid var(--color-shop-divider)",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
          <h2 style={cardTitle}>Accessories</h2>
          <p style={{ ...mutedText, color: "#4b4b4b" }}>
            Optional extras shown on this product&apos;s page. Customers add each
            one as its own cart line. Only published accessories appear on the
            store.
          </p>
        </div>
        <span
          style={{
            fontSize: 13,
            color: "var(--color-auth-input-placeholder)",
            flexShrink: 0,
          }}
        >
          {accessories.length} linked
        </span>
      </div>

      {order.length === 0 ? (
        <p style={mutedText}>
          No accessories linked yet. Add the extras shoppers often buy with
          this product, such as scopes, cases or cleaning kits.
        </p>
      ) : (
        <Reorder.Group
          as="div"
          axis="y"
          values={order}
          onReorder={setOrder}
          style={{ display: "flex", flexDirection: "column" }}
        >
          {order.map((link, idx) => {
            const hidden = statusLabel(link.publishStatus);
            return (
              <Reorder.Item
                as="div"
                key={link.linkId}
                value={link}
                onDragStart={() => {
                  dragMovedRef.current = false;
                  orderAtDragStartRef.current = orderRef.current;
                }}
                onDrag={() => {
                  dragMovedRef.current = true;
                }}
                onDragEnd={() => {
                  if (!dragMovedRef.current || isSavingOrderRef.current) return;
                  const startIds = orderAtDragStartRef.current
                    .map((l) => l.linkId)
                    .join(",");
                  const endIds = orderRef.current.map((l) => l.linkId).join(",");
                  if (startIds !== endIds) void saveOrder(orderRef.current);
                }}
                style={{ cursor: isSavingOrder ? "default" : "grab" }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: "1rem",
                    padding: "0.625rem 0",
                    borderBottom: "1px solid var(--color-shop-divider)",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "0.75rem",
                      minWidth: 0,
                    }}
                  >
                    <span
                      style={{
                        fontSize: 13,
                        color: "#9a9a9a",
                        flexShrink: 0,
                        width: "1.25rem",
                        textAlign: "right",
                      }}
                    >
                      {idx + 1}
                    </span>
                    <div
                      style={{
                        position: "relative",
                        width: 40,
                        height: 40,
                        flexShrink: 0,
                        backgroundColor: "var(--color-auth-input-bg)",
                        border: "1px solid var(--color-auth-input-border)",
                        overflow: "hidden",
                      }}
                    >
                      <FadeImage
                        src={getImageUrl(link.storageKey)}
                        alt={link.nameEn}
                        fill
                        sizes="40px"
                        className="object-contain"
                      />
                    </div>
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: "0.125rem",
                        minWidth: 0,
                      }}
                    >
                      <Link
                        href={`/admin/products/${link.productId}`}
                        style={{
                          fontSize: "var(--text-body)",
                          color: "#0b0b0b",
                          fontWeight: 500,
                        }}
                      >
                        {link.nameEn}
                      </Link>
                      <span
                        style={{
                          fontSize: 13,
                          color: "#9a9a9a",
                          display: "flex",
                          alignItems: "center",
                          gap: "0.25rem",
                          flexWrap: "wrap",
                        }}
                      >
                        <span>{link.categoryNameEn}</span>
                        <span aria-hidden="true">·</span>
                        <span dir="ltr">{formatAED(link.price, "en")}</span>
                        <span aria-hidden="true">·</span>
                        <span>{link.stockQuantity} in stock</span>
                      </span>
                      {hidden && (
                        <span
                          style={{
                            fontSize: 11,
                            color: "#6b6b6b",
                            backgroundColor: "#f3f4f6",
                            padding: "2px 6px",
                            lineHeight: 1.4,
                            alignSelf: "flex-start",
                          }}
                        >
                          {hidden}
                        </span>
                      )}
                    </div>
                  </div>

                  <button
                    type="button"
                    className="palm-remove-btn"
                    disabled={isSavingOrder}
                    aria-label={`Remove ${link.nameEn}`}
                    onClick={() => setRemoveTarget(link)}
                  >
                    Remove
                  </button>
                </div>
              </Reorder.Item>
            );
          })}
        </Reorder.Group>
      )}

      {order.length >= 2 && (
        <p style={mutedText}>
          Drag to reorder. Shoppers see published accessories in this order.
        </p>
      )}

      {allLinked ? (
        <p style={mutedText}>Every eligible product is already linked.</p>
      ) : (
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", flexWrap: "wrap" }}>
          <button
            type="button"
            onClick={() => setPickerOpen(true)}
            style={blackButton}
          >
            Add accessories
          </button>
          <p style={mutedText}>
            Find products by name, SKU, brand or category.
          </p>
        </div>
      )}

      <AccessoryPickerModal
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        productId={productId}
        productName={productName}
        items={linkable}
        linkedCount={accessories.length}
        onLinked={() => router.refresh()}
      />

      <ConfirmDialog
        open={removeTarget !== null}
        onClose={() => {
          if (!isRemoving) setRemoveTarget(null);
        }}
        onConfirm={handleConfirmRemove}
        title="Remove accessory"
        message={
          removeTarget
            ? `Remove "${removeTarget.nameEn}" from this product? It will no longer be offered on its page.`
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

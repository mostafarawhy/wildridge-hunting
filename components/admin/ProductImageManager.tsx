"use client";

import { useRef, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Reorder } from "framer-motion";
import { useToast } from "@/components/ui/Toast";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import Modal from "@/components/ui/Modal";
import Input from "@/components/ui/Input";
import { getImageUrl } from "@/lib/utils/images";
import {
  addProductImageAction,
  deleteProductImageAction,
  reorderProductImagesAction,
  updateProductImageAltTextAction,
} from "@/lib/actions/product-image";
import type { AdminProductImageItem } from "@/lib/db/queries/products";
import {
  MAX_MANUAL_IMAGE_SIZE_BYTES,
  ALLOWED_IMAGE_MIME_TYPES,
  MAX_PRODUCT_IMAGES,
  MAX_PRODUCT_IMAGE_ALT_LEN,
} from "@/lib/validations/product";

interface Props {
  productSku: string;
  productId: string;
  images: AdminProductImageItem[];
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

export default function ProductImageManager({
  productSku,
  productId,
  images,
}: Props) {
  const router = useRouter();
  const toast = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<AdminProductImageItem | null>(
    null,
  );
  const [isDeleting, setIsDeleting] = useState(false);
  const [order, setOrder] = useState<AdminProductImageItem[]>(images);
  const [isSavingOrder, setIsSavingOrder] = useState(false);
  const [previewImg, setPreviewImg] = useState<AdminProductImageItem | null>(
    null,
  );
  const [editAltImg, setEditAltImg] = useState<AdminProductImageItem | null>(null);
  const [altFieldEn, setAltFieldEn] = useState("");
  const [altFieldAr, setAltFieldAr] = useState("");
  const [altFieldRu, setAltFieldRu] = useState("");
  const [isSavingAlt, setIsSavingAlt] = useState(false);
  const [altFieldErrors, setAltFieldErrors] = useState<Record<string, string[] | undefined>>({});

  const orderRef = useRef(order);
  const isSavingOrderRef = useRef(false);
  const dragMovedRef = useRef(false);
  const orderAtDragStartRef = useRef<AdminProductImageItem[]>([]);

  useEffect(() => {
    orderRef.current = order;
  }, [order]);

  // Sync local order when server data changes (upload / delete / reorder refresh).
  // Derived-state-during-render: React re-renders once more when this fires, which
  // is the correct pattern for syncing state to a prop change without a useEffect.
  const imagesKey = images.map((i) => i.id).join(",");
  const [prevImagesKey, setPrevImagesKey] = useState(imagesKey);
  if (prevImagesKey !== imagesKey) {
    setPrevImagesKey(imagesKey);
    setOrder(images);
  }

  const atCap = images.length >= MAX_PRODUCT_IMAGES;

  async function saveOrder(newOrder: AdminProductImageItem[]) {
    if (isSavingOrderRef.current) return;

    isSavingOrderRef.current = true;
    setIsSavingOrder(true);

    const result = await reorderProductImagesAction(
      productId,
      productSku,
      newOrder.map((i) => i.id),
    );

    isSavingOrderRef.current = false;
    setIsSavingOrder(false);

    if (!result.success) {
      toast.error(result.error);
      router.refresh();
    } else {
      toast.success("Order updated.");
      router.refresh();
    }
  }

  async function handleFiles(files: FileList) {
    if (isUploading) return;
    const fileArray = Array.from(files);
    if (fileArray.length === 0) return;

    setIsUploading(true);
    let refreshNeeded = false;

    for (const file of fileArray) {
      if (file.size > MAX_MANUAL_IMAGE_SIZE_BYTES) {
        toast.error(`"${file.name}" exceeds the 4 MB size limit.`);
        break;
      }
      if (
        !ALLOWED_IMAGE_MIME_TYPES.includes(
          file.type as (typeof ALLOWED_IMAGE_MIME_TYPES)[number],
        )
      ) {
        toast.error(`"${file.name}" is not a supported image type.`);
        break;
      }

      const fd = new FormData();
      fd.set("productSku", productSku);
      fd.set("productId", productId);
      fd.set("file", file);

      const result = await addProductImageAction(fd);

      if (!result.success) {
        if (result.errorCode === "CAP_REACHED") {
          toast.error("Maximum 8 images reached.");
        } else {
          toast.error(result.error);
        }
        break;
      }

      toast.success(`"${file.name}" uploaded.`);
      refreshNeeded = true;
    }

    setIsUploading(false);
    if (refreshNeeded) router.refresh();
  }

  async function handleConfirmDelete() {
    if (!deleteTarget) return;
    setIsDeleting(true);
    const result = await deleteProductImageAction(deleteTarget.id, productId);
    setIsDeleting(false);
    setDeleteTarget(null);

    if (!result.success) {
      toast.error(result.error);
      return;
    }

    toast.success("Image deleted.");
    router.refresh();
  }

  async function handleSetPrimary(img: AdminProductImageItem) {
    if (isSavingOrderRef.current) return;
    const newOrder = [img, ...order.filter((i) => i.id !== img.id)];
    setOrder(newOrder);
    await saveOrder(newOrder);
  }

  async function handleSaveAltText() {
    if (!editAltImg || isSavingAlt) return;
    setIsSavingAlt(true);
    setAltFieldErrors({});

    const result = await updateProductImageAltTextAction(editAltImg.id, productId, {
      altTextEn: altFieldEn,
      altTextAr: altFieldAr,
      altTextRu: altFieldRu,
    });

    setIsSavingAlt(false);

    if (!result.success) {
      if (result.errorCode === "INVALID_INPUT" && result.fieldErrors) {
        setAltFieldErrors(result.fieldErrors);
      } else {
        toast.error(result.error);
      }
      return;
    }

    toast.success("Alt text saved.");
    router.refresh();
    setEditAltImg(null);
  }

  return (
    <div style={card}>
      <style>{`
        .pim-del-btn { color: #ffffff; transition: background-color 120ms, border-color 120ms; }
        .pim-del-btn:hover { background-color: var(--color-error) !important; border-color: var(--color-error) !important; }
        .pim-set-primary { background: none; border: none; padding: 0; cursor: pointer; font-size: 12px; color: #6b6b6b; line-height: 1; transition: color 120ms; white-space: nowrap; flex-shrink: 0; }
        .pim-set-primary:hover:not(:disabled) { color: #0b0b0b; }
        .pim-set-primary:disabled { opacity: 0.4; cursor: default; }
        .pim-alt-btn { transition: opacity 120ms; }
        .pim-alt-btn:hover { opacity: 0.8; }
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
        <h2 style={cardTitle}>Images</h2>
        <span
          dir="ltr"
          style={{ fontSize: 13, color: "var(--color-auth-input-placeholder)" }}
        >
          {images.length} / {MAX_PRODUCT_IMAGES}
        </span>
      </div>

      {/* Outer grid: Reorder.Group (display:contents) + add-tile share the same CSS grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(170px, 1fr))",
          gap: "0.75rem",
        }}
      >
        <Reorder.Group
          as="div"
          axis="x"
          values={order}
          onReorder={setOrder}
          style={{ display: "contents" }}
        >
          {order.map((img, idx) => (
            <Reorder.Item
              as="div"
              key={img.id}
              value={img}
              onDragStart={() => {
                dragMovedRef.current = false;
                orderAtDragStartRef.current = orderRef.current;
              }}
              onDrag={() => {
                dragMovedRef.current = true;
              }}
              onDragEnd={() => {
                if (!dragMovedRef.current || isSavingOrderRef.current) return;
                const startIds = orderAtDragStartRef.current.map((i) => i.id).join(",");
                const endIds = orderRef.current.map((i) => i.id).join(",");
                if (startIds !== endIds) void saveOrder(orderRef.current);
              }}
              style={{ cursor: isSavingOrder ? "default" : "grab" }}
            >
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  border: "1px solid var(--color-shop-divider)",
                  overflow: "hidden",
                  height: "100%",
                }}
              >
                {/* Image area — click opens preview; drag does not */}
                <div
                  style={{
                    position: "relative",
                    aspectRatio: "1",
                    backgroundColor: "#f5f5f5",
                    cursor: "pointer",
                  }}
                  onClick={() => {
                    if (dragMovedRef.current) {
                      dragMovedRef.current = false;
                      return;
                    }
                    setPreviewImg(img);
                  }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={getImageUrl(img.storageKey)}
                    alt={img.filename}
                    style={{
                      width: "100%",
                      height: "100%",
                      objectFit: "cover",
                      display: "block",
                    }}
                  />

                  {idx === 0 ? (
                    <span
                      style={{
                        position: "absolute",
                        top: 0,
                        insetInlineStart: 0,
                        backgroundColor: "#0b0b0b",
                        color: "#ffffff",
                        fontSize: 11,
                        textTransform: "uppercase",
                        letterSpacing: "0.08em",
                        padding: "3px 7px",
                        lineHeight: 1,
                      }}
                    >
                      Primary
                    </span>
                  ) : (
                    <span
                      style={{
                        position: "absolute",
                        top: 6,
                        insetInlineStart: 6,
                        backgroundColor: "rgba(255,255,255,0.92)",
                        color: "#6b6b6b",
                        fontSize: 11,
                        fontWeight: 500,
                        width: 20,
                        height: 20,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        lineHeight: 1,
                      }}
                    >
                      {idx + 1}
                    </span>
                  )}

                  <button
                    type="button"
                    className="pim-del-btn"
                    aria-label="Delete image"
                    onClick={(e) => {
                      e.stopPropagation();
                      setDeleteTarget(img);
                    }}
                    style={{
                      position: "absolute",
                      top: 6,
                      insetInlineEnd: 6,
                      width: 26,
                      height: 26,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      backgroundColor: "#0b0b0b",
                      border: "1px solid #0b0b0b",
                      cursor: "pointer",
                      padding: 0,
                    }}
                  >
                    <TrashIcon />
                  </button>

                  <button
                    type="button"
                    className="pim-alt-btn"
                    aria-label="Edit alt text"
                    onClick={(e) => {
                      e.stopPropagation();
                      setEditAltImg(img);
                      setAltFieldEn(img.altTextEn ?? "");
                      setAltFieldAr(img.altTextAr ?? "");
                      setAltFieldRu(img.altTextRu ?? "");
                      setAltFieldErrors({});
                    }}
                    style={{
                      position: "absolute",
                      bottom: 6,
                      insetInlineStart: 6,
                      backgroundColor: "#0b0b0b",
                      color: "#ffffff",
                      border: "1px solid #0b0b0b",
                      opacity: (img.altTextEn || img.altTextAr || img.altTextRu) ? 1 : 0.65,
                      fontSize: 11,
                      fontWeight: 500,
                      padding: "3px 7px",
                      lineHeight: 1,
                      cursor: "pointer",
                      borderRadius: 0,
                    }}
                  >
                    Alt
                  </button>
                </div>

                {/* Footer strip */}
                <div
                  style={{
                    borderTop: "1px solid var(--color-shop-divider)",
                    padding: "6px 8px",
                    backgroundColor: "#ffffff",
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                    minWidth: 0,
                  }}
                >
                  <span
                    dir="ltr"
                    style={{
                      display: "block",
                      fontSize: 13,
                      color: "var(--color-auth-input-placeholder)",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                      minWidth: 0,
                      flex: "1 1 0",
                    }}
                  >
                    {img.filename}
                  </span>
                  {idx !== 0 && (
                    <button
                      type="button"
                      className="pim-set-primary"
                      disabled={isSavingOrder}
                      onClick={(e) => {
                        e.stopPropagation();
                        void handleSetPrimary(img);
                      }}
                    >
                      Set primary
                    </button>
                  )}
                </div>
              </div>
            </Reorder.Item>
          ))}
        </Reorder.Group>

        {atCap ? (
          <p
            style={{
              fontSize: "var(--text-body-sm)",
              color: "var(--color-auth-input-placeholder)",
              margin: 0,
              alignSelf: "center",
            }}
          >
            Maximum 8 images
          </p>
        ) : (
          <>
            <input
              ref={inputRef}
              type="file"
              multiple
              accept="image/jpeg,image/png,image/webp"
              onChange={(e) => {
                if (e.target.files?.length) {
                  handleFiles(e.target.files);
                  e.target.value = "";
                }
              }}
              style={{
                position: "absolute",
                opacity: 0,
                width: 0,
                height: 0,
                pointerEvents: "none",
              }}
              aria-hidden="true"
              tabIndex={-1}
              disabled={isUploading}
            />
            <div
              role="button"
              tabIndex={0}
              onClick={() => {
                if (!isUploading) inputRef.current?.click();
              }}
              onKeyDown={(e) => {
                if ((e.key === "Enter" || e.key === " ") && !isUploading) {
                  e.preventDefault();
                  inputRef.current?.click();
                }
              }}
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragOver(false);
                if (!isUploading && e.dataTransfer.files.length) {
                  handleFiles(e.dataTransfer.files);
                }
              }}
              aria-label="Add images"
              style={{
                aspectRatio: "1",
                alignSelf: "start",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: "0.375rem",
                cursor: isUploading ? "not-allowed" : "pointer",
                backgroundColor: "#fafafa",
                border: dragOver
                  ? "1.5px dashed var(--color-auth-input-border-focus)"
                  : "1.5px dashed var(--color-auth-input-border)",
                opacity: isUploading ? 0.6 : 1,
                transition: "border-color 150ms, opacity 150ms",
              }}
            >
              <UploadIcon />
              <span
                style={{ fontSize: 13, color: "#6b6b6b", textAlign: "center" }}
              >
                {isUploading ? "Uploading…" : "Add images"}
              </span>
              <span
                style={{
                  fontSize: 11,
                  color: "var(--color-content-tertiary)",
                  textAlign: "center",
                }}
              >
                JPEG · PNG · WebP — 4 MB
              </span>
            </div>
          </>
        )}
      </div>

      <ConfirmDialog
        open={deleteTarget !== null}
        onClose={() => {
          if (!isDeleting) setDeleteTarget(null);
        }}
        onConfirm={handleConfirmDelete}
        title="Delete image"
        message={
          deleteTarget
            ? `Delete "${deleteTarget.filename}"? This cannot be undone.`
            : ""
        }
        confirmLabel="Delete"
        cancelLabel="Cancel"
        isPending={isDeleting}
        destructive
      />

      <Modal
        open={previewImg !== null}
        onClose={() => setPreviewImg(null)}
        ariaLabel={previewImg?.filename ?? "Image preview"}
        maxWidth={720}
      >
        {previewImg && (
          <div style={{ padding: "2.5rem 1.5rem 1.5rem" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={getImageUrl(previewImg.storageKey)}
              alt={previewImg.filename}
              style={{ maxWidth: "100%", height: "auto", display: "block" }}
            />
            <p
              dir="ltr"
              style={{
                fontSize: 13,
                color: "var(--color-auth-input-placeholder)",
                margin: "0.75rem 0 0",
              }}
            >
              {previewImg.filename}
            </p>
          </div>
        )}
      </Modal>

      <Modal
        open={editAltImg !== null}
        onClose={() => { if (!isSavingAlt) setEditAltImg(null); }}
        ariaLabel={editAltImg?.filename ?? "Edit alt text"}
        maxWidth={480}
      >
        {editAltImg && (
          <div>
            <div style={{ padding: "1.75rem 1.5rem 1.25rem" }}>
              <h3
                style={{
                  fontSize: "var(--text-body-lg)",
                  fontWeight: "var(--font-bold)",
                  color: "#0b0b0b",
                  margin: "0 0 0.25rem",
                }}
              >
                Alt text
              </h3>
              <p
                dir="ltr"
                style={{
                  fontSize: 13,
                  color: "var(--color-auth-input-placeholder)",
                  margin: "0 0 1.25rem",
                }}
              >
                {editAltImg.filename}
              </p>

              <div
                style={{
                  display: "flex",
                  gap: "1rem",
                  alignItems: "flex-start",
                  marginBottom: "1.25rem",
                }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={getImageUrl(editAltImg.storageKey)}
                  alt=""
                  style={{
                    width: 84,
                    height: 84,
                    objectFit: "cover",
                    flexShrink: 0,
                    border: "1px solid #e3e3e3",
                    display: "block",
                  }}
                />
                <p style={{ fontSize: 13, color: "#6b6b6b", margin: 0, lineHeight: 1.5 }}>
                  Describe the image for screen readers and search, in each language. Leave a field blank to clear it.
                </p>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "0.875rem" }}>
                <Input
                  id="alt-en"
                  label="English"
                  dir="ltr"
                  value={altFieldEn}
                  onChange={(e) => setAltFieldEn(e.target.value)}
                  disabled={isSavingAlt}
                  error={altFieldErrors.altTextEn?.[0]}
                  maxLength={MAX_PRODUCT_IMAGE_ALT_LEN}
                />
                <Input
                  id="alt-ar"
                  label="العربية"
                  dir="rtl"
                  value={altFieldAr}
                  onChange={(e) => setAltFieldAr(e.target.value)}
                  disabled={isSavingAlt}
                  error={altFieldErrors.altTextAr?.[0]}
                  maxLength={MAX_PRODUCT_IMAGE_ALT_LEN}
                  style={{ textAlign: "right" }}
                />
                <Input
                  id="alt-ru"
                  label="Русский"
                  dir="ltr"
                  value={altFieldRu}
                  onChange={(e) => setAltFieldRu(e.target.value)}
                  disabled={isSavingAlt}
                  error={altFieldErrors.altTextRu?.[0]}
                  maxLength={MAX_PRODUCT_IMAGE_ALT_LEN}
                />
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
                onClick={() => setEditAltImg(null)}
                disabled={isSavingAlt}
                style={{
                  fontSize: "var(--text-body)",
                  background: "none",
                  border: "none",
                  padding: 0,
                  textDecoration: "underline",
                  cursor: isSavingAlt ? "not-allowed" : "pointer",
                  color: "#0b0b0b",
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => { void handleSaveAltText(); }}
                disabled={isSavingAlt}
                style={{
                  padding: "0.5rem 1.125rem",
                  fontSize: "var(--text-body)",
                  backgroundColor: "#0b0b0b",
                  color: "#ffffff",
                  border: "1px solid #0b0b0b",
                  cursor: isSavingAlt ? "not-allowed" : "pointer",
                  opacity: isSavingAlt ? 0.6 : 1,
                }}
              >
                {isSavingAlt ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

function UploadIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      style={{ color: "var(--color-auth-input-placeholder)" }}
    >
      <path
        d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <polyline
        points="17 8 12 3 7 8"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <line
        x1="12"
        y1="3"
        x2="12"
        y2="15"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <polyline
        points="3 6 5 6 21 6"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

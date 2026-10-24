"use client";

import { useEffect, useRef, useState } from "react";
import Modal from "@/components/ui/Modal";
import { useZoom } from "@/hooks/useZoom";

export type MintDocumentUrl = (
  documentId: string,
  variant: "preview" | "view" | "download",
) => Promise<
  | { success: true; data: { url: string } }
  | { success: false; error: string; errorCode: string }
>;

interface DeclaredField {
  label: string;
  value: string;
}

export interface ManifestDoc {
  id: string;
  label: string;
  filename: string;
  mimeType: string | null;
  declaredFields: DeclaredField[];
  badge?: { text: string; emphasis: boolean };
}

interface Props {
  documents: ManifestDoc[];
  subjectName: string;
  emptyMessage?: string;
  showHeader?: boolean;
  mintUrl: MintDocumentUrl;
}

const IMAGE_EXTENSIONS = [".jpg", ".jpeg", ".png", ".webp", ".gif"];

function isImageDoc(doc: ManifestDoc): boolean {
  if (doc.mimeType) return doc.mimeType.startsWith("image/");
  return IMAGE_EXTENSIONS.some((ext) => doc.filename.toLowerCase().endsWith(ext));
}

function extOf(filename: string): string {
  const m = filename.toLowerCase().match(/\.([a-z0-9]+)$/);
  return m ? m[1].toUpperCase() : "";
}

function isMonoField(label: string): boolean {
  return label.includes("No.") || label.includes("Number");
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

function DeclaredFieldsBlock({ fields }: { fields: DeclaredField[] }) {
  if (fields.length === 0) return null;
  return (
    <div
      style={{
        backgroundColor: "#fffbeb",
        border: "1px solid #fde68a",
        borderRadius: "0",
        padding: "0.75rem 1rem",
        marginTop: "0.5rem",
      }}
    >
      {fields.map((f) => (
        <div
          key={f.label}
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: "1rem",
            padding: "0.25rem 0",
          }}
        >
          <span
            style={{
              fontSize: "var(--text-label)",
              textTransform: "uppercase",
              letterSpacing: "var(--tracking-wide)",
              color: "#92400e",
              fontWeight: "var(--font-semibold)",
              textAlign: "start",
            }}
          >
            {f.label}
          </span>
          <span
            style={{
              fontSize: "var(--text-body)",
              color: "#0b0b0b",
              fontWeight: "var(--font-bold)",
              textAlign: "end",
            }}
          >
            {f.value}
          </span>
        </div>
      ))}
    </div>
  );
}

function triggerBrowserDownload(url: string, filename: string): void {
  const a = window.document.createElement("a");
  a.href = url;
  a.download = filename;
  window.document.body.appendChild(a);
  a.click();
  window.document.body.removeChild(a);
}

function DownloadButton({
  doc,
  mintUrl,
  style,
}: {
  doc: ManifestDoc;
  mintUrl: MintDocumentUrl;
  style: React.CSSProperties;
}) {
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(false);

  async function handleClick() {
    setPending(true);
    setFailed(false);
    const result = await mintUrl(doc.id, "download");
    setPending(false);
    if (!result.success) {
      setFailed(true);
      return;
    }
    triggerBrowserDownload(result.data.url, doc.filename);
  }

  if (failed) {
    return (
      <span style={{ fontSize: "var(--text-body-sm)", color: "#6b6b6b" }}>
        Unavailable
      </span>
    );
  }

  return (
    <button type="button" onClick={handleClick} disabled={pending} style={style}>
      Download
    </button>
  );
}

function PlaceholderBox({ size, text }: { size: number; text?: string }) {
  return (
    <div
      style={{
        width: `${size}px`,
        height: `${size}px`,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        border: "1px solid var(--color-shop-divider)",
        backgroundColor: "#f5f5f5",
        fontSize: "var(--text-body-sm)",
        color: "#6b6b6b",
      }}
    >
      {text ?? ""}
    </div>
  );
}

function ZoomableDocImage({
  doc,
  label,
  url,
  failed,
  mintUrl,
}: {
  doc: ManifestDoc;
  label: string;
  url: string | undefined;
  failed: boolean;
  mintUrl: MintDocumentUrl;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const { scale, offset, isZoomed, isDragging, resetZoom, handlers } = useZoom({
    containerRef,
  });

  return (
    <div>
      <div
        ref={containerRef}
        {...handlers}
        style={{
          position: "relative",
          overflow: "hidden",
          width: "100%",
          height: "70vh",
          cursor: isZoomed ? (isDragging ? "grabbing" : "grab") : "zoom-in",
          touchAction: "none",
          userSelect: "none",
        }}
      >
        {url ? (
          <div
            style={{
              width: "100%",
              height: "100%",
              transform: `scale(${scale}) translate(${offset.x / scale}px, ${offset.y / scale}px)`,
              transformOrigin: "center center",
              transition: isDragging ? "none" : "transform 0.15s ease-out",
              position: "relative",
            }}
          >
            <img
              src={url}
              alt={label}
              style={{
                width: "100%",
                height: "100%",
                objectFit: "contain",
                display: "block",
              }}
              draggable={false}
            />
          </div>
        ) : (
          <div
            style={{
              width: "100%",
              height: "100%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: "#f5f5f5",
              color: "#6b6b6b",
              fontSize: "var(--text-body-sm)",
            }}
          >
            {failed ? "Unavailable" : ""}
          </div>
        )}

        {url && !isZoomed ? (
          <div
            className="absolute bottom-3 right-3 text-xs pointer-events-none"
            style={{
              color: "var(--color-content-tertiary)",
              backgroundColor: "#ffffff",
              padding: "4px 8px",
              borderRadius: "4px",
            }}
          >
            Scroll or pinch to zoom
          </div>
        ) : url && isZoomed ? (
          <button
            type="button"
            onClick={resetZoom}
            className="absolute bottom-3 right-3 text-xs"
            style={{
              color: "#ffffff",
              backgroundColor: "#0b0b0b",
              border: "none",
              padding: "4px 8px",
              borderRadius: "0",
              cursor: "pointer",
            }}
          >
            Reset zoom
          </button>
        ) : null}
      </div>

      <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "1rem" }}>
        <DownloadButton
          doc={doc}
          mintUrl={mintUrl}
          style={{
            ...btnBase,
            height: "2.5rem",
            paddingInline: "1.25rem",
            backgroundColor: "#0b0b0b",
            color: "#ffffff",
          }}
        />
      </div>
    </div>
  );
}

function OpenButton({
  doc,
  mintUrl,
  failed,
  onFailed,
}: {
  doc: ManifestDoc;
  mintUrl: MintDocumentUrl;
  failed: boolean;
  onFailed: () => void;
}) {
  const [pending, setPending] = useState(false);

  async function handleClick() {
    setPending(true);
    const result = await mintUrl(doc.id, "view");
    setPending(false);
    if (!result.success) {
      onFailed();
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

export default function DocumentManifest({
  documents,
  subjectName,
  emptyMessage = "No documents on file.",
  showHeader = true,
  mintUrl,
}: Props) {
  const [activeDoc, setActiveDoc] = useState<ManifestDoc | null>(null);
  const [viewUrls, setViewUrls] = useState<Record<string, string>>({});
  const [viewFailed, setViewFailed] = useState<Record<string, boolean>>({});

  const documentIds = documents.map((doc) => doc.id).join(",");

  useEffect(() => {
    let cancelled = false;
    const imageDocs = documents.filter(isImageDoc);
    for (const doc of imageDocs) {
      mintUrl(doc.id, "preview").then((result) => {
        if (cancelled) return;
        if (result.success) {
          setViewUrls((prev) => ({ ...prev, [doc.id]: result.data.url }));
        } else {
          setViewFailed((prev) => ({ ...prev, [doc.id]: true }));
        }
      });
    }
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- keyed on documentIds so previews mint once per document set
  }, [mintUrl, documentIds]);

  function markFailed(docId: string) {
    setViewFailed((prev) => ({ ...prev, [docId]: true }));
  }

  if (documents.length === 0) {
    return (
      <p
        style={{
          fontSize: "var(--text-body)",
          color: "#6b6b6b",
          padding: "1.25rem 1.25rem 1.5rem",
        }}
      >
        {emptyMessage}
      </p>
    );
  }

  return (
    <>
      {showHeader && (
        <div style={{ padding: "1rem 1.25rem 0" }}>
          <div
            style={{
              display: "flex",
              justifyContent: "flex-end",
              borderBottom: "1px solid var(--color-shop-divider)",
              paddingBottom: "0.75rem",
            }}
          >
            <span
              style={{
                fontSize: "var(--text-body-sm)",
                color: "#6b6b6b",
                textAlign: "end",
              }}
            >
              {subjectName} · {documents.length} files
            </span>
          </div>
        </div>
      )}

      <div style={{ padding: "0 1.25rem" }}>
        {documents.map((doc, idx) => {
          const imageDoc = isImageDoc(doc);
          const url = viewUrls[doc.id];
          const failed = viewFailed[doc.id] ?? false;
          const ext = extOf(doc.filename);

          return (
            <div
              key={doc.id}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "1.25rem",
                flexWrap: "wrap",
                padding: "1rem 0",
                borderBottom:
                  idx < documents.length - 1
                    ? "1px solid var(--color-shop-divider)"
                    : "none",
              }}
            >
              <div style={{ flex: "0 0 120px" }}>
                {imageDoc ? (
                  url ? (
                    <button
                      type="button"
                      onClick={() => setActiveDoc(doc)}
                      style={{
                        display: "block",
                        width: "120px",
                        height: "120px",
                        padding: 0,
                        border: "none",
                        backgroundColor: "#0b0b0b",
                        cursor: "pointer",
                      }}
                    >
                      <img
                        src={url}
                        alt={doc.label}
                        draggable={false}
                        style={{
                          width: "100%",
                          height: "120px",
                          objectFit: "cover",
                          display: "block",
                        }}
                      />
                    </button>
                  ) : (
                    <PlaceholderBox size={120} text={failed ? "Unavailable" : ""} />
                  )
                ) : (
                  <div
                    style={{
                      width: "120px",
                      height: "120px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      border: "1px solid var(--color-shop-divider)",
                      fontSize: "var(--text-label)",
                      color: "#6b6b6b",
                      textTransform: "uppercase",
                    }}
                  >
                    {ext}
                  </div>
                )}
              </div>

              <div style={{ flex: "1 1 0", minWidth: 0 }}>
                <p
                  style={{
                    fontSize: "var(--text-body)",
                    fontWeight: "var(--font-medium)",
                    color: "#0b0b0b",
                  }}
                >
                  {doc.label}
                  {doc.badge && (
                    <span
                      style={{
                        display: "inline-block",
                        marginInlineStart: "0.5rem",
                        paddingInline: "0.5rem",
                        paddingBlock: "0.125rem",
                        fontSize: "var(--text-label)",
                        fontWeight: "var(--font-semibold)",
                        letterSpacing: "var(--tracking-wide)",
                        textTransform: "uppercase",
                        verticalAlign: "middle",
                        color: doc.badge.emphasis ? "#1e40af" : "#6b6b6b",
                        border: doc.badge.emphasis
                          ? "1px solid #1e40af"
                          : "1px solid var(--color-shop-divider)",
                      }}
                    >
                      {doc.badge.text}
                    </span>
                  )}
                </p>
                <p
                  style={{
                    fontSize: "var(--text-label)",
                    color: "#6b6b6b",
                    marginTop: "0.125rem",
                  }}
                >
                  {doc.filename} · {ext}
                </p>
                {doc.declaredFields.map((f) => (
                  <div key={f.label} style={{ marginTop: "0.375rem" }}>
                    <p
                      style={{
                        fontSize: "var(--text-label)",
                        textTransform: "uppercase",
                        letterSpacing: "var(--tracking-wide)",
                        color: "#6b6b6b",
                      }}
                    >
                      {f.label}
                    </p>
                    <p
                      style={{
                        fontSize: "var(--text-body)",
                        color: "#0b0b0b",
                        fontFamily: isMonoField(f.label) ? "var(--font-mono)" : undefined,
                      }}
                    >
                      {f.value}
                    </p>
                  </div>
                ))}
              </div>

              <div style={{ flex: "0 0 auto", display: "flex", gap: "0.5rem" }}>
                {imageDoc ? (
                  <>
                    <button
                      type="button"
                      onClick={() => setActiveDoc(doc)}
                      disabled={!url}
                      style={{
                        ...btnBase,
                        backgroundColor: "#0b0b0b",
                        color: "#ffffff",
                      }}
                    >
                      Enlarge
                    </button>
                    <DownloadButton doc={doc} mintUrl={mintUrl} style={{ ...btnBase, backgroundColor: "#0b0b0b", color: "#ffffff" }} />
                  </>
                ) : (
                  <>
                    <OpenButton
                      doc={doc}
                      mintUrl={mintUrl}
                      failed={failed}
                      onFailed={() => markFailed(doc.id)}
                    />
                    <DownloadButton doc={doc} mintUrl={mintUrl} style={{ ...btnBase, backgroundColor: "#0b0b0b", color: "#ffffff" }} />
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <Modal
        open={activeDoc !== null}
        onClose={() => setActiveDoc(null)}
        maxWidth={900}
        ariaLabel={activeDoc ? `Preview: ${activeDoc.label}` : "Document preview"}
      >
        {activeDoc && (
          <div style={{ padding: "2rem" }}>
            <h2
              style={{
                fontSize: "var(--text-body-lg)",
                fontWeight: "var(--font-bold)",
                color: "#0b0b0b",
                marginBottom: "1rem",
                paddingInlineEnd: "2rem",
              }}
            >
              {activeDoc.label}
            </h2>
            <ZoomableDocImage
              key={activeDoc.id}
              doc={activeDoc}
              label={activeDoc.label}
              url={viewUrls[activeDoc.id]}
              failed={viewFailed[activeDoc.id] ?? false}
              mintUrl={mintUrl}
            />
            <DeclaredFieldsBlock fields={activeDoc.declaredFields} />
          </div>
        )}
      </Modal>
    </>
  );
}

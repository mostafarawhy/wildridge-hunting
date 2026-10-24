"use client";

import { useRef, useState } from "react";
import { useTranslations } from "next-intl";
import Modal from "@/components/ui/Modal";
import { useZoom } from "@/hooks/useZoom";

interface DocRow {
  id: string;
  type: string;
  mimeType: string;
  previewUrl: string | null;
  label: string | null;
}

interface Props {
  documents: DocRow[];
  heading: string;
  hint?: string;
  muted?: boolean;
  collapsible?: boolean;
}

function ZoomableDocImage({
  doc,
  typeLabel,
  t,
}: {
  doc: DocRow;
  typeLabel: string;
  t: ReturnType<typeof useTranslations>;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const { scale, offset, isZoomed, isDragging, resetZoom, handlers } = useZoom(
    { containerRef },
  );

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
            src={doc.previewUrl ?? ""}
            alt={typeLabel}
            style={{
              width: "100%",
              height: "100%",
              objectFit: "contain",
              display: "block",
            }}
            draggable={false}
          />
        </div>

        {!isZoomed ? (
          <div
            className="absolute bottom-3 end-3 text-xs pointer-events-none"
            style={{
              color: "var(--color-text-secondary, #888)",
              backgroundColor: "rgba(255,255,255,0.85)",
              padding: "4px 8px",
              borderRadius: "4px",
              backdropFilter: "blur(4px)",
            }}
          >
            {t("documents.zoomHint")}
          </div>
        ) : (
          <button
            type="button"
            onClick={resetZoom}
            className="absolute bottom-3 end-3 text-xs"
            style={{
              color: "var(--color-text-secondary, #888)",
              backgroundColor: "rgba(255,255,255,0.9)",
              border: "1px solid var(--color-shop-divider)",
              padding: "4px 8px",
              borderRadius: "4px",
              cursor: "pointer",
              backdropFilter: "blur(4px)",
            }}
          >
            {t("documents.resetZoom")}
          </button>
        )}
      </div>
    </div>
  );
}

export default function B2BDocumentStrip({
  documents,
  heading,
  hint,
  muted,
  collapsible,
}: Props) {
  const t = useTranslations("account.b2b");
  const [activeDoc, setActiveDoc] = useState<DocRow | null>(null);

  const typeLabel = (type: string, label: string | null) => {
    if (type === "TRADE_LICENSE") return t("documents.tradeLicense");
    if (type === "VAT_CERTIFICATE") return t("documents.vatCertificate");
    if (type === "COMPANY_ID") return t("documents.companyId");
    return label ?? t("documents.other");
  };

  const eyebrowStyle: React.CSSProperties = {
    fontSize: "var(--text-eyebrow)",
    fontWeight: "var(--font-bold)",
    letterSpacing: "var(--tracking-widest)",
    textTransform: "uppercase",
    color: "var(--color-content-tertiary)",
    marginBottom: hint ? "0.25rem" : "0.75rem",
  };

  const eyebrow = collapsible ? (
    <summary
      style={{
        ...eyebrowStyle,
        cursor: "pointer",
        listStyle: "none",
        WebkitAppearance: "none",
        display: "flex",
        alignItems: "center",
        gap: "0.5rem",
      }}
    >
      <svg
        className="disclosure-chevron"
        width="12"
        height="12"
        viewBox="0 0 12 12"
        fill="none"
        aria-hidden="true"
      >
        <path
          d="M4 2l4 4-4 4"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      {heading}
    </summary>
  ) : (
    <p style={eyebrowStyle}>{heading}</p>
  );

  const content = (
    <>
      {eyebrow}

      {hint && (
        <p
          style={{
            fontSize: "var(--text-body-sm)",
            color: "var(--color-content-tertiary)",
            marginBottom: "0.75rem",
          }}
        >
          {hint}
        </p>
      )}

      <div
        style={{
          display: "flex",
          gap: "0.75rem",
          flexWrap: "wrap",
          marginBottom: "0.5rem",
          opacity: muted ? 0.6 : 1,
        }}
      >
        {documents.map((doc) => {
          const label = typeLabel(doc.type, doc.label);
          const isImage = doc.mimeType.startsWith("image/");
          const tile: React.CSSProperties = {
            width: "96px",
            height: "96px",
            border: "1px solid var(--color-shop-divider)",
            objectFit: "cover",
            display: "block",
            backgroundColor: "var(--color-skeleton-base)",
          };
          return (
            <div
              key={doc.id}
              style={{ display: "flex", flexDirection: "column", gap: "0.375rem", width: "96px" }}
            >
              {isImage && doc.previewUrl ? (
                <button
                  type="button"
                  onClick={() => setActiveDoc(doc)}
                  style={{ padding: 0, border: "none", background: "none", cursor: "pointer" }}
                >
                  <img src={doc.previewUrl} alt={label} style={tile} />
                </button>
              ) : !isImage && doc.previewUrl ? (
                <a
                  href={doc.previewUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    ...tile,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    textAlign: "center",
                    fontSize: "var(--text-body-sm)",
                    color: "var(--color-content-inverse)",
                    textDecoration: "none",
                    padding: "0.5rem",
                  }}
                >
                  {t("documents.openPdf")}
                </a>
              ) : (
                <div
                  style={{
                    ...tile,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    textAlign: "center",
                    fontSize: "var(--text-body-sm)",
                    color: "var(--color-content-tertiary)",
                    padding: "0.5rem",
                  }}
                >
                  {t("documents.unavailable")}
                </div>
              )}
              <span style={{ fontSize: "var(--text-body-sm)", color: "var(--color-content-tertiary)", textAlign: "start" }}>
                {label}
              </span>
            </div>
          );
        })}
      </div>

      {documents.some((d) => d.mimeType.startsWith("image/") && d.previewUrl) && (
        <p style={{ fontSize: "var(--text-body-sm)", color: "var(--color-content-tertiary)" }}>
          {t("documents.enlargeHint")}
        </p>
      )}

      <Modal
        open={activeDoc !== null}
        onClose={() => setActiveDoc(null)}
        maxWidth={900}
        ariaLabel={heading}
      >
        {activeDoc && (
          <div style={{ padding: "2rem" }}>
            <h2
              style={{
                fontSize: "var(--text-body-lg)",
                fontWeight: "var(--font-bold)",
                color: "var(--color-content-inverse)",
                marginBottom: "1rem",
                paddingInlineEnd: "2rem",
              }}
            >
              {typeLabel(activeDoc.type, activeDoc.label)}
            </h2>
            <ZoomableDocImage
              key={activeDoc.id}
              doc={activeDoc}
              typeLabel={typeLabel(activeDoc.type, activeDoc.label)}
              t={t}
            />
          </div>
        )}
      </Modal>
    </>
  );

  return collapsible ? <details>{content}</details> : <div>{content}</div>;
}

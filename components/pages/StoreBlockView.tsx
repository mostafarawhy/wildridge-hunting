import { PhoneIcon, MailIcon } from "@/components/ui/icons";
import {
  localized,
  groupHours,
  openStatus,
  dayName,
  mapEmbedUrl,
  directionsUrl,
} from "@/lib/utils/stores";
import type { PublicStore } from "@/lib/db/queries/stores";

const ink = "var(--primitive-black)";
const muted = "var(--color-content-tertiary)";
const bodyText = "var(--color-auth-label-text)";
const hairline = "var(--color-shop-divider)";
const red = "var(--color-action-primary)";

export interface StoreBlockLabels {
  mainShowroom: string;
  showroom: string;
  openNow: string;
  closedNow: string;
  until: (time: string) => string;
  opensToday: (time: string) => string;
  opensOn: (day: string, time: string) => string;
  closed: string;
  hoursTitle: string;
  visitCta: string;
  callCta: string;
  mapTitle: string;
}

export function StoreBlockView({
  store,
  locale,
  compact = false,
  labels,
}: {
  store: PublicStore;
  locale: "en" | "ar" | "ru";
  compact?: boolean;
  labels: StoreBlockLabels;
}) {
  const name = localized(store, "name", locale) ?? store.nameEn;
  const address = localized(store, "address", locale) ?? store.addressEn;
  const description = localized(store, "description", locale);
  const hoursNote = localized(store, "hoursNote", locale);

  const status = openStatus(store.hours, new Date());
  const hoursRows = store.hours
    ? groupHours(store.hours, locale, labels.closed)
    : [];

  return (
    <div
      className="grid grid-cols-1 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]"
      style={{ border: `1px solid ${hairline}` }}
    >
      <div
        className="flex flex-col"
        style={{
          padding: compact ? "32px" : "48px",
          gap: compact ? "12px" : "16px",
        }}
      >
        <p
          style={{
            fontSize: "12px",
            fontWeight: 700,
            letterSpacing: "0.2em",
            textTransform: "uppercase",
            color: red,
          }}
        >
          {store.isPrimary ? labels.mainShowroom : labels.showroom}
        </p>
        <h2
          style={{
            fontSize: compact ? "24px" : "32px",
            fontWeight: 700,
            color: ink,
          }}
        >
          {name}
        </h2>
        <p style={{ fontSize: "16px", color: bodyText }}>{address}</p>

        {status && (
          <div className="flex items-center gap-2">
            {status.open ? (
              <>
                <span
                  style={{
                    fontSize: "11px",
                    fontWeight: 700,
                    color: "var(--color-positive)",
                    background: "var(--color-positive-soft-bg)",
                    padding: "2px 8px",
                  }}
                >
                  {labels.openNow}
                </span>
                <span style={{ fontSize: "14px", color: muted }}>
                  · {labels.until(status.until)}
                </span>
              </>
            ) : "never" in status ? (
              <span style={{ fontSize: "14px", color: muted }}>
                {labels.closedNow}
              </span>
            ) : (
              <span style={{ fontSize: "14px", color: muted }}>
                {labels.closedNow} ·{" "}
                {status.today
                  ? labels.opensToday(status.opensTime)
                  : labels.opensOn(
                      dayName(locale, status.opensDayIndex),
                      status.opensTime,
                    )}
              </span>
            )}
          </div>
        )}

        {hoursRows.length > 0 && (
          <div className="flex flex-col" style={{ gap: "4px" }}>
            <p style={{ fontSize: "12px", color: muted }}>
              {labels.hoursTitle}
            </p>
            <div>
              {hoursRows.map((row, i) => (
                <div
                  key={i}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    gap: "24px",
                    padding: "10px 0",
                    borderBottom:
                      i === hoursRows.length - 1 ? "none" : `1px solid ${hairline}`,
                  }}
                >
                  <span style={{ fontSize: "14px", color: muted }}>
                    {row.label}
                  </span>
                  <span style={{ fontSize: "13px", fontWeight: 700, color: ink }}>
                    <span dir="ltr">{row.value}</span>
                  </span>
                </div>
              ))}
            </div>
            {hoursNote && (
              <p style={{ fontSize: "14px", color: muted }}>{hoursNote}</p>
            )}
          </div>
        )}

        {store.phone && (
          <a
            href={`tel:${store.phone}`}
            className="flex items-center gap-2"
            style={{ fontSize: "15px", color: ink }}
          >
            <PhoneIcon size={16} />
            <span dir="ltr">{store.phone}</span>
          </a>
        )}
        {store.email && (
          <a
            href={`mailto:${store.email}`}
            className="flex items-center gap-2"
            style={{ fontSize: "15px", color: ink }}
          >
            <MailIcon size={16} />
            <span dir="ltr">{store.email}</span>
          </a>
        )}

        {description && (
          <p style={{ fontSize: "15px", color: muted }}>{description}</p>
        )}

        <div className="flex items-center gap-3">
          <a
            href={directionsUrl(store.latitude, store.longitude)}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-link btn-link--primary btn-link--md self-start"
          >
            {labels.visitCta}
          </a>
          {store.phone && (
            <a
              href={`tel:${store.phone}`}
              className="btn-link btn-link--outline btn-link--md self-start"
            >
              {labels.callCta}
            </a>
          )}
        </div>
      </div>
      <iframe
        title={labels.mapTitle}
        src={mapEmbedUrl(store.latitude, store.longitude)}
        loading="lazy"
        referrerPolicy="no-referrer-when-downgrade"
        width="100%"
        style={{
          minHeight: compact ? "280px" : "460px",
          border: 0,
          filter: "grayscale(0.35)",
        }}
      />
    </div>
  );
}

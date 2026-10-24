import type { LinkSlot } from "@/components/home/link-slot";

interface AnnouncementBarViewProps {
  shippingText: string | null;
  message: string;
  messageHref: string | null;
  storesLabel: string;
  link: LinkSlot;
}

export default function AnnouncementBarView({
  shippingText,
  message,
  messageHref,
  storesLabel,
  link,
}: AnnouncementBarViewProps) {
  return (
    <div
      className="w-full py-2 px-4 flex items-center justify-center"
      style={{
        backgroundColor: "var(--color-surface-sunken)",
        borderBottom: "1px solid var(--color-border-default)",
      }}
    >
      <div className="hidden lg:block flex-1" />
      <p
        className="text-eyebrow tracking-widest uppercase text-center"
        style={{ color: "var(--color-content-tertiary)" }}
      >
        {shippingText && (
          <>
            {shippingText}
            <span
              className="mx-3"
              style={{ color: "var(--color-content-disabled)" }}
            >
              ·
            </span>
          </>
        )}
        {messageHref ? (
          link({
            href: messageHref,
            className: "hover:opacity-70",
            style: { color: "var(--color-accent)" },
            children: message,
          })
        ) : (
          <span style={{ color: "var(--color-accent)" }}>{message}</span>
        )}
      </p>
      <div
        className="hidden lg:flex flex-1 items-center justify-end text-eyebrow tracking-widest uppercase"
        style={{ gap: "1rem" }}
      >
        {link({
          href: "/stores",
          className: "hover:opacity-70",
          style: { color: "var(--color-accent)" },
          children: storesLabel,
        })}
      </div>
    </div>
  );
}

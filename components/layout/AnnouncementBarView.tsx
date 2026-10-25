import type { LinkSlot } from "@/components/home/link-slot";
import AnnouncementRotator from "./AnnouncementRotator";

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
  const messageNode = messageHref ? (
    link({
      href: messageHref,
      className: "hover:opacity-70",
      style: { color: "var(--color-accent)" },
      children: message,
    })
  ) : (
    <span style={{ color: "var(--color-accent)" }}>{message}</span>
  );

  const items = [
    ...(shippingText
      ? [
          <span key="shipping" style={{ color: "var(--color-content-secondary)" }}>
            {shippingText}
          </span>,
        ]
      : []),
    <span key="message">{messageNode}</span>,
  ];

  return (
    <div
      className="w-full"
      style={{
        backgroundColor: "var(--color-surface-sunken)",
        borderBottom: "1px solid var(--color-border-default)",
      }}
    >
      <div
        className="lg:hidden py-2 px-4 text-eyebrow tracking-widest uppercase text-center"
        style={{ lineHeight: 1.5 }}
      >
        <AnnouncementRotator items={items} />
      </div>
      <div className="hidden lg:flex w-full py-2 px-4 items-center justify-center">
        <div className="hidden lg:block flex-1" />
        <p
          className="text-eyebrow tracking-widest uppercase text-center"
          style={{ color: "var(--color-content-secondary)" }}
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
          {messageNode}
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
    </div>
  );
}

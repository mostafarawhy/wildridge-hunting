import type { PublishStatus } from "@/app/generated/prisma/client";
import {
  PUBLISH_STATUS_LABELS,
  PUBLISH_STATUS_STYLES,
} from "@/lib/utils/product-status";

export default function PublishStatusPill({
  status,
}: {
  status: PublishStatus;
}) {
  const style = PUBLISH_STATUS_STYLES[status];
  return (
    <span
      style={{
        display: "inline-block",
        paddingInline: "0.5rem",
        paddingBlock: "0.125rem",
        fontSize: "var(--text-label)",
        fontWeight: "var(--font-semibold)",
        letterSpacing: "var(--tracking-wide)",
        textTransform: "uppercase",
        whiteSpace: "nowrap",
        ...style,
      }}
    >
      {PUBLISH_STATUS_LABELS[status]}
    </span>
  );
}

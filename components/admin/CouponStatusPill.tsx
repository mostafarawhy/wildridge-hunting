import {
  COUPON_STATUS_LABELS,
  COUPON_STATUS_STYLES,
  type CouponStatus,
} from "@/lib/utils/coupon-display";

export default function CouponStatusPill({ status }: { status: CouponStatus }) {
  const style = COUPON_STATUS_STYLES[status];
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
      {COUPON_STATUS_LABELS[status]}
    </span>
  );
}

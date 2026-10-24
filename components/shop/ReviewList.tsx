import { getTranslations } from "next-intl/server";

export interface Review {
  id: string;
  authorName: string;
  rating: number;
  body: string;
  createdAt: string;
  verified: boolean;
}

interface ReviewListProps {
  reviews: Review[];
}

function StarRating({ rating }: { rating: number }) {
  return (
    <div
      className="flex items-center gap-0.5"
      aria-label={`${rating} out of 5`}
    >
      {Array.from({ length: 5 }).map((_, i) => (
        <svg
          key={i}
          width="12"
          height="12"
          viewBox="0 0 12 12"
          fill="none"
          aria-hidden="true"
        >
          <path
            d="M6 1L7.545 4.13L11 4.635L8.5 7.07L9.09 10.51L6 8.885L2.91 10.51L3.5 7.07L1 4.635L4.455 4.13L6 1Z"
            fill={
              i < rating ? "var(--color-accent)" : "var(--color-border-default)"
            }
          />
        </svg>
      ))}
    </div>
  );
}

function ReviewCard({
  review,
  verifiedLabel,
}: {
  review: Review;
  verifiedLabel: string;
}) {
  const initials = review.authorName
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const date = new Date(review.createdAt).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });

  return (
    <div
      className="flex gap-4 py-5"
      style={{ borderBottom: "1px solid var(--color-border-default)" }}
    >
      <div
        className="flex-shrink-0 w-9 h-9 flex items-center justify-center text-body-sm font-bold"
        style={{
          backgroundColor: "var(--color-surface-overlay)",
          color: "var(--color-content-tertiary)",
          borderRadius: "var(--radius-none)",
        }}
      >
        {initials}
      </div>

      <div className="flex flex-col gap-2 flex-1 min-w-0">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span
            className="text-body font-bold"
            style={{ color: "var(--color-content-primary)" }}
          >
            {review.authorName}
          </span>

          <StarRating rating={review.rating} />

          {review.verified && (
            <span
              className="text-eyebrow tracking-widest uppercase"
              style={{ color: "var(--color-accent)" }}
            >
              ✓ {verifiedLabel}
            </span>
          )}

          <span
            className="text-body-sm ms-auto"
            style={{ color: "var(--color-content-tertiary)" }}
          >
            {date}
          </span>
        </div>

        <p
          className="text-body leading-relaxed"
          style={{ color: "var(--color-content-secondary)" }}
        >
          {review.body}
        </p>
      </div>
    </div>
  );
}

export default async function ReviewList({ reviews }: ReviewListProps) {
  const t = await getTranslations("shop");

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <p
          className="text-eyebrow tracking-widest uppercase"
          style={{ color: "var(--color-content-tertiary)" }}
        >
          {t("reviews_label")}{" "}
          {reviews.length > 0 && (
            <span style={{ color: "var(--color-content-primary)" }}>
              ({reviews.length})
            </span>
          )}
        </p>
      </div>

      {reviews.length === 0 ? (
        <div
          className="py-12 text-center"
          style={{ borderTop: "1px solid var(--color-border-default)" }}
        >
          <p
            className="text-body"
            style={{ color: "var(--color-content-tertiary)" }}
          >
            {t("no_reviews")}
          </p>
        </div>
      ) : (
        <div style={{ borderTop: "1px solid var(--color-border-default)" }}>
          {reviews.map((review) => (
            <ReviewCard
              key={review.id}
              review={review}
              verifiedLabel={t("verified_purchase")}
            />
          ))}
        </div>
      )}
    </div>
  );
}

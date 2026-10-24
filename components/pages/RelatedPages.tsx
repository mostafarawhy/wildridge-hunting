import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { PAGE_CONFIG, RELATED_KEYS, type PageKey } from "@/lib/utils/page-keys";
import { listPublishedPageKeys } from "@/lib/db/queries/pages";

const ink = "var(--primitive-black)";

function ChevronIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke={ink}
      strokeWidth="1.6"
      className="rtl:-scale-x-100"
    >
      <polyline points="9 6 15 12 9 18" />
    </svg>
  );
}

export async function RelatedPages({
  current,
  title,
}: {
  current: PageKey;
  title?: string;
}) {
  const t = await getTranslations("pages.related");
  const tFooter = await getTranslations("footer");
  const publishedKeys = await listPublishedPageKeys();
  const related = RELATED_KEYS.filter(
    (key) => key !== current && publishedKeys.includes(key),
  );

  if (related.length === 0) return null;

  return (
    <div className="flex flex-col">
      <p style={{ fontSize: "16px", fontWeight: 700, color: ink, marginBottom: "8px" }}>
        {title ?? t("title")}
      </p>
      {related.map((key, i) => (
        <Link
          key={key}
          href={`/${key}`}
          className="flex items-center justify-between"
          style={{
            fontSize: "15px",
            padding: "10px 0",
            borderBottom: i === related.length - 1 ? "none" : "1px solid #f0ece7",
            color: ink,
          }}
        >
          <span>{tFooter(PAGE_CONFIG[key].footerLeaf)}</span>
          <ChevronIcon />
        </Link>
      ))}
    </div>
  );
}

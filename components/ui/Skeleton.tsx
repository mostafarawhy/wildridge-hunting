type Tone = "light" | "dark";

interface SkeletonBaseProps {
  className?: string;
  style?: React.CSSProperties;
  tone?: Tone;
}

function SkeletonBase({ className = "", style, tone = "light" }: SkeletonBaseProps) {
  return (
    <div
      className={["sk-shimmer", tone === "dark" ? "sk-shimmer--dark" : "", className]
        .filter(Boolean)
        .join(" ")}
      style={style}
      aria-hidden="true"
    />
  );
}

function SkeletonText({
  width = "100%",
  className = "",
  tone,
}: {
  width?: string | number;
  className?: string;
  tone?: Tone;
}) {
  return (
    <SkeletonBase className={className} tone={tone} style={{ height: "0.75rem", width }} />
  );
}

function SkeletonImage({
  aspectRatio = "1/1",
  className = "",
  tone,
}: {
  aspectRatio?: string;
  className?: string;
  tone?: Tone;
}) {
  return (
    <SkeletonBase
      className={["w-full", className].join(" ")}
      tone={tone}
      style={{ aspectRatio }}
    />
  );
}

function SkeletonBlock({
  height = "1rem",
  width = "100%",
  className = "",
  tone,
}: {
  height?: string | number;
  width?: string | number;
  className?: string;
  tone?: Tone;
}) {
  return <SkeletonBase className={className} tone={tone} style={{ height, width }} />;
}

function SkeletonProductCard() {
  return (
    <div className="flex flex-col">
      <SkeletonImage aspectRatio="1/1" className="mb-3" />
      <SkeletonText width="35%" className="mb-2" />
      <SkeletonText width="80%" className="mb-1.5" />
      <SkeletonText width="60%" className="mb-3" />
      <SkeletonText width="30%" />
    </div>
  );
}

const Skeleton = {
  Text: SkeletonText,
  Image: SkeletonImage,
  Block: SkeletonBlock,
  ProductCard: SkeletonProductCard,
};

export default Skeleton;

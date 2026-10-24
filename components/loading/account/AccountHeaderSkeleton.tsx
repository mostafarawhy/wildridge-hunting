import Skeleton from "@/components/ui/Skeleton";

interface Props {
  help?: boolean;
  subtitle?: boolean;
  titleWidth?: string;
}

export default function AccountHeaderSkeleton({
  help = true,
  subtitle = true,
  titleWidth = "12rem",
}: Props) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        flexWrap: "wrap",
        gap: "1rem",
      }}
    >
      <div style={{ minWidth: 0 }}>
        <Skeleton.Block height="1.75rem" width={titleWidth} />
        {subtitle && <Skeleton.Text width="18rem" className="mt-1" />}
      </div>
      {help && (
        <div
          style={{
            height: "2rem",
            width: "7rem",
            border: "1px solid var(--color-auth-form-border)",
            flexShrink: 0,
          }}
        />
      )}
    </div>
  );
}

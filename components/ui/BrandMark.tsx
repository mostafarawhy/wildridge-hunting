import Image from "next/image";
import { BRAND } from "@/lib/config/brand";

interface BrandMarkProps {
  size?: number;
  className?: string;
  style?: React.CSSProperties;
  priority?: boolean;
}

export default function BrandMark({
  size = 24,
  className,
  style,
  priority,
}: BrandMarkProps) {
  const width = Math.round((size * BRAND.logo.width) / BRAND.logo.height);
  return (
    <Image
      src={BRAND.logo.src}
      width={width}
      height={size}
      alt=""
      aria-hidden="true"
      priority={priority}
      className={className}
      style={{ display: "block", ...style }}
    />
  );
}

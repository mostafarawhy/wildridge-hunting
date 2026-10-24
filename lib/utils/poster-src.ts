import { getImageProps } from "next/image";
import { isPreviewSrc } from "@/lib/utils/images";

export function posterSrc(src: string): string {
  if (isPreviewSrc(src)) return src;
  return getImageProps({ src, alt: "", width: 960, height: 540, quality: 75 }).props
    .src;
}

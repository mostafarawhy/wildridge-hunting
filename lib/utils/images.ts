import { clientEnv } from "@/lib/env.client";
import { SITE_MEDIA_BUCKET } from "@/lib/settings/home-video";

const SUPABASE_URL = clientEnv.NEXT_PUBLIC_SUPABASE_URL ?? "";
const PLACEHOLDER = "/images/brand/rifle-showcase.png";
const NO_IMAGE = "/images/brand/no-image.svg";

export function getImageUrl(
  storageKey: string | null | undefined,
  bucket: string = "product-images",
): string {
  if (!storageKey) return NO_IMAGE;
  if (!SUPABASE_URL) return PLACEHOLDER;

  if (clientEnv.NEXT_PUBLIC_USE_PLACEHOLDER_IMAGES === "true")
    return PLACEHOLDER;

  return `${SUPABASE_URL}/storage/v1/object/public/${bucket}/${storageKey}`;
}

export function isPreviewSrc(src: string): boolean {
  return src.startsWith("blob:") || src.startsWith("data:");
}

export function getContentImageUrl(storageKey: string): string | null {
  if (!SUPABASE_URL) return null;
  return `${SUPABASE_URL}/storage/v1/object/public/product-images/${storageKey}`;
}

export function getContentVideoUrl(storageKey: string): string | null {
  if (!SUPABASE_URL) return null;
  return `${SUPABASE_URL}/storage/v1/object/public/${SITE_MEDIA_BUCKET}/${storageKey}`;
}

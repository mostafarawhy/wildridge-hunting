export const IMPORT_IMAGE_TYPES = {
  "image/jpeg": ["jpg", "jpeg"],
  "image/png": ["png"],
  "image/webp": ["webp"],
} as const;

export type ImportImageType = keyof typeof IMPORT_IMAGE_TYPES;

export const IMPORT_IMAGE_TARGETS = ["product"] as const;

export type ImportImageTarget = (typeof IMPORT_IMAGE_TARGETS)[number];

export const IMPORT_IMAGE_NAME_RE = /^[A-Za-z0-9._-]+$/;

export function imageExtension(name: string): string | null {
  const dot = name.lastIndexOf(".");
  if (dot < 1 || dot === name.length - 1) return null;
  return name.slice(dot + 1).toLowerCase();
}

export function sniffImageType(head: Uint8Array): ImportImageType | null {
  if (head.length >= 3 && head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff) {
    return "image/jpeg";
  }
  if (
    head.length >= 8 &&
    head[0] === 0x89 &&
    head[1] === 0x50 &&
    head[2] === 0x4e &&
    head[3] === 0x47 &&
    head[4] === 0x0d &&
    head[5] === 0x0a &&
    head[6] === 0x1a &&
    head[7] === 0x0a
  ) {
    return "image/png";
  }
  if (
    head.length >= 12 &&
    head[0] === 0x52 &&
    head[1] === 0x49 &&
    head[2] === 0x46 &&
    head[3] === 0x46 &&
    head[8] === 0x57 &&
    head[9] === 0x45 &&
    head[10] === 0x42 &&
    head[11] === 0x50
  ) {
    return "image/webp";
  }
  return null;
}

export function typeMatchesExtension(type: ImportImageType, name: string): boolean {
  const ext = imageExtension(name);
  return ext !== null && (IMPORT_IMAGE_TYPES[type] as readonly string[]).includes(ext);
}

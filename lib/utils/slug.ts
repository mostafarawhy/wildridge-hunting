import slugify from "slugify";

export const SLUG_MAX_LENGTH = 200;

export function slugFromName(name: string): string {
  return slugify(name, { lower: true, strict: true, trim: true })
    .slice(0, SLUG_MAX_LENGTH)
    .replace(/-+$/, "");
}

export function slugWithSuffix(base: string, n: number): string {
  const suffix = `-${n}`;
  return `${base.slice(0, SLUG_MAX_LENGTH - suffix.length)}${suffix}`;
}

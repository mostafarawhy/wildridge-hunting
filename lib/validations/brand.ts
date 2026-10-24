import { z } from "zod";

function optStr(maxLen?: number) {
  let s: z.ZodString = z.string();
  if (maxLen !== undefined) s = s.max(maxLen);
  return z.preprocess((v) => {
    if (v == null) return null;
    const str = (typeof v === "string" ? v : String(v)).trim();
    return str === "" ? null : str;
  }, s.nullable());
}

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const SLUG_MESSAGE = "Use lowercase letters, numbers and single hyphens.";

const BrandNameFields = {
  nameEn: z.string().trim().min(1, "English name is required").max(100),
  nameAr: optStr(100),
  nameRu: optStr(100),
};

export const CreateBrandSchema = z.object({
  ...BrandNameFields,
  slug: z.preprocess(
    (v) => {
      if (v == null) return undefined;
      const str = (typeof v === "string" ? v : String(v)).trim();
      return str === "" ? undefined : str;
    },
    z.string().max(200).regex(SLUG_PATTERN, SLUG_MESSAGE).optional(),
  ),
});

export const UpdateBrandSchema = z.object({
  ...BrandNameFields,
  slug: z.string().trim().min(1, "Enter a web handle.").max(200).regex(SLUG_PATTERN, SLUG_MESSAGE),
});

export type CreateBrandInput = z.infer<typeof CreateBrandSchema>;
export type UpdateBrandInput = z.infer<typeof UpdateBrandSchema>;

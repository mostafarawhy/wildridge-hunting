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

const CategoryBaseObject = z.object({
  nameEn: z.string().trim().min(1, "English name is required").max(120),
  nameAr: z.string().trim().min(1, "Arabic name is required"),
  nameRu: optStr(120),
  slug: z
    .string()
    .trim()
    .min(1, "Enter a web address.")
    .regex(
      /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
      "Use lowercase letters, numbers and hyphens only.",
    ),
  parentId: optStr(),
  displayOrder: z.coerce
    .number({ error: "Enter a whole number, 0 or more." })
    .int("Enter a whole number, 0 or more.")
    .min(0, "Enter a whole number, 0 or more.")
    .default(0),
  navGroup: z.preprocess(
    (v) => (v == null || v === "" ? null : v),
    z
      .enum(["RIFLES", "OPTICS", "ACCESSORIES", "AMMO"], {
        error: "Choose a menu group.",
      })
      .nullable(),
  ).default(null),
});

export const CreateCategorySchema = CategoryBaseObject;
export const UpdateCategorySchema = CategoryBaseObject;

export type CreateCategoryInput = z.infer<typeof CreateCategorySchema>;
export type UpdateCategoryInput = z.infer<typeof UpdateCategorySchema>;

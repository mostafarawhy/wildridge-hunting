import { z } from "zod";
import { STORE_DAYS, TIME_PATTERN, parseMapPin } from "@/lib/utils/stores";

function optStr(maxLen?: number) {
  let s: z.ZodString = z.string();
  if (maxLen !== undefined) s = s.max(maxLen);
  return z.preprocess((v) => {
    if (v == null) return null;
    const str = (typeof v === "string" ? v : String(v)).trim();
    return str === "" ? null : str;
  }, s.nullable());
}

function optEmail() {
  return z.preprocess((v) => {
    if (v == null) return null;
    const str = (typeof v === "string" ? v : String(v)).trim();
    return str === "" ? null : str;
  }, z.string().email("Enter a valid email address").nullable());
}

const DayHoursInput = z.object({
  closed: z.boolean(),
  open: z.string(),
  close: z.string(),
});

const HoursObject = z.object({
  sat: DayHoursInput,
  sun: DayHoursInput,
  mon: DayHoursInput,
  tue: DayHoursInput,
  wed: DayHoursInput,
  thu: DayHoursInput,
  fri: DayHoursInput,
});

export const StoreSchema = z
  .object({
    nameEn: z.string().trim().min(1, "English name is required").max(120),
    nameAr: optStr(120),
    nameRu: optStr(120),
    addressEn: z
      .string()
      .trim()
      .min(1, "English address is required")
      .max(300),
    addressAr: optStr(300),
    addressRu: optStr(300),
    descriptionEn: optStr(600),
    descriptionAr: optStr(600),
    descriptionRu: optStr(600),
    hoursNoteEn: optStr(200),
    hoursNoteAr: optStr(200),
    hoursNoteRu: optStr(200),
    phone: optStr(50),
    email: optEmail(),
    pin: z.string().trim().refine((v) => parseMapPin(v) != null, {
      message: "Paste coordinates like 25.1352, 55.2271 or a Google Maps link.",
    }),
    showHours: z.boolean().default(false),
    hours: HoursObject,
    isActive: z.boolean().default(true),
    isPrimary: z.boolean().default(false),
    displayOrder: z.coerce.number().int().min(0).default(0),
  })
  .superRefine((data, ctx) => {
    if (!data.showHours) return;
    for (const day of STORE_DAYS) {
      const d = data.hours[day];
      if (d.closed) continue;
      if (
        !TIME_PATTERN.test(d.open) ||
        !TIME_PATTERN.test(d.close) ||
        d.open === d.close
      ) {
        ctx.addIssue({
          code: "custom",
          message: "Each open day needs an opening and a closing time.",
          path: ["hours"],
        });
        break;
      }
    }
  });

export type StoreInput = z.infer<typeof StoreSchema>;

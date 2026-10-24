import { z } from "zod";
import {
  BUTTON_COLORS_BY_THEME,
  HOME_POPUP_BUTTON_COLORS,
  HOME_POPUP_PURPOSES,
  HOME_POPUP_THEMES,
} from "@/lib/utils/home-popup";

function text(max: number, label: string) {
  return z
    .string()
    .trim()
    .max(max, `${label} must be ${max} characters or fewer.`);
}

export const dayField = z
  .string()
  .refine(
    (v) =>
      v === "" ||
      (/^\d{4}-\d{2}-\d{2}$/.test(v) &&
        !Number.isNaN(Date.parse(`${v}T00:00:00.000+04:00`))),
    "Enter a date like 2026-03-31.",
  );

export const HomePopupSchema = z
  .object({
    titleEn: text(80, "The English heading"),
    titleAr: text(80, "The Arabic heading"),
    titleRu: text(80, "The Russian heading"),
    subtitleEn: text(240, "The English text"),
    subtitleAr: text(240, "The Arabic text"),
    subtitleRu: text(240, "The Russian text"),
    ctaEn: text(30, "The English button text"),
    ctaAr: text(30, "The Arabic button text"),
    ctaRu: text(30, "The Russian button text"),
    linkUrl: z
      .string()
      .trim()
      .refine(
        (v) => v === "" || /^\/(?![\/\\])/.test(v) || v.startsWith("https://"),
        "Use a page on this site such as /shop/optics, or a full https:// link.",
      ),
    isActive: z.enum(["true", "false"]),
    theme: z.enum(HOME_POPUP_THEMES),
    buttonColor: z.enum(HOME_POPUP_BUTTON_COLORS),
    purpose: z.enum(HOME_POPUP_PURPOSES),
    startsOn: dayField,
    endsOn: dayField,
  })
  .refine((d) => !d.startsOn || !d.endsOn || d.endsOn >= d.startsOn, {
    message: "End date must be on or after the start date",
    path: ["endsOn"],
  })
  .refine((d) => BUTTON_COLORS_BY_THEME[d.theme].includes(d.buttonColor), {
    message: "This button colour can't be read on this theme. Choose another.",
    path: ["buttonColor"],
  });

export type HomePopupInput = z.infer<typeof HomePopupSchema>;

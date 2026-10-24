import { z } from "zod";

export const HOME_POPUP_THEMES = ["dark", "light"] as const;
export const HOME_POPUP_BUTTON_COLORS = ["gold", "red", "black", "white"] as const;

export const HOME_POPUP_PURPOSES = ["link", "newsletter"] as const;

export type HomePopupTheme = (typeof HOME_POPUP_THEMES)[number];
export type HomePopupButtonColor = (typeof HOME_POPUP_BUTTON_COLORS)[number];
export type HomePopupPurpose = (typeof HOME_POPUP_PURPOSES)[number];

export const homePopupStyleSchema = z.object({
  theme: z.enum(HOME_POPUP_THEMES),
  buttonColor: z.enum(HOME_POPUP_BUTTON_COLORS),
  purpose: z.enum(HOME_POPUP_PURPOSES).default("link"),
});

export type HomePopupStyle = z.infer<typeof homePopupStyleSchema>;

export const DEFAULT_HOME_POPUP_STYLE: HomePopupStyle = {
  theme: "dark",
  buttonColor: "gold",
  purpose: "link",
};

export const BUTTON_COLORS_BY_THEME: Record<
  HomePopupTheme,
  readonly HomePopupButtonColor[]
> = {
  dark: ["gold", "red", "white"],
  light: ["gold", "red", "black"],
};

export const popupButtonColors: Record<
  HomePopupButtonColor,
  { bg: string; fg: string }
> = {
  gold: { bg: "var(--primitive-gold)", fg: "var(--primitive-black)" },
  red: { bg: "var(--color-action-primary)", fg: "var(--color-action-primary-fg)" },
  black: { bg: "var(--primitive-black)", fg: "var(--primitive-white)" },
  white: { bg: "var(--primitive-white)", fg: "var(--primitive-black)" },
};

export const BUTTON_COLOR_LABELS: Record<HomePopupButtonColor, string> = {
  gold: "Gold",
  red: "Brand",
  black: "Black",
  white: "White",
};

export function parseHomePopupStyle(value: unknown): HomePopupStyle {
  const parsed = homePopupStyleSchema.safeParse(value);
  return parsed.success ? parsed.data : DEFAULT_HOME_POPUP_STYLE;
}

export interface PopupCopyRow {
  titleEn: string | null;
  titleAr: string | null;
  titleRu: string | null;
  subtitleEn: string | null;
  subtitleAr: string | null;
  subtitleRu: string | null;
  ctaEn: string | null;
  ctaAr: string | null;
  ctaRu: string | null;
}

export interface PopupCopy {
  title: string | null;
  subtitle: string | null;
  cta: string | null;
  fallback: boolean;
}

export function resolvePopupCopy(row: PopupCopyRow, locale: string): PopupCopy {
  const localized =
    locale === "ar"
      ? { title: row.titleAr, subtitle: row.subtitleAr, cta: row.ctaAr }
      : locale === "ru"
        ? { title: row.titleRu, subtitle: row.subtitleRu, cta: row.ctaRu }
        : null;

  const chosen =
    localized !== null && !!localized.title?.trim() && !!localized.cta?.trim()
      ? localized
      : null;
  const fallback = localized !== null && chosen === null;

  return {
    title: chosen ? chosen.title : row.titleEn,
    subtitle: chosen ? chosen.subtitle : row.subtitleEn,
    cta: chosen ? chosen.cta : row.ctaEn,
    fallback,
  };
}

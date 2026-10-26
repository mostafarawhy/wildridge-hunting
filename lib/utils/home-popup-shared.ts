import type { HomePopupButtonColor } from "./home-popup";

export const popupButtonColors: Record<
  HomePopupButtonColor,
  { bg: string; fg: string }
> = {
  gold: { bg: "var(--primitive-gold)", fg: "var(--primitive-black)" },
  red: { bg: "var(--color-action-primary)", fg: "var(--color-action-primary-fg)" },
  black: { bg: "var(--primitive-black)", fg: "var(--primitive-white)" },
  white: { bg: "var(--primitive-white)", fg: "var(--primitive-black)" },
};

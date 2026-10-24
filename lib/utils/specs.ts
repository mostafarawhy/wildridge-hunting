export function getSpecLabel(
  spec: { labelEn: string; labelAr: string; labelRu?: string | null },
  locale: string,
): string {
  if (locale === "ar") return spec.labelAr;
  if (locale === "ru") return spec.labelRu ?? spec.labelEn;
  return spec.labelEn;
}

export function getSpecValue(
  spec: { valueEn: string; valueAr: string; valueRu?: string | null },
  locale: string,
): string {
  if (locale === "ar") return spec.valueAr;
  if (locale === "ru") return spec.valueRu ?? spec.valueEn;
  return spec.valueEn;
}

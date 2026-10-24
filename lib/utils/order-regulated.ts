export function isRegulatedOrder(
  complianceSnapshot: unknown,
  items: { product: { requiresIdVerification: boolean } | null }[],
): boolean {
  const restricted =
    complianceSnapshot !== null &&
    typeof complianceSnapshot === "object" &&
    Array.isArray(
      (complianceSnapshot as { restrictedSkus?: unknown }).restrictedSkus,
    ) &&
    (complianceSnapshot as { restrictedSkus: unknown[] }).restrictedSkus
      .length > 0;
  return (
    restricted ||
    items.some((item) => item.product?.requiresIdVerification === true)
  );
}

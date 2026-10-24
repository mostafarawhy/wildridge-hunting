import "server-only";
import { db } from "@/lib/db/client";

export async function getAdminProductSpecs(sku: string) {
  return db.productSpec.findMany({
    where: { productSku: sku },
    orderBy: [{ displayOrder: "asc" }, { labelEn: "asc" }],
    select: {
      id: true,
      labelEn: true,
      labelAr: true,
      labelRu: true,
      valueEn: true,
      valueAr: true,
      valueRu: true,
    },
  });
}

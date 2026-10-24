import { PrismaClient } from "../../app/generated/prisma/client";
import { logSection, logDone } from "./seed-utils";

export async function seedShipping(db: PrismaClient) {
  logSection("Shipping");

  const uaeZone = await db.shippingZone.upsert({
    where: { code: "UAE" },
    update: {},
    create: {
      id: "zone_uae_default",
      code: "UAE",
      nameEn: "United Arab Emirates",
      nameAr: "الإمارات العربية المتحدة",
      nameRu: "ОАЭ",
      isActive: true,
      displayOrder: 0,
      freeShippingEnabled: true,
      freeShippingThreshold: 500,
    },
  });

  await db.shippingZoneCountry.upsert({
    where: { country: "AE" },
    update: { shippingZoneId: uaeZone.id },
    create: { country: "AE", shippingZoneId: uaeZone.id },
  });

  const standard = await db.shippingMethod.upsert({
    where: { code: "STANDARD_UAE" },
    update: { freeShippingEligible: true },
    create: {
      code: "STANDARD_UAE",
      nameEn: "Standard UAE Delivery",
      nameAr: "توصيل قياسي داخل الإمارات",
      nameRu: "Стандартная доставка по ОАЭ",
      isActive: true,
      displayOrder: 0,
      freeShippingEligible: true,
    },
  });

  const existingStandardRate = await db.shippingRate.findFirst({
    where: { shippingMethodId: standard.id, shippingZoneId: uaeZone.id },
  });
  if (!existingStandardRate) {
    await db.shippingRate.create({
      data: {
        shippingMethodId: standard.id,
        basePrice: 50,
        estimatedDaysMin: 3,
        estimatedDaysMax: 5,
        isActive: true,
        shippingZoneId: uaeZone.id,
      },
    });
  }

  const express = await db.shippingMethod.upsert({
    where: { code: "EXPRESS_UAE" },
    update: {},
    create: {
      code: "EXPRESS_UAE",
      nameEn: "Express UAE Delivery",
      nameAr: "توصيل سريع داخل الإمارات",
      nameRu: "Экспресс-доставка по ОАЭ",
      isActive: true,
      displayOrder: 1,
    },
  });

  const existingExpressRate = await db.shippingRate.findFirst({
    where: { shippingMethodId: express.id, shippingZoneId: uaeZone.id },
  });
  if (!existingExpressRate) {
    await db.shippingRate.create({
      data: {
        shippingMethodId: express.id,
        basePrice: 100,
        estimatedDaysMin: 1,
        estimatedDaysMax: 2,
        isActive: true,
        shippingZoneId: uaeZone.id,
      },
    });
  }

  logDone("shipping methods", 2);
}

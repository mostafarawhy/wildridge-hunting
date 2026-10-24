import "server-only";
import { cache } from "react";
import { db } from "@/lib/db/client";

export const getFreeShippingOffer = cache(
  async (): Promise<{ thresholdAed: number } | null> => {
    const membership = await db.shippingZoneCountry.findUnique({
      where: { country: "AE" },
      include: { shippingZone: true },
    });
    const zone = membership?.shippingZone;

    if (
      !zone ||
      !zone.isActive ||
      zone.quoteRequired ||
      !zone.freeShippingEnabled ||
      zone.freeShippingThreshold == null
    ) {
      return null;
    }

    const eligibleRates = await db.shippingRate.count({
      where: {
        shippingZoneId: zone.id,
        isActive: true,
        shippingMethod: { isActive: true, freeShippingEligible: true },
      },
    });

    return eligibleRates > 0
      ? { thresholdAed: Number(zone.freeShippingThreshold) }
      : null;
  },
);

export interface AdminShippingZoneListItem {
  id: string;
  code: string;
  nameEn: string;
  nameAr: string;
  nameRu: string | null;
  isActive: boolean;
  displayOrder: number;
  freeShippingEnabled: boolean;
  freeShippingThreshold: number | null;
  countryCount: number;
  rateCount: number;
}

export async function getAdminShippingZoneList(): Promise<
  AdminShippingZoneListItem[]
> {
  const rows = await db.shippingZone.findMany({
    orderBy: [{ displayOrder: "asc" }, { code: "asc" }],
    select: {
      id: true,
      code: true,
      nameEn: true,
      nameAr: true,
      nameRu: true,
      isActive: true,
      displayOrder: true,
      freeShippingEnabled: true,
      freeShippingThreshold: true,
      _count: {
        select: {
          countries: true,
          rates: true,
        },
      },
    },
  });

  return rows.map((r) => ({
    id: r.id,
    code: r.code,
    nameEn: r.nameEn,
    nameAr: r.nameAr,
    nameRu: r.nameRu,
    isActive: r.isActive,
    displayOrder: r.displayOrder,
    freeShippingEnabled: r.freeShippingEnabled,
    freeShippingThreshold:
      r.freeShippingThreshold != null ? Number(r.freeShippingThreshold) : null,
    countryCount: r._count.countries,
    rateCount: r._count.rates,
  }));
}

export interface AdminShippingZoneDetail {
  id: string;
  code: string;
  nameEn: string;
  nameAr: string;
  nameRu: string | null;
  isActive: boolean;
  displayOrder: number;
  freeShippingEnabled: boolean;
  freeShippingThreshold: number | null;
  quoteRequired: boolean;
  countryCodes: string[];
}

export async function getAdminShippingZoneForEdit(
  id: string,
): Promise<AdminShippingZoneDetail | null> {
  const zone = await db.shippingZone.findUnique({
    where: { id },
    select: {
      id: true,
      code: true,
      nameEn: true,
      nameAr: true,
      nameRu: true,
      isActive: true,
      displayOrder: true,
      freeShippingEnabled: true,
      freeShippingThreshold: true,
      quoteRequired: true,
      countries: {
        select: { country: true },
      },
    },
  });

  if (!zone) return null;

  return {
    id: zone.id,
    code: zone.code,
    nameEn: zone.nameEn,
    nameAr: zone.nameAr,
    nameRu: zone.nameRu,
    isActive: zone.isActive,
    displayOrder: zone.displayOrder,
    freeShippingEnabled: zone.freeShippingEnabled,
    freeShippingThreshold:
      zone.freeShippingThreshold != null
        ? Number(zone.freeShippingThreshold)
        : null,
    quoteRequired: zone.quoteRequired,
    countryCodes: zone.countries.map((c) => c.country),
  };
}

export async function getAssignedCountryCodes(): Promise<string[]> {
  const rows = await db.shippingZoneCountry.findMany({
    select: { country: true },
  });
  return rows.map((r) => r.country);
}

export interface AdminShippingRateItem {
  id: string;
  shippingMethodId: string;
  methodCode: string;
  methodNameEn: string;
  methodIsActive: boolean;
  basePrice: number;
  estimatedDaysMin: number | null;
  estimatedDaysMax: number | null;
  isActive: boolean;
}

export async function getZoneRates(
  zoneId: string,
): Promise<AdminShippingRateItem[]> {
  const rows = await db.shippingRate.findMany({
    where: { shippingZoneId: zoneId },
    orderBy: { shippingMethod: { displayOrder: "asc" } },
    select: {
      id: true,
      shippingMethodId: true,
      basePrice: true,
      estimatedDaysMin: true,
      estimatedDaysMax: true,
      isActive: true,
      shippingMethod: {
        select: { code: true, nameEn: true, isActive: true },
      },
    },
  });

  return rows.map((r) => ({
    id: r.id,
    shippingMethodId: r.shippingMethodId,
    methodCode: r.shippingMethod.code,
    methodNameEn: r.shippingMethod.nameEn,
    methodIsActive: r.shippingMethod.isActive,
    basePrice: Number(r.basePrice),
    estimatedDaysMin: r.estimatedDaysMin,
    estimatedDaysMax: r.estimatedDaysMax,
    isActive: r.isActive,
  }));
}

export interface AssignableMethod {
  id: string;
  code: string;
  nameEn: string;
}

export async function getAssignableMethodsForZone(
  zoneId: string,
): Promise<AssignableMethod[]> {
  const existingRates = await db.shippingRate.findMany({
    where: { shippingZoneId: zoneId },
    select: { shippingMethodId: true },
  });
  const ratedIds = existingRates.map((r) => r.shippingMethodId);

  return db.shippingMethod.findMany({
    where: { isActive: true, id: { notIn: ratedIds } },
    orderBy: { displayOrder: "asc" },
    select: { id: true, code: true, nameEn: true },
  });
}

export interface AdminShippingMethodListItem {
  id: string;
  code: string;
  nameEn: string;
  nameAr: string;
  nameRu: string | null;
  isActive: boolean;
  freeShippingEligible: boolean;
  displayOrder: number;
  rateCount: number;
}

export async function getAdminShippingMethodList(): Promise<
  AdminShippingMethodListItem[]
> {
  const rows = await db.shippingMethod.findMany({
    orderBy: [{ displayOrder: "asc" }, { code: "asc" }],
    select: {
      id: true,
      code: true,
      nameEn: true,
      nameAr: true,
      nameRu: true,
      isActive: true,
      freeShippingEligible: true,
      displayOrder: true,
      _count: { select: { rates: true } },
    },
  });

  return rows.map((r) => ({
    id: r.id,
    code: r.code,
    nameEn: r.nameEn,
    nameAr: r.nameAr,
    nameRu: r.nameRu,
    isActive: r.isActive,
    freeShippingEligible: r.freeShippingEligible,
    displayOrder: r.displayOrder,
    rateCount: r._count.rates,
  }));
}

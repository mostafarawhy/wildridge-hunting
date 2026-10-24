import "server-only";

import { db } from "@/lib/db/client";
import { toISOString } from "@/lib/utils/date";
import { getCountryName } from "@/lib/data/countries";
import {
  getCartProjection,
  findCustomerCartId,
  type CartProjection,
} from "./cart";
import { getSetting } from "@/lib/db/queries/settings";
import { deriveVerificationStatus } from "./verification";
import { redeemRuleOf, type RedeemRule } from "@/lib/utils/loyalty-points";

export interface CheckoutAddressProjection {
  id: string;
  label: string | null;
  fullName: string;
  phone: string;
  addressLine1: string;
  addressLine2: string | null;
  city: string;
  emirate: string;
  postalCode: string | null;
  country: string;
  isDefault: boolean;
}

export interface VerificationEventSummary {
  id: string;
  status: "NOT_REQUIRED" | "PENDING" | "APPROVED" | "REJECTED" | "EXPIRED";
  rejectionReason: string | null;
  createdAt: string;
}

export interface VerificationProjection {
  required: boolean;
  status: "NOT_REQUIRED" | "PENDING" | "APPROVED" | "REJECTED" | "EXPIRED";
  canCheckout: boolean;
  verifiedAt: string | null;
  expiresAt: string | null;
  nearExpiry: boolean;
  holderName: string | null;
  credential: {
    eventId: string;
    provider: "SUMSUB" | "UAE_PASS" | "MANUAL_REVIEW";
  } | null;
  latestEvent: VerificationEventSummary | null;
}

export interface ResolvedShippingMethod {
  id: string;
  code: string;
  nameEn: string;
  nameAr: string;
  nameRu: string;
  priceAed: number;
  estimatedDaysMin: number;
  estimatedDaysMax: number;
  isFree: boolean;
  freeShippingEligible: boolean;
}

export interface CheckoutCustomerProjection {
  id: string;
  email: string;
  name: string;
  phone: string | null;
  loyaltyPoints: number;
}

export interface CheckoutProjection {
  cart: CartProjection;
  addresses: CheckoutAddressProjection[];
  defaultAddressId: string | null;
  verification: VerificationProjection;
  methods: ResolvedShippingMethod[];
  selectedMethodId: string | null;
  quoteRequired: boolean;
  freeShippingThresholdAed: number | null;
  customer: CheckoutCustomerProjection;
  vatRate: number;
  redeemRule: RedeemRule;
  serviceableCountries: { code: string; name: string }[];
}

export type CheckoutProjectionResult =
  | { ok: true; data: CheckoutProjection }
  | { ok: false; reason: "NO_CUSTOMER" | "EMPTY_CART" };

const RENEW_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;

export type ShippingResolution =
  | {
      serviceable: true;
      quoteRequired: false;
      methods: ResolvedShippingMethod[];
      freeShippingThresholdAed: number | null;
    }
  | {
      serviceable: true;
      quoteRequired: true;
      methods: [];
      freeShippingThresholdAed: number | null;
    }
  | {
      serviceable: false;
      quoteRequired: false;
      methods: [];
      freeShippingThresholdAed: number | null;
    };

export async function resolveShipping(
  destination: { country: string; emirate: string | null; subtotal: number },
): Promise<ShippingResolution> {
  const membership = await db.shippingZoneCountry.findUnique({
    where: { country: destination.country },
    include: { shippingZone: true },
  });
  const zone = membership?.shippingZone;

  if (!zone || !zone.isActive) {
    return {
      serviceable: false,
      quoteRequired: false,
      methods: [],
      freeShippingThresholdAed: null,
    };
  }

  if (zone.quoteRequired) {
    return {
      serviceable: true,
      quoteRequired: true,
      methods: [],
      freeShippingThresholdAed: null,
    };
  }

  const methods = await db.shippingMethod.findMany({
    where: { isActive: true },
    orderBy: { displayOrder: "asc" },
    include: { rates: { where: { isActive: true, shippingZoneId: zone.id } } },
  });

  const result: ResolvedShippingMethod[] = [];

  for (const method of methods) {
    const rate = method.rates[0];
    if (!rate) continue;

    let priceAed = Number(rate.basePrice);
    let isFree = false;

    if (
      method.freeShippingEligible &&
      zone.freeShippingEnabled &&
      zone.freeShippingThreshold != null &&
      destination.subtotal >= Number(zone.freeShippingThreshold)
    ) {
      priceAed = 0;
      isFree = true;
    }

    result.push({
      id: method.id,
      code: method.code,
      nameEn: method.nameEn,
      nameAr: method.nameAr,
      nameRu: method.nameRu ?? "",
      priceAed,
      estimatedDaysMin: rate.estimatedDaysMin ?? 0,
      estimatedDaysMax: rate.estimatedDaysMax ?? 0,
      isFree,
      freeShippingEligible: method.freeShippingEligible,
    });
  }

  if (result.length === 0) {
    return {
      serviceable: false,
      quoteRequired: false,
      methods: [],
      freeShippingThresholdAed: null,
    };
  }

  return {
    serviceable: true,
    quoteRequired: false,
    methods: result,
    freeShippingThresholdAed:
      zone.freeShippingEnabled &&
      zone.freeShippingThreshold != null &&
      result.some((m) => m.freeShippingEligible)
        ? Number(zone.freeShippingThreshold)
        : null,
  };
}

export async function getCheckoutProjection(
  customerId: string,
  locale: "en" | "ar" | "ru",
): Promise<CheckoutProjectionResult> {
  const [
    customer,
    rawAddresses,
    cartId,
    latestEvent,
    { vatRate },
    loyaltyProgram,
    serviceableCountries,
  ] = await Promise.all([
    db.customer.findUnique({
      where: { id: customerId },
      select: {
        id: true,
        email: true,
        name: true,
        phone: true,
        loyaltyPoints: true,
        verificationStatus: true,
        verifiedAt: true,
        verificationExpiresAt: true,
      },
    }),
    db.customerAddress.findMany({
      where: { customerId },
      orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }],
      select: {
        id: true,
        label: true,
        fullName: true,
        phone: true,
        addressLine1: true,
        addressLine2: true,
        city: true,
        emirate: true,
        postalCode: true,
        country: true,
        isDefault: true,
      },
    }),
    findCustomerCartId(customerId),
    db.verificationEvent.findFirst({
      where: { customerId },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        provider: true,
        status: true,
        rejectionReason: true,
        createdAt: true,
      },
    }),
    getSetting("tax_config"),
    getSetting("loyalty_program"),
    getServiceableCountries(),
  ]);

  if (!customer) {
    return { ok: false, reason: "NO_CUSTOMER" };
  }

  const cart = cartId ? await getCartProjection(cartId, locale) : null;

  if (!cart || cart.items.length === 0) {
    return { ok: false, reason: "EMPTY_CART" };
  }

  const addresses: CheckoutAddressProjection[] = rawAddresses.map((a) => ({
    id: a.id,
    label: a.label,
    fullName: a.fullName,
    phone: a.phone,
    addressLine1: a.addressLine1,
    addressLine2: a.addressLine2,
    city: a.city,
    emirate: a.emirate,
    postalCode: a.postalCode,
    country: a.country,
    isDefault: a.isDefault,
  }));

  const defaultAddressId = rawAddresses.find((a) => a.isDefault)?.id ?? null;

  const required = cart.hasRestrictedItems;
  const status = deriveVerificationStatus(
    customer.verificationStatus as VerificationProjection["status"],
    customer.verificationExpiresAt,
  );
  const canCheckout = !required || status === "APPROVED";

  const verification: VerificationProjection = {
    required,
    status,
    canCheckout,
    verifiedAt: customer.verifiedAt ? toISOString(customer.verifiedAt) : null,
    expiresAt: customer.verificationExpiresAt
      ? toISOString(customer.verificationExpiresAt)
      : null,
    nearExpiry: customer.verificationExpiresAt
      ? customer.verificationExpiresAt.getTime() - Date.now() < RENEW_WINDOW_MS
      : false,
    holderName: customer.name ?? customer.email ?? null,
    credential:
      latestEvent && status === "APPROVED"
        ? {
            eventId: latestEvent.id,
            provider: latestEvent.provider as NonNullable<
              VerificationProjection["credential"]
            >["provider"],
          }
        : null,
    latestEvent:
      latestEvent && status === "REJECTED"
        ? {
            id: latestEvent.id,
            status: latestEvent.status as VerificationEventSummary["status"],
            rejectionReason: latestEvent.rejectionReason,
            createdAt: toISOString(latestEvent.createdAt),
          }
        : null,
  };

  const destinationAddress =
    rawAddresses.find((a) => a.isDefault) ?? rawAddresses[0] ?? null;

  let methods: ResolvedShippingMethod[] = [];
  let selectedMethodId: string | null = null;
  let quoteRequired = false;
  let freeShippingThresholdAed: number | null = null;

  if (destinationAddress) {
    const cartSubtotal = cart.totals.subtotalAed;
    const resolution = await resolveShipping({
      country: destinationAddress.country,
      emirate: destinationAddress.emirate,
      subtotal: cartSubtotal,
    });
    methods = resolution.methods;
    quoteRequired = resolution.quoteRequired;
    freeShippingThresholdAed = resolution.freeShippingThresholdAed;
    selectedMethodId = resolution.quoteRequired ? null : (methods[0]?.id ?? null);
  }

  return {
    ok: true,
    data: {
      cart,
      addresses,
      defaultAddressId,
      verification,
      methods,
      selectedMethodId,
      quoteRequired,
      freeShippingThresholdAed,
      customer: {
        id: customer.id,
        email: customer.email,
        name: customer.name,
        phone: customer.phone,
        loyaltyPoints: customer.loyaltyPoints,
      },
      vatRate,
      redeemRule: redeemRuleOf(loyaltyProgram),
      serviceableCountries,
    },
  };
}

export async function getServiceableCountries(): Promise<
  { code: string; name: string }[]
> {
  const zones = await db.shippingZone.findMany({
    where: {
      isActive: true,
      OR: [
        { quoteRequired: true },
        {
          rates: {
            some: {
              isActive: true,
              shippingMethod: { isActive: true },
            },
          },
        },
      ],
    },
    select: {
      countries: {
        select: { country: true },
      },
    },
  });

  const seen = new Set<string>();
  const result: { code: string; name: string }[] = [];

  for (const zone of zones) {
    for (const { country } of zone.countries) {
      if (!seen.has(country)) {
        seen.add(country);
        result.push({ code: country, name: getCountryName(country) });
      }
    }
  }

  return result.sort((a, b) => a.name.localeCompare(b.name));
}

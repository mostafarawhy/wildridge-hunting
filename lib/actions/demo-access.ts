"use server";

import bcrypt from "bcryptjs";
import { randomBytes } from "node:crypto";
import { headers } from "next/headers";
import { db } from "@/lib/db/client";
import { signIn } from "@/lib/auth";
import { BRAND } from "@/lib/config/brand";
import { DEMO_PLACEHOLDER_DOCUMENT, isDemoMode } from "@/lib/config/demo";
import { mergeGuestCartAction } from "@/lib/actions/cart";

export type DemoAccessKind = "customer" | "business";

export type DemoAccessResult =
  | { success: true }
  | {
      success: false;
      error: string;
      errorCode: "UNAVAILABLE" | "RATE_LIMITED" | "INTERNAL_ERROR";
    };

const HOUR_MS = 60 * 60 * 1000;
const PER_IP_LIMIT = 10;
const GLOBAL_LIMIT = 150;
const TWO_YEARS_MS = 2 * 365 * 24 * 60 * 60 * 1000;
const ONE_YEAR_MS = 365 * 24 * 60 * 60 * 1000;

const globalForDemo = globalThis as unknown as {
  demoAccessHits: Map<string, number[]> | undefined;
};
const hits = (globalForDemo.demoAccessHits ??= new Map<string, number[]>());

function takeIpSlot(ip: string): boolean {
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < HOUR_MS);
  if (recent.length >= PER_IP_LIMIT) {
    hits.set(ip, recent);
    return false;
  }
  recent.push(now);
  hits.set(ip, recent);
  return true;
}

async function clientIp(): Promise<string> {
  const h = await headers();
  return (
    h.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    h.get("x-real-ip") ||
    "unknown"
  );
}

export async function createDemoAccountAction(
  kind: DemoAccessKind,
  locale: "en" | "ar" | "ru" = "en",
): Promise<DemoAccessResult> {
  if (!isDemoMode()) {
    return { success: false, error: "Demo access is not available.", errorCode: "UNAVAILABLE" };
  }

  try {
    if (!takeIpSlot(await clientIp())) {
      return { success: false, error: "Too many demo accounts. Try again later.", errorCode: "RATE_LIMITED" };
    }

    const recentDemoAccounts = await db.customer.count({
      where: {
        email: { startsWith: "demo-" },
        createdAt: { gt: new Date(Date.now() - HOUR_MS) },
      },
    });
    if (recentDemoAccounts >= GLOBAL_LIMIT) {
      return { success: false, error: "Too many demo accounts. Try again later.", errorCode: "RATE_LIMITED" };
    }

    const suffix = randomBytes(5).toString("hex");
    const email = `demo-${suffix}@${BRAND.emailDomain}`;
    const password = `${randomBytes(18).toString("base64url")}a1`;
    const passwordHash = await bcrypt.hash(password, 10);
    const now = new Date();
    const business = kind === "business";

    await db.$transaction(async (tx) => {
      const customer = await tx.customer.create({
        data: {
          email,
          name: business ? "Demo Business Customer" : "Demo Customer",
          phone: "+971500000000",
          passwordHash,
          role: business ? "B2B" : "B2C",
          locale,
          isActive: true,
          emailVerifiedAt: now,
          verificationStatus: "APPROVED",
          verifiedAt: now,
          verificationExpiresAt: new Date(now.getTime() + TWO_YEARS_MS),
        },
        select: { id: true },
      });

      await tx.customerAddress.create({
        data: {
          customerId: customer.id,
          label: "Home",
          fullName: business ? "Demo Business Customer" : "Demo Customer",
          phone: "+971500000000",
          addressLine1: "Villa 1, Sample Street 1",
          city: "Dubai",
          emirate: "Dubai",
          country: "AE",
          isDefault: true,
        },
      });

      const event = await tx.verificationEvent.create({
        data: {
          customerId: customer.id,
          provider: "MANUAL_REVIEW",
          status: "APPROVED",
          reviewResult: "Approved automatically for a demo account.",
          reviewedAt: now,
        },
        select: { id: true },
      });

      await tx.auditLog.create({
        data: {
          actorType: "SYSTEM",
          action: "verification.approve",
          entityType: "VerificationEvent",
          entityId: event.id,
          before: { status: "PENDING" },
          after: { status: "APPROVED", source: "demo_access" },
          metadata: { customerId: customer.id },
        },
      });

      if (business) {
        const account = await tx.b2BAccount.create({
          data: {
            customerId: customer.id,
            companyNameEn: `Demo Outfitters ${suffix.slice(0, 4).toUpperCase()} LLC`,
            companyNameAr: "شركة ديمو للمستلزمات ذ.م.م",
            contactName: "Demo Business Customer",
            contactPhone: "+971500000000",
            tradeLicenseNo: `DEMO-LICENCE-${suffix.toUpperCase()}`,
            vatNumber: "100000000000003",
            status: "APPROVED",
            reviewedAt: now,
            verifiedAt: now,
            expiresAt: new Date(now.getTime() + ONE_YEAR_MS),
            creditLimitAed: 50000,
          },
          select: { id: true },
        });
        await tx.b2BDocument.create({
          data: {
            b2bAccountId: account.id,
            type: "TRADE_LICENSE",
            filename: DEMO_PLACEHOLDER_DOCUMENT.filename,
            storageKey: DEMO_PLACEHOLDER_DOCUMENT.key,
            mimeType: DEMO_PLACEHOLDER_DOCUMENT.mimeType,
          },
        });
      }
    });

    await signIn("credentials", { email, password, redirect: false });

    const created = await db.customer.findUnique({
      where: { email },
      select: { id: true },
    });
    if (created) {
      const merged = await mergeGuestCartAction(created.id);
      if (!merged.success) {
        console.error("[createDemoAccountAction] cart merge failed:", merged.error);
      }
    }

    return { success: true };
  } catch (err) {
    console.error("[createDemoAccountAction]", err);
    return { success: false, error: "Something went wrong. Please try again.", errorCode: "INTERNAL_ERROR" };
  }
}

import "server-only";

import { db } from "@/lib/db/client";
import { emailDate } from "@/lib/email/order-email";
import { adminUrl, accountUrl } from "@/lib/email/links";
import {
  CUSTOMER_B2B_NOTE,
  STAFF_SALES_NOTE,
  type EmailChromeBadge,
  type EmailChromeOptions,
  type EmailInfoRow,
} from "@/lib/email/chrome";
import type {
  DocumentRequestScope,
  DocumentType,
} from "@/app/generated/prisma/client";

export interface B2BEmailData {
  id: string;
  company: string;
  tradeLicense: string;
  reason: string | null;
  expiresAtLabel: string | null;
  customerName: string;
  customerEmail: string;
  request: {
    scope: DocumentRequestScope;
    types: DocumentType[];
    message: string;
    requestedDate: string;
  } | null;
  adminUrl: string;
  accountUrl: string;
  accountRenewUrl: string;
  accountDetailsUrl: string;
  accountDocumentsUrl: string;
}

export async function loadB2BEmailData(
  accountId: string,
  requestId?: string,
): Promise<B2BEmailData | null> {
  try {
    const account = await db.b2BAccount.findUnique({
      where: { id: accountId },
      select: {
        id: true,
        companyNameEn: true,
        tradeLicenseNo: true,
        status: true,
        expiresAt: true,
        rejectionReason: true,
        customer: { select: { name: true, email: true } },
      },
    });

    if (!account) return null;

    let request: B2BEmailData["request"] = null;
    if (requestId) {
      const doc = await db.documentRequest.findUnique({
        where: { id: requestId },
        select: { scope: true, types: true, message: true, createdAt: true },
      });
      if (doc) {
        request = {
          scope: doc.scope,
          types: doc.types,
          message: doc.message,
          requestedDate: emailDate(doc.createdAt),
        };
      }
    }

    return {
      id: account.id,
      company: account.companyNameEn,
      tradeLicense: account.tradeLicenseNo,
      reason: account.rejectionReason,
      expiresAtLabel: account.expiresAt ? emailDate(account.expiresAt) : null,
      customerName: account.customer.name.trim(),
      customerEmail: account.customer.email,
      request,
      adminUrl: adminUrl(`/b2b/${account.id}`),
      accountUrl: accountUrl("/b2b"),
      accountRenewUrl: accountUrl("/b2b/renew"),
      accountDetailsUrl: accountUrl("/b2b/details"),
      accountDocumentsUrl: accountUrl("/b2b/documents"),
    };
  } catch (err) {
    console.error("[loadB2BEmailData]", accountId, err);
    return null;
  }
}

export function customerB2BChrome(
  data: B2BEmailData,
  opts: {
    badge: EmailChromeBadge;
    infoRows: EmailInfoRow[];
    ctaUrl: string;
    excerpt?: { label: string; text: string };
  },
): EmailChromeOptions {
  return {
    recipientName: data.customerName || undefined,
    badges: [opts.badge],
    infoRows: opts.infoRows,
    ctaUrl: opts.ctaUrl || undefined,
    messageExcerpt: opts.excerpt,
    showSupport: true,
    transparencyNote: CUSTOMER_B2B_NOTE,
  };
}

export function staffB2BChrome(
  data: B2BEmailData,
  opts: {
    badge: EmailChromeBadge;
    infoRows: EmailInfoRow[];
    transparencyNote?: string;
  },
): EmailChromeOptions {
  return {
    badges: [opts.badge],
    infoRows: opts.infoRows,
    ctaUrl: data.adminUrl || undefined,
    transparencyNote: opts.transparencyNote ?? STAFF_SALES_NOTE,
  };
}

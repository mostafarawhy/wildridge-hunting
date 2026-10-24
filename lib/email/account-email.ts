import "server-only";

import { db } from "@/lib/db/client";
import { adminUrl, accountUrl, localeUrl } from "@/lib/email/links";
import { emailDate } from "@/lib/email/order-email";
import {
  type EmailChromeBadge,
  type EmailChromeOptions,
  type EmailInfoRow,
} from "@/lib/email/chrome";
import type { VerificationStatus } from "@/app/generated/prisma/enums";
import { logAndSendEmail } from "@/lib/services/resend";
import { mintEmailVerificationToken } from "@/lib/services/identity/email-verification-token";

export interface CustomerEmailData {
  id: string;
  customerName: string;
  customerEmail: string;
  accountUrl: string;
  adminUrl: string;
  verificationStatus: VerificationStatus;
  verifiedAt: string | null;
  verificationExpiresAt: string | null;
}

export async function loadCustomerEmailData(
  customerId: string,
): Promise<CustomerEmailData | null> {
  try {
    const customer = await db.customer.findUnique({
      where: { id: customerId },
      select: {
        id: true,
        name: true,
        email: true,
        verificationStatus: true,
        verifiedAt: true,
        verificationExpiresAt: true,
      },
    });

    if (!customer) return null;

    return {
      id: customer.id,
      customerName: customer.name.trim(),
      customerEmail: customer.email,
      accountUrl: accountUrl(""),
      adminUrl: adminUrl(`/customers/${customer.id}`),
      verificationStatus: customer.verificationStatus,
      verifiedAt: customer.verifiedAt ? emailDate(customer.verifiedAt) : null,
      verificationExpiresAt: customer.verificationExpiresAt
        ? emailDate(customer.verificationExpiresAt)
        : null,
    };
  } catch (err) {
    console.error("[loadCustomerEmailData]", customerId, err);
    return null;
  }
}

export function customerAccountChrome(
  data: CustomerEmailData,
  opts: {
    badge: EmailChromeBadge;
    infoRows: EmailInfoRow[];
    ctaUrl?: string;
    excerpt?: { label: string; text: string };
  },
): EmailChromeOptions {
  return {
    recipientName: data.customerName || undefined,
    badges: [opts.badge],
    infoRows: opts.infoRows,
    ctaUrl: opts.ctaUrl || data.accountUrl || undefined,
    messageExcerpt: opts.excerpt,
    showSupport: true,
  };
}

export async function sendEmailVerificationRequest(customer: {
  id: string;
  email: string;
  name: string;
  locale: string;
}): Promise<void> {
  const token = await mintEmailVerificationToken(customer.id);
  const verifyUrl = localeUrl(
    customer.locale,
    `/auth/verify-email?token=${token}`,
  );

  await logAndSendEmail({
    templateKey: "email_verification_requested",
    toEmail: customer.email,
    locale: customer.locale,
    chromeOptions: () => ({
      ctaUrl: verifyUrl,
      ...(customer.name.trim() ? { recipientName: customer.name } : {}),
    }),
  });
}

import { BRAND } from "@/lib/config/brand";
export type EmailTemplateCategory =
  | "Tickets"
  | "B2B"
  | "Quotes"
  | "Orders"
  | "Verification"
  | "Account";

export const CATEGORY_ORDER: EmailTemplateCategory[] = [
  "Tickets",
  "B2B",
  "Quotes",
  "Orders",
  "Verification",
  "Account",
];

export interface EmailDefault {
  subject: string;
  body: string;
  label: string;
  category: EmailTemplateCategory;
  audience: "customer" | "staff";
  ctaLabel?: string | null;
}

export const EMAIL_DEFAULTS: Record<string, EmailDefault> = {
  "ticket.created": {
    subject: "New ticket {ticketNumber}: {subject}",
    body: "<p>A new support ticket needs attention. The details are below.</p>",
    label: "Ticket Created",
    category: "Tickets",
    audience: "staff",
    ctaLabel: "View ticket",
  },
  "ticket.status_changed": {
    subject: "Ticket {ticketNumber} is now {toStatus}",
    body: "<p>The status of this ticket has changed.</p>",
    label: "Ticket Status Changed",
    category: "Tickets",
    audience: "staff",
    ctaLabel: "View ticket",
  },
  "ticket.assigned": {
    subject: "Ticket {ticketNumber} assigned to you",
    body: "<p>{assignedByName} assigned this ticket to you.</p>",
    label: "Ticket Assigned",
    category: "Tickets",
    audience: "staff",
    ctaLabel: "View ticket",
  },
  "ticket.comment": {
    subject: "New comment on ticket {ticketNumber}",
    body: "<p>A new comment was added to this ticket.</p>",
    label: "Ticket Comment Added",
    category: "Tickets",
    audience: "staff",
    ctaLabel: "View ticket",
  },
  "ticket.created_customer": {
    subject: "We received your message ({ticketNumber})",
    body: "<p>Thanks for reaching out. Our support team has received your message and will reply by email.</p><p>Replies arrive by email at the address on file. Ticket {ticketNumber} is the reference for this conversation.</p>",
    label: "Ticket Created (Customer)",
    category: "Tickets",
    audience: "customer",
    ctaLabel: null,
  },
  "b2b_registration_received_customer": {
    subject: "We received your business application: {companyNameEn}",
    body: "<p>We've received your business account application. Our team is reviewing it and will follow up soon.</p>",
    label: "B2B Application Received (Customer)",
    category: "B2B",
    audience: "customer",
    ctaLabel: "View business account",
  },
  "b2b_registration_received": {
    subject: "New business application: {companyNameEn}",
    body: "<p>A new business account application is waiting for review.</p>",
    label: "B2B Application Received",
    category: "B2B",
    audience: "staff",
    ctaLabel: "Review application",
  },
  "b2b_renewal_received_customer": {
    subject: "We received your renewal request: {companyNameEn}",
    body: "<p>We've received your business account renewal request. Our team is reviewing it and will follow up soon.</p>",
    label: "B2B Renewal Received (Customer)",
    category: "B2B",
    audience: "customer",
    ctaLabel: "View business account",
  },
  "b2b_renewal_received": {
    subject: "Renewal requested: {companyNameEn}",
    body: "<p>A business customer has asked to renew their account.</p>",
    label: "B2B Renewal Requested",
    category: "B2B",
    audience: "staff",
    ctaLabel: "Review renewal",
  },
  "b2b_approved": {
    subject: "Your business account is approved",
    body: "<p>Good news: your business account has been approved. You can now request quotes from our business catalogue.</p>",
    label: "B2B Application Approved",
    category: "B2B",
    audience: "customer",
    ctaLabel: "View business account",
  },
  "b2b_rejected": {
    subject: "An update on your business application",
    body: "<p>Thank you for applying. We weren't able to approve your business account at this time.</p><p>If you have questions, contact our team.</p>",
    label: "B2B Application Rejected",
    category: "B2B",
    audience: "customer",
    ctaLabel: "View business account",
  },
  "b2b_suspended": {
    subject: "Your business account has been suspended",
    body: "<p>Your business account has been suspended. Contact our team if you'd like to discuss it.</p>",
    label: "B2B Account Suspended",
    category: "B2B",
    audience: "customer",
    ctaLabel: "View business account",
  },
  "b2b_expired": {
    subject: "Your business account has expired",
    body: "<p>Your business account has reached its expiry date. You can request a renewal from your account.</p>",
    label: "B2B Account Expired",
    category: "B2B",
    audience: "customer",
    ctaLabel: "Renew account",
  },
  "b2b_details_requested": {
    subject: "Please update your business details",
    body: "<p>We need a few updates to your business details before we can continue.</p>",
    label: "B2B Details Requested",
    category: "B2B",
    audience: "customer",
    ctaLabel: "Update details",
  },
  "b2b_documents_requested": {
    subject: "We need a document from you",
    body: "<p>We need an additional document for your business account.</p>",
    label: "B2B Document Requested",
    category: "B2B",
    audience: "customer",
    ctaLabel: "Upload documents",
  },
  "b2b_request_cancelled": {
    subject: "We no longer need that from you",
    body: "<p>Our team has withdrawn the request we sent about your business account, so there's nothing you need to do for it.</p><p>We'll email you if we need anything else.</p>",
    label: "B2B Request Withdrawn",
    category: "B2B",
    audience: "customer",
    ctaLabel: "View business account",
  },
  "b2b_documents_provided": {
    subject: "Requested documents received: {company}",
    body: "<p>A business customer has uploaded the documents we requested.</p>",
    label: "B2B Documents Provided",
    category: "B2B",
    audience: "staff",
    ctaLabel: "Review documents",
  },
  "b2b_details_updated": {
    subject: "Business details updated: {company}",
    body: "<p>A business customer has updated the details we requested.</p>",
    label: "B2B Details Updated",
    category: "B2B",
    audience: "staff",
    ctaLabel: "Review details",
  },
  "b2b_quote_requested": {
    subject: "New quote request {quoteNumber}: {companyNameEn}",
    body: "<p>A business customer has requested a quote.</p>",
    label: "B2B Quote Requested",
    category: "B2B",
    audience: "staff",
    ctaLabel: "Open in admin",
  },
  "quote_requested_customer": {
    subject: "We've received your quote request {quoteNumber}",
    body: "<p>We've received your quote request {quoteNumber}. Our team will price it and follow up shortly.</p><p>Pricing is confirmed by email — nothing is committed until you approve it.</p>",
    label: "Quote Requested (Customer)",
    category: "Quotes",
    audience: "customer",
    ctaLabel: "View quote",
  },
  "quote_quoted": {
    subject: "Your quote {quoteNumber} is ready",
    body: "<p>Your quote is ready. Review the prices below and confirm when you're ready to proceed.</p>",
    label: "Quote Ready",
    category: "Quotes",
    audience: "customer",
    ctaLabel: "Review quote",
  },
  "quote_status_changed": {
    subject: "Your quote {quoteNumber} has been updated",
    body: "<p>There's an update on your quote.</p>",
    label: "Quote Status Changed",
    category: "Quotes",
    audience: "customer",
    ctaLabel: "View quote",
  },
  "quote_accepted": {
    subject: "Quote {quoteNumber} accepted",
    body: "<p>The customer has accepted this quote.</p>",
    label: "Quote Accepted",
    category: "Quotes",
    audience: "staff",
    ctaLabel: "Open in admin",
  },
  "quote_cancelled_staff": {
    subject: "Quote {quoteNumber} cancelled by the customer",
    body: "<p>The customer cancelled quote {quoteNumber}. No action is needed unless you want to follow up.</p>",
    label: "Quote Cancelled by Customer",
    category: "Quotes",
    audience: "staff",
    ctaLabel: "Open quote",
  },
  "payment_failed": {
    subject: "We couldn't process your payment for {orderNumber}",
    body: "<p>We couldn't process your payment for order {orderNumber}. Your order is on hold — no items have been charged.</p><p>You can retry payment from your account.</p>",
    label: "Payment Failed",
    category: "Orders",
    audience: "customer",
    ctaLabel: "Retry payment",
  },
  "order_shipped": {
    subject: "Your order {orderNumber} is on its way",
    body: "<p>Good news: your order has shipped.</p><p>You can follow your delivery from your order page. Once it reaches you, please confirm delivery there.</p>",
    label: "Order Shipped",
    category: "Orders",
    audience: "customer",
    ctaLabel: "View your order",
  },
  "order_delivered": {
    subject: "Your order {orderNumber} has been delivered",
    body: `<p>Your order has been delivered.</p><p>Thank you for shopping with ${BRAND.name}. If anything isn't right, contact us and we'll help.</p>`,
    label: "Order Delivered",
    category: "Orders",
    audience: "customer",
    ctaLabel: "View order",
  },
  "order_cancelled": {
    subject: "Your order {orderNumber} has been cancelled",
    body: "<p>Your order {orderNumber} has been cancelled.</p><p>If you have any questions about this, contact us and we'll help.</p>",
    label: "Order Cancelled",
    category: "Orders",
    audience: "customer",
    ctaLabel: "View order",
  },
  "order_returned": {
    subject: "Your return for {orderNumber} is recorded",
    body: "<p>We've recorded the return of order {orderNumber}.</p><p>If a refund is due, we'll email you as soon as it's sent.</p>",
    label: "Order Returned",
    category: "Orders",
    audience: "customer",
    ctaLabel: "View order",
  },
  "order_refunded": {
    subject: "Your refund for {orderNumber} is on its way",
    body: "<p>We've sent a refund of {amount} for order {orderNumber}.</p><p>Depending on your bank, it can take a few working days to appear.</p>",
    label: "Order Refunded",
    category: "Orders",
    audience: "customer",
    ctaLabel: "View order",
  },
  "order_received": {
    subject: "We've received your order {orderNumber}",
    body: "<p>Thank you for your order. Your delivery address needs a custom shipping quote.</p><p>We'll email you the shipping cost and your final total to approve. No payment is taken until you approve it.</p>",
    label: "Order Received (Customer)",
    category: "Orders",
    audience: "customer",
    ctaLabel: "View order",
  },
  "order_shipping_quoted": {
    subject: "Your shipping quote for order {orderNumber}",
    body: "<p>We've priced shipping for your order {orderNumber}. Your full total is below.</p><p>Review it in your account to approve and pay. Nothing is charged until you approve.</p>",
    label: "Shipping quote ready",
    category: "Orders",
    audience: "customer",
    ctaLabel: "Review your quote",
  },
  "order_awaiting_payment": {
    subject: "Your order {orderNumber} is confirmed and awaiting payment",
    body: "<p>Thank you for confirming your quote. We've created your order {orderNumber}.</p><p>It is awaiting payment of the total below. Our team will contact you with payment instructions.</p>",
    label: "Order Awaiting Offline Payment (Customer)",
    category: "Orders",
    audience: "customer",
    ctaLabel: "View order",
  },
  "order_received_staff": {
    subject: "New order {orderNumber}",
    body: "<p>A new order has been placed. The details are below.</p>",
    label: "New Order Alert (Staff)",
    category: "Orders",
    audience: "staff",
    ctaLabel: "Open in admin",
  },
  "order_quote_declined_staff": {
    subject: "Order {orderNumber}: shipping quote declined",
    body: "<p>The customer declined the shipping quote on order {orderNumber}. The order is cancelled and its stock has been returned.</p>",
    label: "Shipping quote declined",
    category: "Orders",
    audience: "staff",
    ctaLabel: "Open in admin",
  },
  "order_paid": {
    subject: "Order {orderNumber} confirmed: payment received",
    body: "<p>Thank you for your order. We've received your payment and our team is preparing it.</p><p>We'll email you again when it ships, with tracking details.</p>",
    label: "Order Paid",
    category: "Orders",
    audience: "customer",
    ctaLabel: "View order",
  },
  "order_payment_recorded": {
    subject: "Payment received for order {orderNumber}",
    body: "<p>Thank you. We've recorded a payment on your order {orderNumber}.</p><p>The payment details and your balance are below.</p>",
    label: "Payment Recorded",
    category: "Orders",
    audience: "customer",
    ctaLabel: "View order",
  },
  "verification_approved": {
    subject: "Your identity verification is approved",
    body: "<p>Your identity verification has been approved.</p><p>You can now complete purchases that require identity verification.</p>",
    label: "Verification Approved",
    category: "Verification",
    audience: "customer",
    ctaLabel: "View your account",
  },
  "verification_rejected": {
    subject: "An update on your identity verification",
    body: "<p>We weren't able to approve your identity verification.</p><p>You can submit again from your account, and our support team can help if you have questions.</p>",
    label: "Verification Rejected",
    category: "Verification",
    audience: "customer",
    ctaLabel: "View your account",
  },
  "verification_expired": {
    subject: "Your identity verification has expired",
    body: "<p>Your identity verification has expired. Please re-verify to continue.</p><p>Re-verification takes a few minutes and keeps checkout uninterrupted.</p>",
    label: "Verification Expired",
    category: "Verification",
    audience: "customer",
    ctaLabel: "Re-verify",
  },
  "verification_submitted_staff": {
    subject: "New verification submission",
    body: "<p>A customer has submitted documents for identity verification.</p>",
    label: "Verification Submitted (Staff)",
    category: "Verification",
    audience: "staff",
    ctaLabel: "Review verification",
  },
  "verification_documents_requested": {
    subject: "We need another document from you",
    body: "<p>We need one more document before we can verify your identity.</p><p>You can upload it from your account — it only takes a minute.</p>",
    label: "Verification Documents Requested",
    category: "Verification",
    audience: "customer",
    ctaLabel: "Upload documents",
  },
  "verification_details_requested": {
    subject: "Please update your verification details",
    body: "<p>Our team reviewed your identity verification and needs you to correct the ID number or address you declared.</p><p>Open your account, make the changes, and submit them for review. Your documents stay on file.</p>",
    label: "Verification details update requested",
    category: "Verification",
    audience: "customer",
    ctaLabel: "Update your details",
  },
  "verification_request_cancelled": {
    subject: "We no longer need that from you",
    body: "<p>Our team has withdrawn the request we sent about your identity verification, so there's nothing you need to do for it.</p><p>We'll email you if we need anything else.</p>",
    label: "Verification Request Withdrawn",
    category: "Verification",
    audience: "customer",
    ctaLabel: "View verification",
  },
  "verification_documents_provided": {
    subject: "Verification documents received",
    body: "<p>A customer has uploaded the verification documents we requested.</p>",
    label: "Verification Documents Provided",
    category: "Verification",
    audience: "staff",
    ctaLabel: "Review documents",
  },
  "verification_details_updated": {
    subject: "Verification details updated",
    body: "<p>A customer corrected the details they declared for identity verification, as requested.</p><p>Review the change on the verification page.</p>",
    label: "Verification details updated (staff)",
    category: "Verification",
    audience: "staff",
    ctaLabel: "Review verification",
  },
  "welcome": {
    subject: `Welcome to ${BRAND.name}`,
    body: `<p>Welcome to ${BRAND.name}. Your account is ready to use.</p>`,
    label: "Welcome",
    category: "Account",
    audience: "customer",
    ctaLabel: "Go to your account",
  },
  "password_reset_requested": {
    subject: "Reset your password",
    body: "<p>We received a request to reset the password for your account. The button below works for 30 minutes and can be used once.</p><p>If you didn't ask for this, you can ignore this email. Your password won't change.</p>",
    label: "Password Reset Requested",
    category: "Account",
    audience: "customer",
    ctaLabel: "Reset password",
  },
  "password_changed": {
    subject: "Your password was changed",
    body: "<p>The password for your account was just changed.</p><p>If you made this change, there's nothing more to do. If you didn't, reset your password now and contact us.</p>",
    label: "Password Changed",
    category: "Account",
    audience: "customer",
    ctaLabel: "Reset password",
  },
  "email_verification_requested": {
    subject: "Confirm your email address",
    body: "<p>Confirm your email address to finish creating your account. The button below works for 24 hours and can be used once.</p><p>If you didn't create an account with us, you can ignore this email.</p>",
    label: "Email Verification Requested",
    category: "Account",
    audience: "customer",
    ctaLabel: "Confirm email",
  },
};

export const UNPAUSABLE_TEMPLATE_KEYS: ReadonlySet<string> = new Set([
  "password_reset_requested",
  "password_changed",
  "email_verification_requested",
]);

export function hasOverrideContent(row: {
  subject: string | null;
  preheaderText: string | null;
  bodyParagraphs: unknown;
  ctaLabel: string | null;
}): boolean {
  return (
    row.subject !== null ||
    row.preheaderText !== null ||
    row.bodyParagraphs !== null ||
    row.ctaLabel !== null
  );
}

export function splitDefaultBodyParagraphs(html: string): string[] {
  return html
    .split(/<\/p>\s*<p>/)
    .map((s) => s.replace(/^<p>/, "").replace(/<\/p>$/, ""))
    .map((s) =>
      s
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'"),
    )
    .map((s) => s.trim())
    .filter(Boolean);
}

import { BRAND, BRAND_COLORS } from "@/lib/config/brand";
import { escapeHtml } from "@/lib/email/escape";
import { formatDateTime } from "@/lib/utils/date";
import { formatAED } from "@/lib/utils/currency";
import { clientEnv } from "@/lib/env.client";
import type enMessages from "@/messages/en.json";

const TOKEN_PATTERN = /\{([a-zA-Z0-9_]+)\}/g;

export type EmailChromeStrings = typeof enMessages.email;

export interface EmailChromeContext {
  locale: "en" | "ar" | "ru";
  dir: "ltr" | "rtl";
  strings: EmailChromeStrings;
}

export function fillEmailString(
  template: string,
  args: Record<string, string | number> = {},
): string {
  return template.replace(TOKEN_PATTERN, (_match, token: string) => {
    const value = args[token];
    return value === undefined ? "" : String(value);
  });
}

export function renderEmailBody(
  template: string,
  payload: Record<string, unknown> = {},
): string {
  return template.replace(TOKEN_PATTERN, (_match, token: string) => {
    const value = payload[token];
    if (value === undefined || value === null) return "";
    return escapeHtml(String(value));
  });
}

export function renderEmailText(
  template: string,
  payload: Record<string, unknown> = {},
): string {
  const withTokens = escapeHtml(template).replace(
    TOKEN_PATTERN,
    (_match, token: string) => {
      const value = payload[token];
      if (value === undefined || value === null) return "";
      return escapeHtml(String(value));
    },
  );
  return withTokens.replace(/\r?\n/g, "<br>");
}

export function renderEmailSubject(
  template: string,
  payload: Record<string, unknown> = {},
): string {
  const withTokens = template.replace(TOKEN_PATTERN, (_match, token: string) => {
    const value = payload[token];
    if (value === undefined || value === null) return "";
    return String(value);
  });
  return withTokens.replace(/\s+/g, " ").trim();
}

export function renderParagraphs(
  paragraphs: string[],
  payload: Record<string, unknown> = {},
): string {
  return paragraphs
    .map((paragraph) => `<p>${renderEmailText(paragraph, payload)}</p>`)
    .join("");
}

export type EmailChromeBadgeTone =
  | "danger"
  | "warning"
  | "info"
  | "neutral"
  | "success";

export interface EmailChromeBadge {
  text: string;
  tone: EmailChromeBadgeTone;
}

export interface EmailInfoRow {
  label: string;
  value: string;
}

export interface EmailSummaryLine {
  name: string;
  quantity: number;
  lineTotal: number | null;
}

export interface EmailSummaryItem extends EmailSummaryLine {
  addons: EmailSummaryLine[];
  serials?: { kind: "SERIAL" | "LOT"; values: string[] };
}

export interface EmailOrderSummary {
  items: EmailSummaryItem[];
  subtotal: number;
  addonTotal: number;
  shippingCost: number;
  shippingMethodName: string | null;
  shippingPending: boolean;
  discountAmount: number;
  couponCode: string | null;
  loyaltyPointsUsed: number;
  loyaltyDiscountAmount: number;
  total: number;
  taxAmount: number | null;
  vatRate: number;
}

export interface EmailAddress {
  fullName: string;
  lines: string[];
}

export interface EmailChromeOptions {
  storeName?: string;
  contactEmail?: string;
  contactPhone?: string;
  addressLine?: string;
  recipientName?: string;
  timestamp?: Date;
  badges?: EmailChromeBadge[];
  infoRows?: EmailInfoRow[];
  ctaLabel?: string;
  ctaUrl?: string;
  transparencyNote?: string;
  preheaderText?: string;
  orderSummary?: EmailOrderSummary;
  shippingAddress?: EmailAddress;
  showSupport?: boolean;
  messageExcerpt?: { label: string; text: string };
}

export const CUSTOMER_ORDER_NOTE =
  `You're receiving this because you placed an order with ${BRAND.name}.`;

export const STAFF_ORDERS_NOTE =
  `You're receiving this because you're on the ${BRAND.name} orders notification list.`;

export const STAFF_SUPPORT_NOTE =
  `You're receiving this because you're on the ${BRAND.name} support notification list.`;

export const STAFF_SALES_NOTE =
  `You're receiving this because you're on the ${BRAND.name} sales notification list.`;

export const CUSTOMER_QUOTE_NOTE =
  `You're receiving this because you requested a quote from ${BRAND.name}.`;

export const CUSTOMER_B2B_NOTE =
  `You're receiving this because you applied for a business account with ${BRAND.name}.`;

const APP_BASE_URL = clientEnv.NEXT_PUBLIC_APP_URL ?? "";

const BRAND_NAME = BRAND.name;
const FONT = "font-family:Helvetica,Arial,sans-serif;";
const INK = "#111827";
const MUTED = "#6b7280";

const BADGE_TONE_COLORS: Record<
  EmailChromeBadgeTone,
  { bg: string; fg: string }
> = {
  danger: { bg: "#fdecea", fg: "#a32d2d" },
  warning: { bg: "#fdf3e0", fg: "#8a5a00" },
  info: { bg: "#eef2f7", fg: "#3a4a5c" },
  neutral: { bg: "#f1f1ef", fg: "#5f5e5a" },
  success: { bg: "#eaf6ea", fg: "#1e7a34" },
};

function formatTimestamp(date: Date, ctx: EmailChromeContext): string {
  return formatDateTime(date.toISOString(), ctx.locale);
}

function money(amount: number | null): string {
  const text = amount === null ? "—" : formatAED(amount);
  return `<span dir="ltr" style="white-space:nowrap;">${escapeHtml(text)}</span>`;
}

function sectionLabel(text: string, ctx: EmailChromeContext): string {
  const letterSpacing = ctx.dir === "rtl" ? "0" : "0.14em";
  return `<p style="margin:28px 0 10px;${FONT}font-size:11px;font-weight:700;letter-spacing:${letterSpacing};color:${MUTED};">${escapeHtml(text)}</p>`;
}

export function excerpt(text: string, max = 300): string {
  const collapsed = text.trim().replace(/\n{3,}/g, "\n\n");
  if (collapsed.length <= max) return collapsed;
  const cut = collapsed.slice(0, max);
  const lastWs = cut.search(/\s+\S*$/);
  const base = lastWs > 0 ? cut.slice(0, lastWs) : cut;
  return `${base}…`;
}

function ladderRow(
  labelHtml: string,
  valueHtml: string,
  ctx: EmailChromeContext,
  labelColor: string = MUTED,
): string {
  const align = ctx.dir === "rtl" ? "left" : "right";
  return `<tr><td style="padding:5px 0;${FONT}font-size:13px;color:${labelColor};">${labelHtml}</td><td align="${align}" style="padding:5px 0;${FONT}font-size:13px;color:${INK};">${valueHtml}</td></tr>`;
}

function renderOrderSummary(
  summary: EmailOrderSummary,
  ctx: EmailChromeContext,
): string {
  const s = ctx.strings;
  const rtl = ctx.dir === "rtl";
  const align = rtl ? "left" : "right";
  const itemNamePadding = rtl
    ? "padding:12px 0 0 12px;"
    : "padding:12px 12px 0 0;";
  const addonPadding = rtl
    ? "padding:4px 14px 0 12px;"
    : "padding:4px 12px 0 14px;";

  const itemRows = summary.items
    .map((item, index) => {
      const divider = index > 0 ? "border-top:1px solid #f1f1ef;" : "";
      const addonRows = item.addons
        .map(
          (addon) =>
            `<tr><td style="${addonPadding}${FONT}font-size:12px;color:${MUTED};">+ ${escapeHtml(addon.name)} &times;${addon.quantity}</td><td align="${align}" valign="top" style="padding:4px 0 0;${FONT}font-size:12px;color:${MUTED};">${money(addon.lineTotal)}</td></tr>`,
        )
        .join("");
      const serialRow =
        item.serials && item.serials.values.length > 0
          ? `<tr><td colspan="2" style="padding:2px 0 0;${FONT}font-size:12px;color:${MUTED};">${escapeHtml(item.serials.kind === "LOT" ? s.ladder.lot : s.ladder.serial)}: <span dir="ltr">${item.serials.values.map((value) => escapeHtml(value)).join(", ")}</span></td></tr>`
          : "";
      return `<tr><td style="${itemNamePadding}${FONT}font-size:14px;font-weight:600;color:${INK};${divider}">${escapeHtml(item.name)}</td><td align="${align}" valign="top" style="padding:12px 0 0;${FONT}font-size:14px;font-weight:600;color:${INK};${divider}">${money(item.lineTotal)}</td></tr><tr><td colspan="2" style="padding:2px 0 0;${FONT}font-size:12px;color:${MUTED};">&times;${item.quantity}</td></tr>${serialRow}${addonRows}<tr><td colspan="2" style="padding:0 0 12px;"></td></tr>`;
    })
    .join("");

  const method = summary.shippingMethodName
    ? escapeHtml(summary.shippingMethodName)
    : null;
  const shippingLabel = method
    ? `${escapeHtml(s.ladder.shipping)} &middot; ${method}`
    : escapeHtml(s.ladder.shipping);
  const code = summary.couponCode ? escapeHtml(summary.couponCode) : null;
  const discountLabel = code
    ? `${escapeHtml(s.ladder.discount)} &middot; <span dir="ltr">${code}</span>`
    : escapeHtml(s.ladder.discount);

  const ladder = [
    ladderRow(escapeHtml(s.ladder.subtotal), money(summary.subtotal), ctx, INK),
    summary.addonTotal > 0
      ? ladderRow(escapeHtml(s.ladder.addons), money(summary.addonTotal), ctx)
      : "",
    summary.shippingPending
      ? ladderRow(
          escapeHtml(s.ladder.shipping),
          `<span style="color:#8a5a00;">${escapeHtml(s.ladder.quotedSeparately)}</span>`,
          ctx,
        )
      : ladderRow(shippingLabel, money(summary.shippingCost), ctx),
    summary.discountAmount > 0
      ? ladderRow(
          discountLabel,
          `<span style="color:#166534;">&minus;${money(summary.discountAmount)}</span>`,
          ctx,
        )
      : "",
    summary.loyaltyDiscountAmount > 0
      ? ladderRow(
          `${escapeHtml(s.ladder.points)} &middot; <span dir="ltr">${summary.loyaltyPointsUsed.toLocaleString("en-US")}</span>`,
          `<span style="color:#166534;">&minus;${money(summary.loyaltyDiscountAmount)}</span>`,
          ctx,
        )
      : "",
  ].join("");

  const vatRow =
    summary.taxAmount !== null && summary.taxAmount > 0
      ? `<tr><td style="padding:2px 0;${FONT}font-size:12px;color:${MUTED};">${escapeHtml(fillEmailString(s.ladder.includesVat, { rate: Math.round(summary.vatRate * 100) }))}</td><td align="${align}" style="padding:2px 0;${FONT}font-size:12px;color:${MUTED};">${money(summary.taxAmount)}</td></tr>`
      : "";

  const totalLetterSpacing = rtl ? "0" : "0.08em";
  const terminal = summary.shippingPending
    ? ""
    : `<tr><td style="padding:12px 0 4px;border-top:1px solid ${INK};${FONT}font-size:14px;font-weight:700;letter-spacing:${totalLetterSpacing};color:${INK};">${escapeHtml(s.ladder.total)}</td><td align="${align}" style="padding:12px 0 4px;border-top:1px solid ${INK};${FONT}font-size:16px;font-weight:700;color:${INK};">${money(summary.total)}</td></tr>${vatRow}`;

  return `${sectionLabel(s.sections.orderSummary, ctx)}<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${itemRows}</table><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-top:1px solid #e5e7eb;"><tr><td colspan="2" style="padding-top:6px;"></td></tr>${ladder}${terminal}</table>`;
}

function renderShippingAddress(
  address: EmailAddress,
  ctx: EmailChromeContext,
): string {
  const lines = address.lines
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => `<br>${escapeHtml(line)}`)
    .join("");
  return `${sectionLabel(ctx.strings.sections.shippingTo, ctx)}<p style="margin:0;${FONT}font-size:13px;line-height:1.6;color:${INK};"><span style="font-weight:600;">${escapeHtml(address.fullName)}</span>${lines}</p>`;
}

function renderMessageExcerpt(
  messageExcerpt: { label: string; text: string },
  ctx: EmailChromeContext,
): string {
  const text = escapeHtml(messageExcerpt.text).replace(/\r?\n/g, "<br>");
  const border = ctx.dir === "rtl" ? "border-right" : "border-left";
  return `${sectionLabel(messageExcerpt.label, ctx)}<p style="margin:0;${FONT}font-size:13px;line-height:1.6;color:${INK};${border}:3px solid #e5e7eb;border-radius:0;padding:6px 12px;">${text}</p>`;
}

export function renderEmailChrome(
  contentHtml: string,
  options: EmailChromeOptions,
  ctx: EmailChromeContext,
): string {
  const s = ctx.strings;
  const rtl = ctx.dir === "rtl";
  const align = rtl ? "left" : "right";

  const storeName = escapeHtml(options.storeName?.trim() || BRAND_NAME);

  const footerParts = [
    options.addressLine,
    options.contactPhone,
    options.contactEmail,
  ]
    .map((part) => part?.trim())
    .filter((part): part is string => Boolean(part))
    .map((part) => escapeHtml(part));

  const footer = footerParts.length
    ? `<p style="margin:0;font-size:12px;line-height:1.6;color:${MUTED};">${footerParts.join(" &middot; ")}</p>`
    : "";

  const transparencyNote = options.transparencyNote?.trim()
    ? `<p style="margin:0 0 8px;font-size:12px;line-height:1.6;color:${MUTED};">${escapeHtml(options.transparencyNote.trim())}</p>`
    : "";

  const timestamp = options.timestamp
    ? `<td align="${align}" style="${FONT}font-size:12px;color:#9ca3af;">${escapeHtml(formatTimestamp(options.timestamp, ctx))}</td>`
    : "";

  const greeting = options.recipientName?.trim()
    ? `<p style="margin:0 0 16px;">${escapeHtml(fillEmailString(s.greeting, { name: options.recipientName.trim() }))}</p>`
    : "";

  const badgePadding = rtl ? "padding:0 0 0 8px;" : "padding:0 8px 0 0;";
  const badgesRow = options.badges?.length
    ? `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin-top:20px;"><tr>${options.badges
        .map((badge) => {
          const colors = BADGE_TONE_COLORS[badge.tone];
          return `<td style="${badgePadding}"><span style="display:inline-block;padding:4px 10px;border-radius:12px;${FONT}font-size:12px;font-weight:600;background-color:${colors.bg};color:${colors.fg};">${escapeHtml(badge.text)}</span></td>`;
        })
        .join("")}</tr></table>`
    : "";

  const infoTable = options.infoRows?.length
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:20px;background-color:#f9fafb;border:1px solid #e5e7eb;border-radius:6px;">${options.infoRows
        .map((row, index) => {
          const borderTop = index > 0 ? "border-top:1px solid #e5e7eb;" : "";
          return `<tr><td style="padding:10px 16px;${FONT}font-size:13px;color:${MUTED};${borderTop}">${escapeHtml(row.label)}</td><td style="padding:10px 16px;${FONT}font-size:13px;color:${INK};text-align:${align};${borderTop}">${escapeHtml(row.value)}</td></tr>`;
        })
        .join("")}</table>`
    : "";

  const cta =
    options.ctaLabel && options.ctaUrl
      ? `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin-top:24px;"><tr><td style="border-radius:6px;background-color:${BRAND_COLORS.primary};"><a href="${escapeHtml(options.ctaUrl)}" style="display:inline-block;padding:12px 24px;${FONT}font-size:14px;font-weight:700;color:#ffffff;text-decoration:none;">${escapeHtml(options.ctaLabel)}</a></td></tr></table><p style="margin:12px 0 0;${FONT}font-size:12px;color:${MUTED};">${escapeHtml(s.cta.fallback)}<br>${escapeHtml(options.ctaUrl)}</p>`
      : "";

  const preheader = options.preheaderText?.trim()
    ? `<span style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(options.preheaderText.trim())}</span>`
    : "";

  const messageExcerpt = options.messageExcerpt
    ? renderMessageExcerpt(options.messageExcerpt, ctx)
    : "";

  const orderSummary = options.orderSummary
    ? renderOrderSummary(options.orderSummary, ctx)
    : "";

  const shippingAddress = options.shippingAddress
    ? renderShippingAddress(options.shippingAddress, ctx)
    : "";

  const rawSupportParts = [options.contactEmail, options.contactPhone]
    .map((part) => part?.trim())
    .filter((part): part is string => Boolean(part));

  const support =
    options.showSupport && rawSupportParts.length
      ? `${sectionLabel(s.sections.needHelp, ctx)}<p style="margin:0;${FONT}font-size:13px;line-height:1.6;color:${INK};">${escapeHtml(fillEmailString(s.support, { contacts: rawSupportParts.join(" · ") }))}</p>`
      : "";

  const headerLogo = APP_BASE_URL
    ? `<img src="${APP_BASE_URL}${BRAND.emailLogo.src}" width="${Math.round(BRAND.emailLogo.width / 2)}" height="${Math.round(BRAND.emailLogo.height / 2)}" alt="${escapeHtml(BRAND_NAME)}" style="display:block;border:0;margin:0 0 12px;">`
    : "";

  return `<!DOCTYPE html>
<html lang="${ctx.locale}" dir="${ctx.dir}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${storeName}</title>
</head>
<body style="margin:0;padding:0;background-color:#f3f4f6;">
${preheader}<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f3f4f6;">
<tr>
<td align="center" style="padding:24px 12px;">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" dir="${ctx.dir}" style="width:100%;max-width:600px;background-color:#ffffff;border:1px solid #e5e7eb;border-radius:8px;">
<tr>
<td style="padding:20px 32px;background-color:${BRAND_COLORS.surfaceDark};border-bottom:3px solid ${BRAND_COLORS.primary};border-radius:8px 8px 0 0;">
${headerLogo}<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td style="${FONT}font-size:16px;font-weight:700;letter-spacing:0.18em;text-transform:uppercase;color:#ffffff;">${storeName}</td>${timestamp}</tr></table>
</td>
</tr>
<tr>
<td style="padding:28px 32px;${FONT}font-size:15px;line-height:1.6;color:${INK};">
${greeting}${contentHtml}${badgesRow}${infoTable}${cta}${messageExcerpt}${orderSummary}${shippingAddress}${support}
</td>
</tr>
<tr>
<td style="padding:16px 32px 24px;border-top:1px solid #e5e7eb;${FONT}">
${transparencyNote}${footer}
</td>
</tr>
</table>
</td>
</tr>
</table>
</body>
</html>`;
}

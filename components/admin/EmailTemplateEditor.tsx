"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/Toast";
import Input from "@/components/ui/Input";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import {
  upsertEmailTemplateOverrideAction,
  resetEmailTemplateOverrideAction,
  setEmailTemplateSendingAction,
} from "@/lib/actions/email-template";
import {
  renderParagraphs,
  renderEmailSubject,
  renderEmailChrome,
  CUSTOMER_ORDER_NOTE,
  STAFF_ORDERS_NOTE,
  STAFF_SUPPORT_NOTE,
  STAFF_SALES_NOTE,
  CUSTOMER_QUOTE_NOTE,
  CUSTOMER_B2B_NOTE,
  type EmailChromeOptions,
  type EmailOrderSummary,
  type EmailChromeContext,
} from "@/lib/email/chrome";
import {
  EMAIL_DEFAULTS,
  UNPAUSABLE_TEMPLATE_KEYS,
  splitDefaultBodyParagraphs,
  hasOverrideContent,
} from "@/lib/email/defaults";
import type { EmailTemplate } from "@/app/generated/prisma/client";
import { BRAND } from "@/lib/config/brand";

type Locale = "en" | "ar" | "ru";
type OverrideRow = EmailTemplate;

interface StoreProfile {
  storeName: string;
  contactEmail: string;
  contactPhone: string;
  addressLine: string;
}

interface Props {
  templateKey: string;
  defaultSubject: string;
  defaultBody: string;
  initialOverrides: Record<Locale, OverrideRow | null>;
  sendingEnabled: boolean;
  defaultCtaLabel?: string;
  storeProfile: StoreProfile;
  chromeContexts: Record<Locale, EmailChromeContext>;
}

interface LocaleFormState {
  subject: string;
  preheaderText: string;
  bodyParagraphs: string[];
  ctaLabel: string;
}

interface FieldErrors {
  subject?: string;
  preheaderText?: string;
  bodyParagraphs?: string;
  ctaLabel?: string;
}

const SAMPLE_ORDER_NUMBER = `${BRAND.orderPrefix}-2026-000123`;
const SAMPLE_QUOTE_NUMBER = `${BRAND.quotePrefix}-2026-000045`;
const LOCALES: Locale[] = ["en", "ar", "ru"];
const LOCALE_LABELS: Record<Locale, string> = {
  en: "English",
  ar: "Arabic",
  ru: "Russian",
};

const SAMPLE_TOKEN_VALUES: Record<string, string | number> = {
  ticketNumber: "TKT-2026-000031",
  subject: "Damaged rifle case on arrival",
  toStatus: "Closed",
  fromStatus: "In Progress",
  assignedByName: "Sara Al Farsi",
  preview: "Thanks for the update, following up on this.",
  companyNameEn: "Al Barari Trading LLC",
  tradeLicenseNo: "DED-778214",
  company: "Al Barari Trading LLC",
  documentCount: 2,
  quoteNumber: SAMPLE_QUOTE_NUMBER,
  itemCount: 6,
  note: "Updated shipping quote attached.",
  orderNumber: SAMPLE_ORDER_NUMBER,
  trackingNumber: "1Z999AA10123456784",
  trackingUrl: "https://track.example.com/1Z999AA10123456784",
};

const SAMPLE_ORDER_SUMMARY: EmailOrderSummary = {
  items: [
    {
      name: "Field Series 12ga",
      quantity: 1,
      lineTotal: 6850,
      addons: [{ name: "Hard case", quantity: 1, lineTotal: 450 }],
    },
    {
      name: "Ashgrove Field Load 12ga, box of 25",
      quantity: 4,
      lineTotal: 360,
      addons: [],
    },
  ],
  subtotal: 7210,
  addonTotal: 450,
  shippingCost: 35,
  shippingMethodName: "Standard Delivery",
  shippingPending: false,
  discountAmount: 200,
  couponCode: "WELCOME200",
  loyaltyPointsUsed: 0,
  loyaltyDiscountAmount: 0,
  total: 7495,
  taxAmount: 355.24,
  vatRate: 0.05,
};

const SAMPLE_SHIPPING_ADDRESS = {
  fullName: "Ahmed Al Mansoori",
  lines: ["Unit 12, Example Street", "Sample City", "United Arab Emirates"],
};

const SAMPLE_QUOTE_SUMMARY: EmailOrderSummary = {
  items: [
    {
      name: "Air rifle .22",
      quantity: 2,
      lineTotal: 3000,
      addons: [{ name: "Scope mount", quantity: 2, lineTotal: 240 }],
    },
    {
      name: "Pellet tin",
      quantity: 4,
      lineTotal: 200,
      addons: [],
    },
  ],
  subtotal: 3200,
  addonTotal: 240,
  shippingCost: 150,
  shippingMethodName: "Freight, Dubai",
  shippingPending: false,
  discountAmount: 0,
  couponCode: null,
  loyaltyPointsUsed: 0,
  loyaltyDiscountAmount: 0,
  total: 3590,
  taxAmount: null,
  vatRate: 0.05,
};

function buildSampleBlocks(templateKey: string): EmailChromeOptions {
  const def = EMAIL_DEFAULTS[templateKey];
  if (!def) return {};

  if (def.category === "Tickets") {
    return {
      badges: [
        { text: "High", tone: "warning" },
        { text: "Order Issue", tone: "neutral" },
      ],
      infoRows: [
        { label: "Ticket", value: "TKT-2026-000031" },
        { label: "Subject", value: "Damaged rifle case on arrival" },
        { label: "Linked", value: `Order ${SAMPLE_ORDER_NUMBER}` },
        { label: "Customer", value: "Ahmed Al Mansoori · ahmed@example.com" },
        { label: "Assigned to", value: "Sara Al Farsi" },
        { label: "Opened", value: "19 Sep 2026" },
      ],
      messageExcerpt: {
        label: "Message",
        text: "The rifle case arrived with a cracked latch on the left hinge. Could someone follow up on a replacement?",
      },
      transparencyNote: STAFF_SUPPORT_NOTE,
    };
  }

  if (def.category === "Quotes" && def.audience === "staff") {
    return {
      badges: [{ text: "Accepted", tone: "success" }],
      infoRows: [
        { label: "Quote", value: SAMPLE_QUOTE_NUMBER },
        { label: "Customer", value: "Ahmed Al Mansoori · ahmed@example.com" },
        { label: "Company", value: "Al Barari Trading LLC" },
        { label: "Items", value: "2 products, 1 add-on" },
        { label: "Agreed total", value: "AED 3,590.00" },
      ],
      transparencyNote: STAFF_SALES_NOTE,
    };
  }

  if (def.category === "Quotes") {
    if (templateKey === "quote_status_changed") {
      return {
        recipientName: "Ahmed",
        showSupport: true,
        badges: [{ text: "Closed", tone: "neutral" }],
        infoRows: [
          { label: "Quote", value: SAMPLE_QUOTE_NUMBER },
          { label: "Status", value: "Closed" },
        ],
        messageExcerpt: { label: "Note", text: "Updated shipping quote attached." },
        transparencyNote: CUSTOMER_QUOTE_NOTE,
      };
    }
    return {
      recipientName: "Ahmed",
      showSupport: true,
      badges: [{ text: "Quote ready", tone: "success" }],
      infoRows: [
        { label: "Quote", value: SAMPLE_QUOTE_NUMBER },
        { label: "Company", value: "Al Barari Trading LLC" },
        { label: "Quoted on", value: "19 Sep 2026" },
      ],
      orderSummary: SAMPLE_QUOTE_SUMMARY,
      messageExcerpt: {
        label: "Note from our team",
        text: "Updated shipping quote attached.",
      },
      transparencyNote: CUSTOMER_QUOTE_NOTE,
    };
  }

  if (def.category === "B2B" && def.audience === "staff") {
    if (templateKey === "b2b_registration_received") {
      return {
        badges: [{ text: "Pending review", tone: "warning" }],
        infoRows: [
          { label: "Company", value: "Al Barari Trading LLC" },
          { label: "Trade licence", value: "DED-778214" },
          { label: "Applicant", value: "Ahmed Al Mansoori · ahmed@example.com" },
        ],
        transparencyNote: STAFF_SALES_NOTE,
      };
    }
    if (templateKey === "b2b_renewal_received") {
      return {
        badges: [{ text: "Renewal requested", tone: "info" }],
        infoRows: [
          { label: "Company", value: "Al Barari Trading LLC" },
          { label: "Trade licence", value: "DED-778214" },
          { label: "Applicant", value: "Ahmed Al Mansoori · ahmed@example.com" },
          { label: "Current expiry", value: "19 Sep 2026" },
        ],
        transparencyNote: STAFF_SALES_NOTE,
      };
    }
    if (templateKey === "b2b_documents_provided") {
      return {
        badges: [{ text: "Documents received", tone: "info" }],
        infoRows: [
          { label: "Company", value: "Al Barari Trading LLC" },
          { label: "Trade licence", value: "DED-778214" },
          { label: "Applicant", value: "Ahmed Al Mansoori · ahmed@example.com" },
          { label: "Documents", value: "2" },
        ],
        transparencyNote: STAFF_SALES_NOTE,
      };
    }
    if (templateKey === "b2b_details_updated") {
      return {
        badges: [{ text: "Details updated", tone: "info" }],
        infoRows: [
          { label: "Company", value: "Al Barari Trading LLC" },
          { label: "Trade licence", value: "DED-778214" },
          { label: "Applicant", value: "Ahmed Al Mansoori · ahmed@example.com" },
          { label: "Licence changed", value: "Yes" },
        ],
        transparencyNote: STAFF_SALES_NOTE,
      };
    }
    return {
      badges: [{ text: "New quote request", tone: "info" }],
      infoRows: [
        { label: "Quote", value: SAMPLE_QUOTE_NUMBER },
        { label: "Company", value: "Al Barari Trading LLC" },
        { label: "Trade licence", value: "DED-778214" },
        { label: "Customer", value: "Ahmed Al Mansoori · ahmed@example.com" },
        { label: "Items", value: "2 products, 1 add-on" },
      ],
      transparencyNote: STAFF_SALES_NOTE,
    };
  }

  if (def.category === "B2B") {
    if (templateKey === "b2b_approved") {
      return {
        recipientName: "Ahmed",
        showSupport: true,
        badges: [{ text: "Approved", tone: "success" }],
        infoRows: [
          { label: "Company", value: "Al Barari Trading LLC" },
          { label: "Trade licence", value: "DED-778214" },
          { label: "Valid until", value: "19 Sep 2028" },
        ],
        transparencyNote: CUSTOMER_B2B_NOTE,
      };
    }
    if (templateKey === "b2b_rejected") {
      return {
        recipientName: "Ahmed",
        showSupport: true,
        badges: [{ text: "Not approved", tone: "danger" }],
        infoRows: [
          { label: "Company", value: "Al Barari Trading LLC" },
          { label: "Reason", value: "Trade licence document was unreadable." },
        ],
        transparencyNote: CUSTOMER_B2B_NOTE,
      };
    }
    if (templateKey === "b2b_suspended") {
      return {
        recipientName: "Ahmed",
        showSupport: true,
        badges: [{ text: "Suspended", tone: "warning" }],
        infoRows: [
          { label: "Company", value: "Al Barari Trading LLC" },
          { label: "Reason", value: "Outstanding compliance review." },
        ],
        transparencyNote: CUSTOMER_B2B_NOTE,
      };
    }
    if (templateKey === "b2b_expired") {
      return {
        recipientName: "Ahmed",
        showSupport: true,
        badges: [{ text: "Expired", tone: "warning" }],
        infoRows: [
          { label: "Company", value: "Al Barari Trading LLC" },
          { label: "Expired on", value: "19 Sep 2026" },
        ],
        transparencyNote: CUSTOMER_B2B_NOTE,
      };
    }
    return {
      recipientName: "Ahmed",
      showSupport: true,
      badges: [{ text: "Action needed", tone: "info" }],
      infoRows: [
        { label: "Company", value: "Al Barari Trading LLC" },
        { label: "Requested on", value: "19 Sep 2026" },
      ],
      messageExcerpt: {
        label: "What we need",
        text: "Please upload a clear photo or scan of your current trade licence.",
      },
      transparencyNote: CUSTOMER_B2B_NOTE,
    };
  }

  const isOrder = def.category === "Orders";
  if (def.audience === "staff") {
    if (!isOrder) return {};
    return {
      transparencyNote: STAFF_ORDERS_NOTE,
      infoRows: [
        { label: "Order", value: SAMPLE_ORDER_NUMBER },
        { label: "Customer", value: "Ahmed Al Mansoori · ahmed@example.com" },
        { label: "Ship to", value: "Dubai, United Arab Emirates" },
        { label: "Items", value: "2 products, 1 add-on" },
        { label: "Total", value: "AED 7,495.00" },
      ],
    };
  }
  const base: EmailChromeOptions = { recipientName: "Ahmed", showSupport: true };
  if (!isOrder) return base;
  if (templateKey === "order_payment_recorded") {
    return {
      ...base,
      transparencyNote: CUSTOMER_ORDER_NOTE,
      infoRows: [
        { label: "Order", value: SAMPLE_ORDER_NUMBER },
        { label: "Amount received", value: "AED 5,000.00" },
        { label: "Method", value: "Bank Transfer" },
        { label: "Reference", value: "TRX-448210" },
        { label: "Paid on", value: "19 Sep 2026" },
        { label: "Order total", value: "AED 7,495.00" },
        { label: "Paid to date", value: "AED 5,000.00" },
        { label: "Balance due", value: "AED 2,495.00" },
      ],
    };
  }
  return {
    ...base,
    transparencyNote: CUSTOMER_ORDER_NOTE,
    infoRows: [
      { label: "Order", value: SAMPLE_ORDER_NUMBER },
      { label: "Order date", value: "19 Sep 2026" },
    ],
    orderSummary:
      templateKey === "order_received"
        ? { ...SAMPLE_ORDER_SUMMARY, shippingPending: true }
        : SAMPLE_ORDER_SUMMARY,
    shippingAddress: SAMPLE_SHIPPING_ADDRESS,
  };
}

const TOKEN_PATTERN = /\{([a-zA-Z0-9_]+)\}/g;

function buildSamplePayload(templateKey: string): Record<string, unknown> {
  const def = EMAIL_DEFAULTS[templateKey];
  if (!def) return {};
  const tokens = new Set<string>();
  for (const match of `${def.subject} ${def.body}`.matchAll(TOKEN_PATTERN)) {
    tokens.add(match[1]);
  }
  const payload: Record<string, unknown> = {};
  for (const token of tokens) {
    payload[token] = SAMPLE_TOKEN_VALUES[token] ?? `Sample ${token}`;
  }
  return payload;
}

function seedState(
  defaultSubject: string,
  defaultBody: string,
  override: OverrideRow | null,
  defaultCtaLabel?: string,
): LocaleFormState {
  if (!override) {
    return {
      subject: defaultSubject,
      preheaderText: "",
      bodyParagraphs: splitDefaultBodyParagraphs(defaultBody),
      ctaLabel: defaultCtaLabel ?? "",
    };
  }
  const bodyParagraphs = Array.isArray(override.bodyParagraphs)
    ? (override.bodyParagraphs as unknown as string[])
    : splitDefaultBodyParagraphs(defaultBody);
  return {
    subject: override.subject ?? defaultSubject,
    preheaderText: override.preheaderText ?? "",
    bodyParagraphs,
    ctaLabel: override.ctaLabel ?? defaultCtaLabel ?? "",
  };
}

function buildForms(
  defaultSubject: string,
  defaultBody: string,
  initialOverrides: Record<Locale, OverrideRow | null>,
  defaultCtaLabel?: string,
): Record<Locale, LocaleFormState> {
  return {
    en: seedState(defaultSubject, defaultBody, initialOverrides.en, defaultCtaLabel),
    ar: seedState(defaultSubject, defaultBody, initialOverrides.ar, defaultCtaLabel),
    ru: seedState(defaultSubject, defaultBody, initialOverrides.ru, defaultCtaLabel),
  };
}

function statesEqual(a: LocaleFormState, b: LocaleFormState): boolean {
  return (
    a.subject === b.subject &&
    a.preheaderText === b.preheaderText &&
    a.ctaLabel === b.ctaLabel &&
    a.bodyParagraphs.length === b.bodyParagraphs.length &&
    a.bodyParagraphs.every((p, i) => p === b.bodyParagraphs[i])
  );
}

const cardStyle: React.CSSProperties = {
  backgroundColor: "#ffffff",
  border: "1px solid var(--color-shop-divider)",
  borderRadius: "0",
};

const labelTextStyle: React.CSSProperties = {
  fontSize: "var(--text-body)",
  fontWeight: "var(--font-medium)",
  color: "var(--color-auth-label-text)",
};

const destructiveOutline: React.CSSProperties = {
  backgroundColor: "#991b1b",
  color: "#ffffff",
  border: "none",
};

const btnBase: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  height: "2.5rem",
  paddingInline: "1.25rem",
  fontSize: "var(--text-body-sm)",
  fontWeight: "var(--font-bold)",
  letterSpacing: "var(--tracking-widest)",
  textTransform: "uppercase",
  border: "none",
  borderRadius: "0",
  transition: "opacity 150ms",
};

function EnabledSwitch({
  enabled,
  disabled,
  pending,
  onToggle,
}: {
  enabled: boolean;
  disabled: boolean;
  pending: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={enabled}
      disabled={disabled || pending}
      onClick={onToggle}
      style={{
        display: "inline-flex",
        alignItems: "center",
        width: "2.5rem",
        height: "1.375rem",
        padding: "0.1875rem",
        backgroundColor: enabled
          ? "var(--color-action-primary)"
          : "var(--color-auth-input-border)",
        border: "none",
        borderRadius: "9999px",
        cursor: disabled || pending ? "not-allowed" : "pointer",
        opacity: disabled || pending ? 0.5 : 1,
        transition: "background-color 150ms",
      }}
    >
      <span
        aria-hidden="true"
        style={{
          width: "1rem",
          height: "1rem",
          borderRadius: "9999px",
          backgroundColor: "#ffffff",
          transform: enabled ? "translateX(1.125rem)" : "translateX(0)",
          transition: "transform 150ms",
        }}
      />
    </button>
  );
}

export default function EmailTemplateEditor({
  templateKey,
  defaultSubject,
  defaultBody,
  initialOverrides,
  sendingEnabled: initialSendingEnabled,
  defaultCtaLabel,
  storeProfile,
  chromeContexts,
}: Props) {
  const router = useRouter();
  const toast = useToast();

  const [activeLocale, setActiveLocale] = useState<Locale>("en");
  const [forms, setForms] = useState(() =>
    buildForms(defaultSubject, defaultBody, initialOverrides, defaultCtaLabel),
  );
  const [initialForms, setInitialForms] = useState(() =>
    buildForms(defaultSubject, defaultBody, initialOverrides, defaultCtaLabel),
  );
  const [hasOverride, setHasOverride] = useState<Record<Locale, boolean>>({
    en: initialOverrides.en !== null && hasOverrideContent(initialOverrides.en),
    ar: initialOverrides.ar !== null && hasOverrideContent(initialOverrides.ar),
    ru: initialOverrides.ru !== null && hasOverrideContent(initialOverrides.ru),
  });
  const [fieldErrors, setFieldErrors] = useState<Record<Locale, FieldErrors>>({
    en: {},
    ar: {},
    ru: {},
  });
  const [isSaving, setIsSaving] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const [sendingEnabled, setSendingEnabled] = useState(initialSendingEnabled);
  const [isTogglingSending, setIsTogglingSending] = useState(false);
  const [pauseConfirmOpen, setPauseConfirmOpen] = useState(false);
  const [previewHeight, setPreviewHeight] = useState(560);
  const previewFrameRef = useRef<HTMLIFrameElement>(null);

  const isUnpausable = UNPAUSABLE_TEMPLATE_KEYS.has(templateKey);
  const samplePayload = buildSamplePayload(templateKey);
  const state = forms[activeLocale];
  const pristine = statesEqual(state, initialForms[activeLocale]);
  const errors = fieldErrors[activeLocale];

  function updateState(patch: Partial<LocaleFormState>) {
    setForms((f) => ({ ...f, [activeLocale]: { ...f[activeLocale], ...patch } }));
  }

  function updateParagraph(index: number, value: string) {
    const next = state.bodyParagraphs.slice();
    next[index] = value;
    updateState({ bodyParagraphs: next });
  }

  function addParagraph() {
    updateState({ bodyParagraphs: [...state.bodyParagraphs, ""] });
  }

  function removeParagraph(index: number) {
    updateState({
      bodyParagraphs: state.bodyParagraphs.filter((_, i) => i !== index),
    });
  }

  async function handleSave() {
    setIsSaving(true);
    setFieldErrors((fe) => ({ ...fe, [activeLocale]: {} }));

    const trimmedCtaLabel = state.ctaLabel.trim();

    const result = await upsertEmailTemplateOverrideAction({
      templateKey,
      locale: activeLocale,
      subject:
        state.subject.trim() && state.subject.trim() !== defaultSubject
          ? state.subject.trim()
          : undefined,
      preheaderText: state.preheaderText || undefined,
      bodyParagraphs: state.bodyParagraphs,
      ctaLabel:
        trimmedCtaLabel && trimmedCtaLabel !== defaultCtaLabel
          ? trimmedCtaLabel
          : undefined,
    });

    if (result.success) {
      toast.success("Template saved.");
      setInitialForms((f) => ({ ...f, [activeLocale]: state }));
      setHasOverride((h) => ({ ...h, [activeLocale]: true }));
      router.refresh();
    } else if (result.errorCode === "VALIDATION_ERROR" && result.fieldErrors) {
      const fe: FieldErrors = {};
      if (result.fieldErrors.subject) fe.subject = result.fieldErrors.subject[0];
      if (result.fieldErrors.preheaderText)
        fe.preheaderText = result.fieldErrors.preheaderText[0];
      if (result.fieldErrors.bodyParagraphs)
        fe.bodyParagraphs = result.fieldErrors.bodyParagraphs[0];
      if (result.fieldErrors.ctaLabel) fe.ctaLabel = result.fieldErrors.ctaLabel[0];
      setFieldErrors((prev) => ({ ...prev, [activeLocale]: fe }));
    } else {
      toast.error(result.error);
    }

    setIsSaving(false);
  }

  async function handleReset() {
    setIsResetting(true);
    const result = await resetEmailTemplateOverrideAction(
      templateKey,
      activeLocale,
    );

    if (result.success) {
      const defaultState = seedState(defaultSubject, defaultBody, null, defaultCtaLabel);
      setForms((f) => ({ ...f, [activeLocale]: defaultState }));
      setInitialForms((f) => ({ ...f, [activeLocale]: defaultState }));
      setHasOverride((h) => ({ ...h, [activeLocale]: false }));
      setFieldErrors((fe) => ({ ...fe, [activeLocale]: {} }));
      router.refresh();
    } else {
      toast.error(result.error);
    }

    setResetOpen(false);
    setIsResetting(false);
  }

  async function applySendingChange(enabled: boolean) {
    setIsTogglingSending(true);
    const result = await setEmailTemplateSendingAction({ templateKey, enabled });

    if (result.success) {
      setSendingEnabled(enabled);
      router.refresh();
    } else {
      toast.error(result.error);
    }

    setIsTogglingSending(false);
  }

  function handleSendingToggle() {
    if (sendingEnabled) {
      setPauseConfirmOpen(true);
    } else {
      void applySendingChange(true);
    }
  }

  async function handleConfirmPause() {
    await applySendingChange(false);
    setPauseConfirmOpen(false);
  }

  const previewBodyHtml = renderParagraphs(state.bodyParagraphs, samplePayload);
  const previewSubject = renderEmailSubject(state.subject, samplePayload);
  const previewHtml = renderEmailChrome(
    previewBodyHtml,
    {
      ...buildSampleBlocks(templateKey),
      storeName: storeProfile.storeName,
      contactEmail: storeProfile.contactEmail,
      contactPhone: storeProfile.contactPhone,
      addressLine: storeProfile.addressLine,
      preheaderText: state.preheaderText || undefined,
      ctaLabel: state.ctaLabel || defaultCtaLabel || undefined,
      ctaUrl: defaultCtaLabel ? "#" : undefined,
    },
    chromeContexts[activeLocale],
  );

  useEffect(() => {
    const iframe = previewFrameRef.current;
    if (!iframe) return;
    let observer: ResizeObserver | null = null;

    const attach = () => {
      const doc = iframe.contentDocument;
      const view = doc?.defaultView;
      if (!doc?.body || !view) return;
      observer?.disconnect();
      const body = doc.body;
      const measure = () => {
        let bottom = 0;
        for (const child of Array.from(body.children)) {
          bottom = Math.max(bottom, child.getBoundingClientRect().bottom);
        }
        const marginBottom =
          parseFloat(view.getComputedStyle(body).marginBottom) || 0;
        setPreviewHeight(Math.ceil(bottom + view.scrollY + marginBottom));
      };
      observer = new ResizeObserver(measure);
      for (const child of Array.from(body.children)) observer.observe(child);
      observer.observe(body);
    };

    if (iframe.contentDocument?.readyState === "complete") {
      attach();
    }
    iframe.addEventListener("load", attach);

    return () => {
      iframe.removeEventListener("load", attach);
      observer?.disconnect();
    };
  }, [previewHtml]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      <div style={cardStyle}>
        <div
          style={{
            padding: "1.25rem 1.5rem",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div>
            <p
              style={{
                ...labelTextStyle,
                fontWeight: "var(--font-bold)",
                margin: "0 0 0.25rem",
              }}
            >
              Send this email
            </p>
            <p
              style={{
                fontSize: "var(--text-body-sm)",
                color: "#6b6b6b",
                margin: 0,
              }}
            >
              {isUnpausable
                ? "Security email — sending cannot be paused."
                : sendingEnabled
                  ? "Sending in all languages."
                  : "Paused — this email is not sent in any language."}
            </p>
          </div>
          {!isUnpausable && (
            <EnabledSwitch
              enabled={sendingEnabled}
              disabled={false}
              pending={isTogglingSending}
              onToggle={handleSendingToggle}
            />
          )}
        </div>
      </div>

      <div style={cardStyle}>
        <div
          style={{
            display: "flex",
            borderBottom: "1px solid var(--color-shop-divider)",
          }}
        >
          {LOCALES.map((locale) => (
            <button
              key={locale}
              type="button"
              onClick={() => setActiveLocale(locale)}
              style={{
                flex: 1,
                padding: "0.875rem 1rem",
                fontSize: "var(--text-body-sm)",
                fontWeight:
                  activeLocale === locale
                    ? "var(--font-bold)"
                    : "var(--font-medium)",
                letterSpacing: "var(--tracking-wide)",
                textTransform: "uppercase",
                color: activeLocale === locale ? "#0b0b0b" : "#6b6b6b",
                backgroundColor:
                  activeLocale === locale ? "#f5f5f5" : "transparent",
                border: "none",
                borderBottom:
                  activeLocale === locale
                    ? "2px solid var(--color-action-primary)"
                    : "2px solid transparent",
                cursor: "pointer",
              }}
            >
              {LOCALE_LABELS[locale]}
              {hasOverride[locale] ? " •" : ""}
            </button>
          ))}
        </div>

        <div style={{ padding: "1.5rem" }}>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "0.875rem",
            }}
          >
            <Input
              id="template-subject"
              label="Subject"
              type="text"
              value={state.subject}
              onChange={(e) => updateState({ subject: e.target.value })}
              disabled={isSaving}
              error={errors.subject}
            />

            <Input
              id="template-preheader"
              label="Preheader"
              type="text"
              value={state.preheaderText}
              onChange={(e) => updateState({ preheaderText: e.target.value })}
              disabled={isSaving}
              error={errors.preheaderText}
              optional="(optional)"
            />

            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "0.5rem",
              }}
            >
              <span style={labelTextStyle}>Body paragraphs</span>
              {state.bodyParagraphs.map((paragraph, index) => (
                <div
                  key={index}
                  style={{
                    display: "flex",
                    gap: "0.5rem",
                    alignItems: "flex-start",
                  }}
                >
                  <textarea
                    value={paragraph}
                    onChange={(e) => updateParagraph(index, e.target.value)}
                    disabled={isSaving}
                    rows={3}
                    style={{
                      flex: 1,
                      padding: "0.625rem 0.875rem",
                      fontSize: "var(--text-body)",
                      color: "var(--color-auth-input-text)",
                      backgroundColor: "var(--color-auth-input-bg)",
                      border: "1.5px solid var(--color-auth-input-border)",
                      borderRadius: "var(--radius-none)",
                      outline: "none",
                      resize: "vertical",
                      boxSizing: "border-box",
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => removeParagraph(index)}
                    disabled={isSaving || state.bodyParagraphs.length <= 1}
                    style={{
                      ...btnBase,
                      ...destructiveOutline,
                      height: "2.25rem",
                      paddingInline: "0.75rem",
                      fontSize: "var(--text-label)",
                      cursor:
                        isSaving || state.bodyParagraphs.length <= 1
                          ? "not-allowed"
                          : "pointer",
                      opacity:
                        isSaving || state.bodyParagraphs.length <= 1 ? 0.4 : 1,
                    }}
                  >
                    Remove
                  </button>
                </div>
              ))}
              {errors.bodyParagraphs && (
                <p
                  role="alert"
                  style={{
                    fontSize: "var(--text-body-sm)",
                    color: "var(--color-auth-error-text)",
                    margin: 0,
                  }}
                >
                  {errors.bodyParagraphs}
                </p>
              )}
              <button
                type="button"
                onClick={addParagraph}
                disabled={isSaving}
                style={{
                  ...btnBase,
                  backgroundColor: "#0b0b0b",
                  color: "#ffffff",
                  alignSelf: "flex-start",
                  height: "2.25rem",
                  paddingInline: "1rem",
                  fontSize: "var(--text-label)",
                  cursor: isSaving ? "not-allowed" : "pointer",
                  opacity: isSaving ? 0.6 : 1,
                }}
              >
                Add paragraph
              </button>
            </div>

            {defaultCtaLabel && (
              <Input
                id="template-cta-label"
                label="CTA label"
                type="text"
                value={state.ctaLabel}
                onChange={(e) => updateState({ ctaLabel: e.target.value })}
                disabled={isSaving}
                error={errors.ctaLabel}
                optional="(optional)"
              />
            )}
          </div>
        </div>

        <div
          style={{
            borderTop: "1px solid var(--color-shop-divider)",
            padding: "1rem 1.5rem",
            display: "flex",
            justifyContent: "space-between",
          }}
        >
          <button
            type="button"
            onClick={() => setResetOpen(true)}
            disabled={isResetting}
            style={{
              ...btnBase,
              ...destructiveOutline,
              cursor: isResetting ? "not-allowed" : "pointer",
              opacity: isResetting ? 0.6 : 1,
            }}
          >
            Reset to default
          </button>

          <button
            type="button"
            onClick={() => {
              void handleSave();
            }}
            disabled={isSaving || pristine}
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              height: "2.5rem",
              paddingInline: "1.25rem",
              fontSize: "var(--text-body-sm)",
              fontWeight: "var(--font-bold)",
              letterSpacing: "var(--tracking-widest)",
              textTransform: "uppercase",
              backgroundColor: "#0b0b0b",
              color: "#ffffff",
              border: "none",
              borderRadius: "0",
              cursor: isSaving || pristine ? "not-allowed" : "pointer",
              opacity: isSaving || pristine ? 0.6 : 1,
            }}
          >
            {isSaving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>

      <div style={cardStyle}>
        <div
          style={{
            padding: "1rem 1.25rem",
            borderBottom: "1px solid var(--color-shop-divider)",
          }}
        >
          <p style={{ ...labelTextStyle, marginBottom: "0.125rem" }}>Preview</p>
          <p style={{ fontSize: "var(--text-body-sm)", color: "#6b6b6b" }}>
            {previewSubject}
          </p>
        </div>
        <iframe
          title="Email preview"
          ref={previewFrameRef}
          srcDoc={previewHtml}
          sandbox="allow-same-origin"
          scrolling="no"
          style={{
            width: "100%",
            height: `${previewHeight}px`,
            border: "none",
            display: "block",
          }}
        />
      </div>

      <ConfirmDialog
        open={resetOpen}
        onClose={() => setResetOpen(false)}
        onConfirm={() => {
          void handleReset();
        }}
        title="Reset to default"
        message={`This removes the ${LOCALE_LABELS[activeLocale]} override for this template and restores the code default.`}
        confirmLabel="Reset"
        cancelLabel="Cancel"
        isPending={isResetting}
        destructive={true}
      />

      <ConfirmDialog
        open={pauseConfirmOpen}
        onClose={() => setPauseConfirmOpen(false)}
        onConfirm={() => {
          void handleConfirmPause();
        }}
        title="Pause this email?"
        message="Customers and staff will stop receiving it until you turn it back on."
        confirmLabel="Pause"
        cancelLabel="Cancel"
        isPending={isTogglingSending}
        destructive
      />
    </div>
  );
}

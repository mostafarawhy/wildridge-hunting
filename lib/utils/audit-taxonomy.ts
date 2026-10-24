import { DECISION_VERBS } from "@/lib/utils/audit-reason";

// ─── Category ───────────────────────────────────────────────────────────────

export type AuditCategory =
  | "COMMERCE"
  | "CATALOG"
  | "COMPLIANCE"
  | "GOVERNANCE"
  | "OTHER";

export const AUDIT_CATEGORY_LABEL: Record<AuditCategory, string> = {
  COMMERCE: "Commerce",
  CATALOG: "Catalog",
  COMPLIANCE: "Compliance",
  GOVERNANCE: "Governance",
  OTHER: "Other",
};

export const AUDIT_CATEGORY_ORDER: AuditCategory[] = [
  "COMMERCE",
  "CATALOG",
  "COMPLIANCE",
  "GOVERNANCE",
  "OTHER",
];

const ENTITY_CATEGORY: Record<string, AuditCategory> = {
  Coupon: "COMMERCE",
  CouponRewardRule: "COMMERCE",
  ShippingMethod: "COMMERCE",
  ShippingRate: "COMMERCE",
  ShippingZone: "COMMERCE",
  Order: "COMMERCE",
  QuoteRequest: "COMMERCE",
  NewsletterSubscriber: "COMMERCE",
  LoyaltyTransaction: "COMMERCE",
  Product: "CATALOG",
  ProductImage: "CATALOG",
  Category: "CATALOG",
  Brand: "CATALOG",
  Addon: "CATALOG",
  AddonProductLink: "CATALOG",
  ImportBatch: "CATALOG",
  B2BAccount: "COMPLIANCE",
  Customer: "COMPLIANCE",
  Staff: "GOVERNANCE",
  ProjectConfig: "GOVERNANCE",
  EmailTemplate: "GOVERNANCE",
  Page: "GOVERNANCE",
  Store: "GOVERNANCE",
  Banner: "GOVERNANCE",
  VerificationEvent: "COMPLIANCE",
};

export function auditCategory(entityType: string): AuditCategory {
  return ENTITY_CATEGORY[entityType] ?? "OTHER";
}

export const FILTERABLE_AUDIT_CATEGORIES: AuditCategory[] = [
  "COMMERCE",
  "CATALOG",
  "COMPLIANCE",
  "GOVERNANCE",
];

export function entityTypesForCategory(category: AuditCategory): string[] {
  return Object.keys(ENTITY_CATEGORY).filter(
    (k) => ENTITY_CATEGORY[k] === category,
  );
}

// ─── Entity labels ──────────────────────────────────────────────────────────

const ENTITY_LABEL: Record<string, string> = {
  B2BAccount: "B2B Account",
  ProductImage: "Product Image",
  ProjectConfig: "Settings",
  ShippingMethod: "Shipping Method",
  ShippingRate: "Shipping Rate",
  ShippingZone: "Shipping Zone",
  AddonProductLink: "Add-on Link",
  ImportBatch: "Import",
  Addon: "Add-on",
  Banner: "Homepage popup",
  Brand: "Brand",
  Category: "Category",
  Coupon: "Coupon",
  CouponRewardRule: "Reward Rule",
  Product: "Product",
  Staff: "Staff",
  Customer: "Customer",
  Order: "Order",
  QuoteRequest: "Quote",
  NewsletterSubscriber: "Subscriber",
  LoyaltyTransaction: "Loyalty points",
  VerificationEvent: "ID Verification",
};

export function auditEntityLabel(entityType: string): string {
  return ENTITY_LABEL[entityType] ?? entityType;
}

export const DOCUMENT_ACCESS_ACTIONS = [
  "b2b.document_accessed",
  "verification.document_accessed",
];

// ─── Action labels ──────────────────────────────────────────────────────────

const ACTION_LABEL: Record<string, string> = {
  "addon_image.delete": "Add-on image deleted",
  "addon_image.upload": "Add-on image uploaded",
  "addon_link.create": "Add-on link created",
  "addon_link.delete": "Add-on link deleted",
  "addon_link.reorder": "Add-on links reordered",
  "addon.active": "Add-on visibility changed",
  "addon.create": "Add-on created",
  "addon.delete": "Add-on deleted",
  "addon.stock_adjust": "Add-on stock adjusted",
  "addon.update": "Add-on updated",
  "b2b.approve": "B2B account approved",
  "b2b.details_requested": "Business details update requested",
  "b2b.details_updated": "Business details updated",
  "b2b.document_accessed": "Document accessed",
  "b2b.documents_provided": "Additional documents provided",
  "b2b.documents_requested": "Additional documents requested",
  "b2b.expire": "B2B account expired",
  "b2b.note": "Internal note",
  "b2b.override_approve": "B2B account approved by override",
  "b2b.reject": "B2B account rejected",
  "b2b.registration_submitted": "B2B registration submitted",
  "b2b.renewal_requested": "B2B renewal requested",
  "b2b.request_cancelled": "Document request cancelled",
  "b2b.suspend": "B2B account suspended",
  "banner.update": "Homepage popup updated",
  "brand.create": "Brand created",
  "brand.delete": "Brand deleted",
  "brand.update": "Brand updated",
  "brand.visibility": "Brand visibility changed",
  "catalog.import": "Catalog imported",
  "catalog.import_failed": "Catalog import refused",
  "catalog.import_file_downloaded": "Import file downloaded",
  "category.create": "Category created",
  "category.delete": "Category deleted",
  "category.update": "Category updated",
  "category.visibility": "Category visibility changed",
  "coupon.create": "Coupon created",
  "coupon.delete": "Coupon deleted",
  "coupon.issue": "Reward coupon issued",
  "coupon.note": "Internal note",
  "coupon.rotate": "Coupon rotated in",
  "coupon.rotate_out": "Coupon rotated out",
  "coupon.toggle": "Coupon toggled",
  "coupon.update": "Coupon updated",
  "customer.note.update": "Customer note updated",
  "customer.reactivate": "Customer reactivated",
  "customer.suspend": "Customer suspended",
  "customer.uae_pass_link": "UAE PASS linked",
  "loyalty.adjusted": "Loyalty points adjusted",
  "loyalty.exported": "Loyalty activity exported",
  "order.compliance_archived": "Compliance documents archived",
  "order.compliance_document_accessed": "Compliance document accessed",
  "order.contacted": "Customer contacted",
  "order.delivery_details_recorded": "Delivery details recorded",
  "order.delivery_proof_accessed": "Delivery proof accessed",
  "order.exported": "Orders exported",
  "order.marked_paid": "Payment recorded",
  "order.payment_checked": "Card payment checked",
  "order.payment_proof_accessed": "Payment proof accessed",
  "order.quote_approved": "Quote approved by customer",
  "order.quote_declined": "Quote declined by customer",
  "order.quote_revision_requested": "Quote revision requested",
  "order.refund_due_added": "Refund owed added",
  "order.refund_proof_accessed": "Refund proof accessed",
  "order.refund_recorded": "Refund recorded",
  "order.serials_recorded": "Serials recorded",
  "order.shipping_quote": "Shipping quote issued",
  "order.status_changed": "Order status changed",
  "product_accessory.create": "Accessory linked",
  "product_accessory.delete": "Accessory removed",
  "product_accessory.reorder": "Accessories reordered",
  "product_image.create": "Product image added",
  "product_image.delete": "Product image deleted",
  "product_image.reorder": "Product images reordered",
  "product_image.update_alt_text": "Image alt text updated",
  "product.create": "Product created",
  "product.delete": "Product deleted",
  "product.status": "Product status changed",
  "product.stock_adjust": "Stock adjusted",
  "product.update": "Product updated",
  "quote.approve": "Quote accepted by customer",
  "quote.closed": "Quote closed",
  "quote.contacted": "Customer contacted",
  "quote.exported": "Quotes exported",
  "quote.quoted": "Quote priced and sent",
  "quote.reject": "Quote cancelled",
  "reward_rule.create": "Reward rule created",
  "reward_rule.toggle": "Reward rule toggled",
  "reward_rule.update": "Reward rule updated",
  "settings.about_page.update": "About page published",
  "settings.b2b_content.update": "B2B content published",
  "settings.delivery_config.update": "Delivery settings updated",
  "settings.email_identity.update": "Email identity updated",
  "settings.email_recipients.update": "Email recipients updated",
  "settings.email_template.reset": "Email template reset to default",
  "settings.email_template.toggle": "Email template sending changed",
  "settings.email_template.update": "Email template edited",
  "settings.home_page.update": "Homepage edited",
  "settings.legal_details.update": "Legal and tax details updated",
  "settings.loyalty_program.update": "Loyalty program updated",
  "settings.page.publish": "Store page published or unpublished",
  "settings.page.update": "Store page edited",
  "settings.quote_legal_terms.update": "Quote terms & conditions published",
  "settings.quote_rules.update": "Quote rules published",
  "settings.site_banners.update": "Site banners edited",
  "settings.store_profile.update": "Store profile updated",
  "settings.tax_config.update": "Tax config updated",
  "settings.verification_content.update": "Verification content published",
  "shipping_method.create": "Shipping method created",
  "shipping_method.delete": "Shipping method deleted",
  "shipping_method.toggle": "Shipping method toggled",
  "shipping_method.update": "Shipping method updated",
  "shipping_rate.create": "Shipping rate created",
  "shipping_rate.delete": "Shipping rate deleted",
  "shipping_rate.toggle": "Shipping rate toggled",
  "shipping_rate.update": "Shipping rate updated",
  "shipping_zone.country.add": "Country added to zone",
  "shipping_zone.country.remove": "Country removed from zone",
  "shipping_zone.create": "Shipping zone created",
  "shipping_zone.delete": "Shipping zone deleted",
  "shipping_zone.update": "Shipping zone updated",
  "staff.activate": "Staff activated",
  "staff.create": "Staff created",
  "staff.deactivate": "Staff deactivated",
  "staff.password_reset": "Staff password reset",
  "staff.password_set": "Staff password set",
  "staff.role_change": "Staff role changed",
  "staff.sessions_revoked": "Staff signed out everywhere",
  "store.create": "Store created",
  "store.delete": "Store deleted",
  "store.update": "Store updated",
  "subscriber.exported": "Subscribers exported",
  "subscriber.klaviyo_sent": "Subscribers sent to Klaviyo",
  "subscriber.unsubscribed": "Subscriber unsubscribed",
  "ticket.assigned": "Ticket assigned",
  "ticket.created": "Ticket created",
  "ticket.status_changed": "Ticket status changed",
  "ticket.updated": "Ticket updated",
  "verification.approve": "ID verification approved",
  "verification.details_requested": "Declared details update requested",
  "verification.details_updated": "Declared details updated",
  "verification.document_accessed": "Document accessed",
  "verification.documents_provided": "Additional documents provided",
  "verification.documents_requested": "Additional documents requested",
  "verification.expire": "ID verification expired",
  "verification.note": "Internal note",
  "verification.override_approve": "ID verification approved by override",
  "verification.reject": "ID verification rejected",
  "verification.request_cancelled": "Document request cancelled",
  "verification.submit": "ID verification submitted",
};

export function auditActionLabel(action: string): string {
  const mapped = ACTION_LABEL[action];
  if (mapped) return mapped;
  const words = action.split(/[._]/).filter(Boolean);
  const joined = words.join(" ");
  return joined.charAt(0).toUpperCase() + joined.slice(1);
}

// ─── Deep-link resolver ─────────────────────────────────────────────────────

export function auditEntityHref(
  entityType: string,
  entityId: string | null,
): string | null {
  if (entityId == null) return null;

  switch (entityType) {
    case "Product":
      return `/admin/products/${entityId}`;
    case "ShippingZone":
      return `/admin/shipping/${entityId}`;
    case "Customer":
      return `/admin/customers/${entityId}`;
    case "B2BAccount":
      return `/admin/b2b/${entityId}`;
    case "Coupon":
      return `/admin/coupons/${entityId}`;
    case "CouponRewardRule":
      return `/admin/coupons/rewards/${entityId}`;
    case "Addon":
      return null;
    case "Order":
      return `/admin/orders/${entityId}`;
    case "QuoteRequest":
      return `/admin/quotes/${entityId}`;
    case "VerificationEvent":
      return `/admin/verification/${entityId}`;
    case "Ticket":
      return `/admin/tickets/${entityId}`;
    case "Store":
      return `/admin/stores/${entityId}`;
    case "Banner":
      return "/admin/popup";
    case "ImportBatch":
      return `/admin/import/${entityId}`;
    default:
      return null;
  }
}

// ─── Event visuals ──────────────────────────────────────────────────────────

export interface EventVisual {
  pillColor: string;
  pillBg: string;
  rail: string;
  wash: string | null;
}

const APPROVAL_VERBS = new Set(["approve", "override_approve"]);

const APPROVAL_VISUAL: EventVisual = {
  pillColor: "#166534",
  pillBg: "#dcfce7",
  rail: "#166534",
  wash: null,
};

const ADVERSE_VISUAL: EventVisual = {
  pillColor: "#991b1b",
  pillBg: "#fee2e2",
  rail: "#991b1b",
  wash: null,
};

const NOTE_VISUAL: EventVisual = {
  pillColor: "#92400e",
  pillBg: "#fef3c7",
  rail: "#fde68a",
  wash: "#fffbeb",
};

const ACTIVITY_VISUAL: EventVisual = {
  pillColor: "#1e40af",
  pillBg: "#dbeafe",
  rail: "var(--color-shop-divider)",
  wash: null,
};

export function eventVisual(action: string): EventVisual {
  const verb = action.slice(action.lastIndexOf(".") + 1);
  if (verb === "note") return NOTE_VISUAL;
  if (APPROVAL_VERBS.has(verb)) return APPROVAL_VISUAL;
  if (DECISION_VERBS.has(verb)) return ADVERSE_VISUAL;
  return ACTIVITY_VISUAL;
}

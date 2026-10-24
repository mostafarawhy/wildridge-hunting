export const PAGE_KEYS = [
  "terms",
  "privacy",
  "returns",
  "shipping",
  "faq",
  "contact",
  "about",
  "stores",
] as const;

export type PageKey = (typeof PAGE_KEYS)[number];

export function isPageKey(v: string): v is PageKey {
  return (PAGE_KEYS as readonly string[]).includes(v);
}

export type PageKind = "policy" | "faq" | "contact" | "editorial" | "locator";
export type PageGroup = "legal" | "care" | "help" | "company";

export const PAGE_CONFIG: Record<
  PageKey,
  {
    kind: PageKind;
    group: PageGroup;
    numbered: boolean;
    adminLabel: string;
    footerLeaf: string;
  }
> = {
  terms: {
    kind: "policy",
    group: "legal",
    numbered: true,
    adminLabel: "Terms of Service",
    footerLeaf: "link_terms",
  },
  privacy: {
    kind: "policy",
    group: "legal",
    numbered: true,
    adminLabel: "Privacy Policy",
    footerLeaf: "link_privacy",
  },
  returns: {
    kind: "policy",
    group: "care",
    numbered: false,
    adminLabel: "Returns & Exchanges",
    footerLeaf: "link_returns",
  },
  shipping: {
    kind: "policy",
    group: "care",
    numbered: false,
    adminLabel: "Shipping & Delivery",
    footerLeaf: "link_shipping",
  },
  faq: {
    kind: "faq",
    group: "help",
    numbered: false,
    adminLabel: "FAQ",
    footerLeaf: "link_faq",
  },
  contact: {
    kind: "contact",
    group: "care",
    numbered: false,
    adminLabel: "Contact",
    footerLeaf: "link_contact",
  },
  about: {
    kind: "editorial",
    group: "company",
    numbered: false,
    adminLabel: "About Us",
    footerLeaf: "link_about",
  },
  stores: {
    kind: "locator",
    group: "care",
    numbered: false,
    adminLabel: "Our Stores",
    footerLeaf: "link_stores",
  },
};

export const RELATED_KEYS: PageKey[] = [
  "terms",
  "privacy",
  "returns",
  "shipping",
  "faq",
];

export const PAGE_LOCALES = ["en", "ar", "ru"] as const;

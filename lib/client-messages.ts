import type { AbstractIntlMessages } from "next-intl";

export const SHELL_MESSAGE_PATHS = [
  "nav",
  "home",
  "common",
  "cart",
  "shop",
  "quote",
  "auth",
  "demo",
  "newsletter",
  "errorPage",
  "account.nav",
  "account.addresses",
  "checkout.billing",
] as const;

export const ACCOUNT_MESSAGE_PATHS = [
  "account",
  "checkout.success",
  "checkout.verification",
  "checkout.verify",
] as const;

export const CHECKOUT_MESSAGE_PATHS = ["checkout", "account.orders.payment"] as const;

export const RECEIPT_MESSAGE_PATHS = ["checkout.receipt"] as const;

function isTree(value: unknown): value is AbstractIntlMessages {
  return typeof value === "object" && value !== null;
}

export function pickMessages(
  all: AbstractIntlMessages,
  paths: readonly string[],
): AbstractIntlMessages {
  const out: AbstractIntlMessages = {};
  for (const path of paths) {
    const keys = path.split(".");
    let source: AbstractIntlMessages | string | undefined = all;
    for (const key of keys) {
      source = isTree(source) ? source[key] : undefined;
    }
    if (source === undefined) continue;
    let target = out;
    for (const key of keys.slice(0, -1)) {
      if (!isTree(target[key])) target[key] = {};
      target = target[key] as AbstractIntlMessages;
    }
    target[keys[keys.length - 1]] = source;
  }
  return out;
}

export function mergeMessages(
  base: AbstractIntlMessages,
  extra: AbstractIntlMessages,
): AbstractIntlMessages {
  const out: AbstractIntlMessages = { ...base };
  for (const [key, value] of Object.entries(extra)) {
    const current = out[key];
    out[key] = isTree(current) && isTree(value) ? mergeMessages(current, value) : value;
  }
  return out;
}

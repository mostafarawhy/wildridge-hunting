import { safeRelativePath, stripLocalePrefix } from "@/lib/utils/safe-redirect";

export function signInLandingPath(
  locale: string,
  callbackUrl?: string | null,
): string {
  const current = new URL(window.location.href);
  const requested = callbackUrl ?? current.searchParams.get("callbackUrl");
  const safe = requested ? safeRelativePath(requested) : null;
  const target = safe ? stripLocalePrefix(safe) : null;
  if (target && !target.startsWith("/auth/")) return `/${locale}${target}`;
  if (stripLocalePrefix(current.pathname).startsWith("/auth/")) {
    return `/${locale}/account`;
  }
  current.searchParams.delete("auth");
  current.searchParams.delete("callbackUrl");
  return `${current.pathname}${current.search}${current.hash}`;
}

import "server-only";

import { clientEnv } from "@/lib/env.client";

const APP_BASE_URL = clientEnv.NEXT_PUBLIC_APP_URL ?? "";

export function adminUrl(path: string): string {
  return APP_BASE_URL ? `${APP_BASE_URL}/admin${path}` : "";
}

export function accountUrl(path: string): string {
  return APP_BASE_URL ? `${APP_BASE_URL}/en/account${path}` : "";
}

export function localeUrl(locale: string, path: string): string {
  return APP_BASE_URL ? `${APP_BASE_URL}/${locale}${path}` : "";
}

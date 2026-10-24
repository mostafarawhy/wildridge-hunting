import { cookies } from "next/headers";

export const UAE_PASS_STATE_COOKIE = "uae_pass_state";

const STATE_TTL_SECONDS = 600;

export type UaePassFlow = "login" | "verification" | "link";

export interface UaePassStatePayload {
  state: string;
  locale: "en" | "ar" | "ru";
  flow: UaePassFlow;
  callbackUrl: string;
}

export async function setUaePassState(
  payload: UaePassStatePayload,
): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(UAE_PASS_STATE_COOKIE, JSON.stringify(payload), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: STATE_TTL_SECONDS,
  });
}

export async function readUaePassState(): Promise<UaePassStatePayload | null> {
  const cookieStore = await cookies();
  const raw = cookieStore.get(UAE_PASS_STATE_COOKIE)?.value;
  if (!raw) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }

  if (typeof parsed !== "object" || parsed === null) return null;
  const candidate = parsed as Record<string, unknown>;

  if (typeof candidate.state !== "string" || candidate.state.length === 0) {
    return null;
  }
  if (
    candidate.locale !== "en" &&
    candidate.locale !== "ar" &&
    candidate.locale !== "ru"
  ) {
    return null;
  }
  if (
    candidate.flow !== "login" &&
    candidate.flow !== "verification" &&
    candidate.flow !== "link"
  ) {
    return null;
  }
  if (typeof candidate.callbackUrl !== "string") return null;

  return {
    state: candidate.state,
    locale: candidate.locale,
    flow: candidate.flow,
    callbackUrl: candidate.callbackUrl,
  };
}

export async function clearUaePassState(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(UAE_PASS_STATE_COOKIE);
}

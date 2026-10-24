import NextAuth from "next-auth";
import { authConfig } from "@/auth.config";
import createIntlMiddleware from "next-intl/middleware";
import { routing } from "@/lib/i18n";
import { NextResponse, type NextRequest } from "next/server";

const { auth } = NextAuth(authConfig);
const intlMiddleware = createIntlMiddleware(routing);

const authedIntl = auth((req: NextRequest) => intlMiddleware(req));

const GATE_EXEMPT_PATHS = ["/api/identity/uae-pass/callback"];

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

function challenge(): NextResponse {
  return new NextResponse("Authentication required.", {
    status: 401,
    headers: {
      "WWW-Authenticate": 'Basic realm="Staging", charset="UTF-8"',
      "X-Robots-Tag": "noindex, nofollow",
      "Cache-Control": "no-store",
    },
  });
}

function stagingGate(req: NextRequest): NextResponse | null {
  if (process.env.STAGING_GATE_ENABLED !== "true") return null;

  if (GATE_EXEMPT_PATHS.some((p) => req.nextUrl.pathname.startsWith(p))) {
    return null;
  }

  const user = process.env.STAGING_USER;
  const pass = process.env.STAGING_PASS;
  if (!user || !pass) return challenge();

  const header = req.headers.get("authorization") ?? "";
  if (!header.startsWith("Basic ")) return challenge();

  let decoded: string;
  try {
    decoded = atob(header.slice(6));
  } catch {
    return challenge();
  }

  const sep = decoded.indexOf(":");
  if (sep === -1) return challenge();

  const okUser = safeEqual(decoded.slice(0, sep), user);
  const okPass = safeEqual(decoded.slice(sep + 1), pass);
  if (!okUser || !okPass) return challenge();

  return null;
}

export default function middleware(
  req: NextRequest,
  ctx: unknown,
): ReturnType<typeof authedIntl> | NextResponse {
  const denied = stagingGate(req);
  if (denied) return denied;

  const { pathname } = req.nextUrl;
  if (pathname.startsWith("/api") || pathname.startsWith("/admin")) {
    return NextResponse.next();
  }

  return authedIntl(req as never, ctx as never);
}

export const config = {
  matcher: ["/((?!_next|_vercel|.*\\..*).*)"],
};

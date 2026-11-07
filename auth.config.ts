import { type NextAuthConfig } from "next-auth";

const PROTECTED_PREFIXES = ["/account", "/checkout", "/b2b/quotes"];

/**
 * Shared, Edge-safe auth config.
 * No providers, no DB access, no bcrypt — those live in auth.ts (Node-only).
 * This file is imported by both auth.ts (full instance) and middleware.ts.
 */
export const authConfig = {
  secret: process.env.AUTH_SECRET,
  trustHost: true,
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60,
    updateAge: 24 * 60 * 60,
  },
  pages: {
    signIn: "/auth/login",
    error: "/auth/login",
  },
  callbacks: {
    session({ session, token }) {
      if (session.user) {
        session.user.principal = token.principal as "customer" | "staff";
      }
      return session;
    },
    authorized({ auth, request }) {
      const { pathname } = request.nextUrl;
      const withoutLocale = pathname.replace(/^\/(?:en|ar|ru)/, "") || "/";

      const isProtected = PROTECTED_PREFIXES.some((prefix) =>
        withoutLocale.startsWith(prefix),
      );
      const isAuthed = auth?.user?.principal === "customer";

      if (isProtected && !isAuthed) {
        const loginUrl = new URL(
          `/${request.nextUrl.pathname.split("/")[1]}/auth/login`,
          request.nextUrl.origin,
        );
        loginUrl.searchParams.set("callbackUrl", pathname);
        return Response.redirect(loginUrl);
      }

      return true;
    },
  },
  providers: [],
} satisfies NextAuthConfig;

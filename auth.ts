import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import type { JWT } from "next-auth/jwt";
import type { Session, User } from "next-auth";
import { db } from "@/lib/db/client";
import { authConfig } from "@/auth.config";
import { loginSchema } from "@/lib/validations/auth";
import { redeemUaePassTicket } from "@/lib/services/identity/uae-pass-ticket";
import { EmailNotVerifiedSignin } from "@/lib/services/identity/signin-errors";

const DUMMY_HASH =
  "$2b$12$irrelevant.hash.used.only.to.prevent.timing.attacks.padding";

const nodeAuth = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      id: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const parsed = loginSchema.safeParse(credentials);
        if (!parsed.success) return null;

        const { email, password } = parsed.data;
        const normalizedEmail = email.toLowerCase();

        let customer: {
          id: string;
          email: string;
          name: string;
          passwordHash: string | null;
          isActive: boolean;
          role: "B2C" | "B2B";
          verificationStatus:
            | "NOT_REQUIRED"
            | "PENDING"
            | "APPROVED"
            | "REJECTED"
            | "EXPIRED";
          tokenVersion: number;
          emailVerifiedAt: Date | null;
        } | null = null;

        try {
          customer = await db.customer.findUnique({
            where: { email: normalizedEmail },
            select: {
              id: true,
              email: true,
              name: true,
              passwordHash: true,
              isActive: true,
              role: true,
              verificationStatus: true,
              tokenVersion: true,
              emailVerifiedAt: true,
            },
          });
        } catch (err) {
          console.error("[auth] DB error during customer login lookup:", err);
          return null;
        }

        const hashToCompare = customer?.passwordHash ?? DUMMY_HASH;
        const passwordMatch = await bcrypt.compare(password, hashToCompare);

        if (
          !customer ||
          !customer.isActive ||
          !customer.passwordHash ||
          !passwordMatch
        ) {
          return null;
        }

        if (!customer.emailVerifiedAt) {
          throw new EmailNotVerifiedSignin();
        }

        return {
          id: customer.id,
          email: customer.email,
          name: customer.name,
          principal: "customer" as const,
          role: customer.role,
          verificationStatus: customer.verificationStatus,
          tokenVersion: customer.tokenVersion,
        };
      },
    }),
    Credentials({
      id: "staff-credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const parsed = loginSchema.safeParse(credentials);
        if (!parsed.success) return null;

        const { email, password } = parsed.data;
        const normalizedEmail = email.toLowerCase();

        let staff: {
          id: string;
          email: string;
          name: string;
          passwordHash: string | null;
          isActive: boolean;
          role: import("@/app/generated/prisma/client").StaffRole;
          tokenVersion: number;
        } | null = null;

        try {
          staff = await db.staff.findUnique({
            where: { email: normalizedEmail },
            select: {
              id: true,
              email: true,
              name: true,
              passwordHash: true,
              isActive: true,
              role: true,
              tokenVersion: true,
            },
          });
        } catch (err) {
          console.error("[auth] DB error during staff login lookup:", err);
          return null;
        }

        const hashToCompare = staff?.passwordHash ?? DUMMY_HASH;
        const passwordMatch = await bcrypt.compare(password, hashToCompare);

        if (
          !staff ||
          !staff.isActive ||
          !staff.passwordHash ||
          !passwordMatch
        ) {
          return null;
        }

        return {
          id: staff.id,
          email: staff.email,
          name: staff.name,
          principal: "staff" as const,
          staffRole: staff.role,
          tokenVersion: staff.tokenVersion,
        };
      },
    }),
    Credentials({
      id: "uae-pass",
      credentials: {
        ticket: { label: "Ticket", type: "text" },
      },
      async authorize(credentials) {
        const ticket = credentials?.ticket;
        if (typeof ticket !== "string" || ticket.length === 0) return null;

        let customerId: string | null = null;
        try {
          customerId = await redeemUaePassTicket(ticket);
        } catch (err) {
          console.error("[auth] UAE PASS ticket redemption failed:", err);
          return null;
        }

        if (!customerId) return null;

        let customer: {
          id: string;
          email: string;
          name: string;
          isActive: boolean;
          role: "B2C" | "B2B";
          verificationStatus:
            | "NOT_REQUIRED"
            | "PENDING"
            | "APPROVED"
            | "REJECTED"
            | "EXPIRED";
          tokenVersion: number;
        } | null = null;

        try {
          customer = await db.customer.findUnique({
            where: { id: customerId },
            select: {
              id: true,
              email: true,
              name: true,
              isActive: true,
              role: true,
              verificationStatus: true,
              tokenVersion: true,
            },
          });
        } catch (err) {
          console.error("[auth] DB error during UAE PASS customer lookup:", err);
          return null;
        }

        if (!customer || !customer.isActive) return null;

        return {
          id: customer.id,
          email: customer.email,
          name: customer.name,
          principal: "customer" as const,
          role: customer.role,
          verificationStatus: customer.verificationStatus,
          tokenVersion: customer.tokenVersion,
          uaePassSession: true,
        };
      },
    }),
  ],
  callbacks: {
    ...authConfig.callbacks,
    async jwt({ token, user }: { token: JWT; user: User | undefined }) {
      if (user && user.id) {
        token.sub = user.id;
        token.principal = user.principal;

        if (user.principal === "customer") {
          token.role = user.role;
          token.verificationStatus = user.verificationStatus;
          token.tokenVersion = user.tokenVersion;
          delete token.staffRole;

          if (user.uaePassSession) {
            token.uaePassSession = true;
          } else {
            delete token.uaePassSession;
          }

          db.customer
            .update({
              where: { id: user.id },
              data: { lastLoginAt: new Date() },
            })
            .catch((err) =>
              console.error("[auth] customer lastLoginAt update failed:", err),
            );
        } else {
          token.staffRole = user.staffRole;
          token.name = user.name;
          token.email = user.email;
          delete token.role;
          delete token.verificationStatus;
          token.tokenVersion = user.tokenVersion;
          delete token.uaePassSession;

          const staffId = user.id;
          db.staff
            .findUnique({ where: { id: staffId }, select: { lastLoginAt: true } })
            .then((row) =>
              db.staff.update({
                where: { id: staffId },
                data: { previousLoginAt: row?.lastLoginAt ?? null, lastLoginAt: new Date() },
              }),
            )
            .catch((err) =>
              console.error("[auth] staff lastLoginAt update failed:", err),
            );
        }

        return token;
      }

      if (!token.principal) {
        token.principal = "customer";
      }

      if (token.principal === "customer") {
        if (token.sub) {
          try {
            const current = await db.customer.findUnique({
              where: { id: token.sub },
              select: { tokenVersion: true },
            });
            if (!current || current.tokenVersion !== token.tokenVersion) {
              return null;
            }
          } catch (err) {
            console.error("[auth] tokenVersion check failed:", err);
            return token;
          }
        }
      } else {
        if (token.sub) {
          try {
            const current = await db.staff.findUnique({
              where: { id: token.sub },
              select: { isActive: true, role: true, tokenVersion: true },
            });
            if (!current || !current.isActive || current.tokenVersion !== token.tokenVersion) {
              return null;
            }
            token.staffRole = current.role;
          } catch (err) {
            console.error("[auth] staff revalidation failed:", err);
            return token;
          }
        }
      }

      return token;
    },
    async session({ session, token }: { session: Session; token: JWT }) {
      if (!token.sub) {
        throw new Error("Invalid session token: missing sub");
      }

      if (token.principal === "customer") {
        session.user = {
          ...session.user,
          id: token.sub,
          principal: "customer",
          role: token.role,
          verificationStatus: token.verificationStatus,
          uaePassSession: token.uaePassSession,
          staffRole: undefined,
        };
      } else {
        session.user = {
          ...session.user,
          id: token.sub,
          principal: "staff",
          staffRole: token.staffRole,
          role: undefined,
          verificationStatus: undefined,
          uaePassSession: undefined,
          name: token.name,
          email: token.email,
        };
      }

      return session;
    },
  },
});

export const auth = nodeAuth.auth;
export const handlers = nodeAuth.handlers;
export const signIn = nodeAuth.signIn;
export const signOut = nodeAuth.signOut;

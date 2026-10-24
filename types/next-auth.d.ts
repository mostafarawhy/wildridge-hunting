import type { DefaultSession } from "next-auth";
import type { StaffRole } from "@/app/generated/prisma/client";

type CustomerRole = "B2C" | "B2B";
type VerificationStatus =
  | "NOT_REQUIRED"
  | "PENDING"
  | "APPROVED"
  | "REJECTED"
  | "EXPIRED";

declare module "next-auth" {
  interface User {
    principal: "customer" | "staff";
    role?: CustomerRole;
    verificationStatus?: VerificationStatus;
    tokenVersion?: number;
    uaePassSession?: boolean;
    staffRole?: StaffRole;
  }

  interface Session {
    user: {
      id: string;
      principal: "customer" | "staff";
      role?: CustomerRole;
      verificationStatus?: VerificationStatus;
      uaePassSession?: boolean;
      staffRole?: StaffRole;
    } & DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    sub: string;
    principal: "customer" | "staff";
    role?: CustomerRole;
    verificationStatus?: VerificationStatus;
    tokenVersion?: number;
    uaePassSession?: boolean;
    staffRole?: StaffRole;
  }
}

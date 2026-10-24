import { createHash, randomBytes } from "crypto";
import { db } from "@/lib/db/client";

const PENDING_LINK_TTL_MS = 600_000;

export const PENDING_LINK_MAX_ATTEMPTS = 5;

export interface PendingLinkIdentity {
  uaePassUuid: string;
  email: string | null;
  fullnameEN: string | null;
  firstnameEN: string | null;
  lastnameEN: string | null;
  nationalityEN: string | null;
  userType: string;
  idnPresent: boolean;
  locale: string;
  callbackUrl: string;
}

export interface PendingLinkRecord extends PendingLinkIdentity {
  id: string;
  attemptCount: number;
}

export function hashPendingLinkToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export async function mintPendingLink(
  identity: PendingLinkIdentity,
): Promise<string> {
  const token = randomBytes(32).toString("base64url");

  await db.uaePassPendingLink.create({
    data: {
      tokenHash: hashPendingLinkToken(token),
      uaePassUuid: identity.uaePassUuid,
      email: identity.email,
      fullnameEN: identity.fullnameEN,
      firstnameEN: identity.firstnameEN,
      lastnameEN: identity.lastnameEN,
      nationalityEN: identity.nationalityEN,
      userType: identity.userType,
      idnPresent: identity.idnPresent,
      locale: identity.locale,
      callbackUrl: identity.callbackUrl,
      expiresAt: new Date(Date.now() + PENDING_LINK_TTL_MS),
    },
  });

  return token;
}

export async function readPendingLink(
  token: string,
): Promise<PendingLinkRecord | null> {
  const record = await db.uaePassPendingLink.findUnique({
    where: { tokenHash: hashPendingLinkToken(token) },
    select: {
      id: true,
      uaePassUuid: true,
      email: true,
      fullnameEN: true,
      firstnameEN: true,
      lastnameEN: true,
      nationalityEN: true,
      userType: true,
      idnPresent: true,
      locale: true,
      callbackUrl: true,
      attemptCount: true,
      expiresAt: true,
      consumedAt: true,
    },
  });

  if (!record) return null;
  if (record.consumedAt) return null;
  if (record.expiresAt.getTime() <= Date.now()) return null;
  if (record.attemptCount >= PENDING_LINK_MAX_ATTEMPTS) return null;

  return {
    id: record.id,
    uaePassUuid: record.uaePassUuid,
    email: record.email,
    fullnameEN: record.fullnameEN,
    firstnameEN: record.firstnameEN,
    lastnameEN: record.lastnameEN,
    nationalityEN: record.nationalityEN,
    userType: record.userType,
    idnPresent: record.idnPresent,
    locale: record.locale,
    callbackUrl: record.callbackUrl,
    attemptCount: record.attemptCount,
  };
}

export async function recordPendingLinkAttempt(
  token: string,
): Promise<number | null> {
  const tokenHash = hashPendingLinkToken(token);

  const record = await db.uaePassPendingLink.findUnique({
    where: { tokenHash },
    select: { consumedAt: true },
  });

  if (!record || record.consumedAt) return null;

  const updated = await db.uaePassPendingLink.update({
    where: { tokenHash },
    data: { attemptCount: { increment: 1 } },
    select: { attemptCount: true },
  });

  return updated.attemptCount;
}

export async function consumePendingLink(
  token: string,
): Promise<PendingLinkRecord | null> {
  const tokenHash = hashPendingLinkToken(token);

  return db.$transaction(
    async (tx) => {
      const record = await tx.uaePassPendingLink.findUnique({
        where: { tokenHash },
        select: {
          id: true,
          uaePassUuid: true,
          email: true,
          fullnameEN: true,
          firstnameEN: true,
          lastnameEN: true,
          nationalityEN: true,
          userType: true,
          idnPresent: true,
          locale: true,
          callbackUrl: true,
          attemptCount: true,
          expiresAt: true,
          consumedAt: true,
        },
      });

      if (!record) return null;
      if (record.consumedAt) return null;
      if (record.expiresAt.getTime() <= Date.now()) return null;
      if (record.attemptCount >= PENDING_LINK_MAX_ATTEMPTS) return null;

      const claimed = await tx.uaePassPendingLink.updateMany({
        where: { tokenHash, consumedAt: null },
        data: { consumedAt: new Date() },
      });

      if (claimed.count === 0) return null;

      return {
        id: record.id,
        uaePassUuid: record.uaePassUuid,
        email: record.email,
        fullnameEN: record.fullnameEN,
        firstnameEN: record.firstnameEN,
        lastnameEN: record.lastnameEN,
        nationalityEN: record.nationalityEN,
        userType: record.userType,
        idnPresent: record.idnPresent,
        locale: record.locale,
        callbackUrl: record.callbackUrl,
        attemptCount: record.attemptCount,
      };
    },
    { isolationLevel: "Serializable" },
  );
}

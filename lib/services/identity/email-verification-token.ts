import { createHash, randomBytes } from "crypto";
import { db } from "@/lib/db/client";

const EMAIL_VERIFICATION_TOKEN_TTL_MS = 86_400_000;

export function hashEmailVerificationToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export async function mintEmailVerificationToken(
  customerId: string,
): Promise<string> {
  const token = randomBytes(32).toString("base64url");

  await db.$transaction(
    async (tx) => {
      await tx.emailVerificationToken.updateMany({
        where: { customerId, consumedAt: null },
        data: { consumedAt: new Date() },
      });

      await tx.emailVerificationToken.create({
        data: {
          tokenHash: hashEmailVerificationToken(token),
          customerId,
          expiresAt: new Date(Date.now() + EMAIL_VERIFICATION_TOKEN_TTL_MS),
        },
      });
    },
    { isolationLevel: "Serializable" },
  );

  return token;
}

export async function confirmEmailVerificationToken(
  token: string,
): Promise<{ customerId: string; newlyVerified: boolean } | null> {
  const tokenHash = hashEmailVerificationToken(token);

  return db.$transaction(
    async (tx) => {
      const verificationToken = await tx.emailVerificationToken.findUnique({
        where: { tokenHash },
        select: { customerId: true, expiresAt: true, consumedAt: true },
      });

      if (!verificationToken) return null;
      if (verificationToken.consumedAt) return null;
      if (verificationToken.expiresAt.getTime() <= Date.now()) return null;

      const claimed = await tx.emailVerificationToken.updateMany({
        where: { tokenHash, consumedAt: null },
        data: { consumedAt: new Date() },
      });

      if (claimed.count === 0) return null;

      const { customerId } = verificationToken;

      const verified = await tx.customer.updateMany({
        where: { id: customerId, emailVerifiedAt: null },
        data: { emailVerifiedAt: new Date() },
      });

      return { customerId, newlyVerified: verified.count === 1 };
    },
    { isolationLevel: "Serializable" },
  );
}

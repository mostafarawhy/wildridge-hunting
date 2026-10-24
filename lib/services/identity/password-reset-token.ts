import { createHash, randomBytes } from "crypto";
import { db } from "@/lib/db/client";

const RESET_TOKEN_TTL_MS = 1_800_000;

export function hashPasswordResetToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export async function mintPasswordResetToken(
  customerId: string,
): Promise<string> {
  const token = randomBytes(32).toString("base64url");

  await db.$transaction(
    async (tx) => {
      await tx.passwordResetToken.updateMany({
        where: { customerId, consumedAt: null },
        data: { consumedAt: new Date() },
      });

      await tx.passwordResetToken.create({
        data: {
          tokenHash: hashPasswordResetToken(token),
          customerId,
          expiresAt: new Date(Date.now() + RESET_TOKEN_TTL_MS),
        },
      });
    },
    { isolationLevel: "Serializable" },
  );

  return token;
}

export async function redeemPasswordResetToken(
  token: string,
): Promise<string | null> {
  const tokenHash = hashPasswordResetToken(token);

  return db.$transaction(
    async (tx) => {
      const resetToken = await tx.passwordResetToken.findUnique({
        where: { tokenHash },
        select: { customerId: true, expiresAt: true, consumedAt: true },
      });

      if (!resetToken) return null;
      if (resetToken.consumedAt) return null;
      if (resetToken.expiresAt.getTime() <= Date.now()) return null;

      const claimed = await tx.passwordResetToken.updateMany({
        where: { tokenHash, consumedAt: null },
        data: { consumedAt: new Date() },
      });

      if (claimed.count === 0) return null;

      return resetToken.customerId;
    },
    { isolationLevel: "Serializable" },
  );
}

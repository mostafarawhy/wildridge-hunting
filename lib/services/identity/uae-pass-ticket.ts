import { createHash, randomBytes } from "crypto";
import { db } from "@/lib/db/client";

const TICKET_TTL_MS = 120_000;

export function hashUaePassTicket(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export async function mintUaePassTicket(customerId: string): Promise<string> {
  const token = randomBytes(32).toString("base64url");

  await db.uaePassSignInTicket.create({
    data: {
      tokenHash: hashUaePassTicket(token),
      customerId,
      expiresAt: new Date(Date.now() + TICKET_TTL_MS),
    },
  });

  return token;
}

export async function redeemUaePassTicket(
  token: string,
): Promise<string | null> {
  const tokenHash = hashUaePassTicket(token);

  return db.$transaction(
    async (tx) => {
      const ticket = await tx.uaePassSignInTicket.findUnique({
        where: { tokenHash },
        select: { customerId: true, expiresAt: true, consumedAt: true },
      });

      if (!ticket) return null;
      if (ticket.consumedAt) return null;
      if (ticket.expiresAt.getTime() <= Date.now()) return null;

      const claimed = await tx.uaePassSignInTicket.updateMany({
        where: { tokenHash, consumedAt: null },
        data: { consumedAt: new Date() },
      });

      if (claimed.count === 0) return null;

      return ticket.customerId;
    },
    { isolationLevel: "Serializable" },
  );
}

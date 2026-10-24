import { BRAND } from "@/lib/config/brand";
import "server-only";
import type { Prisma } from "@/app/generated/prisma/client";

export async function nextQuoteNumber(
  tx: Prisma.TransactionClient,
  now: Date,
): Promise<string> {
  const year = now.getUTCFullYear();
  const key = `quote_sequence_${year}`;

  const existing = await tx.projectConfig.findUnique({ where: { key } });

  let nextSeq: number;
  if (!existing) {
    nextSeq = 1;
    await tx.projectConfig.create({
      data: { key, value: { next: 2 } },
    });
  } else {
    const current = (existing.value as { next: number }).next ?? 1;
    nextSeq = current;
    await tx.projectConfig.update({
      where: { key },
      data: { value: { next: current + 1 } },
    });
  }

  return `${BRAND.quotePrefix}-${year}-${String(nextSeq).padStart(6, "0")}`;
}

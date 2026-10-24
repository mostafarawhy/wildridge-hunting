// Atomic order-number generator. One sequence row per year. Must be called inside a transaction.
import { BRAND } from "@/lib/config/brand";
import "server-only";
import type { Prisma } from "@/app/generated/prisma/client";

/**
 * Generate the next order number for the given year.
 * Format: {orderPrefix}-{YEAR}-{6-digit-padded-sequence}, e.g. WR-2026-000123.
 *
 * MUST be called inside a Prisma transaction (tx parameter, not db).
 * Uses ProjectConfig table with key="order_sequence_{year}" and JSON value { next: number }.
 *
 * Atomicity depends on the enclosing transaction's isolation level. Callers should use
 * { isolationLevel: "Serializable" } to prevent duplicate order numbers under concurrent orders.
 *
 * TODO: replace with raw SELECT ... FOR UPDATE or a real PostgreSQL sequence
 * if duplicates or gaps appear under load.
 */
export async function nextOrderNumber(
  tx: Prisma.TransactionClient,
  now: Date,
): Promise<string> {
  const year = now.getUTCFullYear();
  const key = `order_sequence_${year}`;

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

  return `${BRAND.orderPrefix}-${year}-${String(nextSeq).padStart(6, "0")}`;
}

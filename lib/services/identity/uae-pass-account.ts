import { db } from "@/lib/db/client";
import type { UaePassUserInfo } from "./uae-pass-provider";

export type UaePassAccountResolution =
  | { kind: "linked"; customerId: string }
  | { kind: "email_collision"; customerId: string }
  | { kind: "no_match" };

export async function resolveUaePassAccount(
  userInfo: UaePassUserInfo,
): Promise<UaePassAccountResolution> {
  const linked = await db.customer.findUnique({
    where: { uaePassUuid: userInfo.uuid },
    select: { id: true },
  });

  if (linked) {
    return { kind: "linked", customerId: linked.id };
  }

  const email = userInfo.email?.trim().toLowerCase();

  if (!email) {
    return { kind: "no_match" };
  }

  const collision = await db.customer.findUnique({
    where: { email },
    select: { id: true },
  });

  if (collision) {
    return { kind: "email_collision", customerId: collision.id };
  }

  return { kind: "no_match" };
}

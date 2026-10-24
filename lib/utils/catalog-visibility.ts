import type { Prisma } from "@/app/generated/prisma/client";

export const LIVE_CATEGORY_WHERE = {
  isVisible: true,
  deletedAt: null,
  OR: [
    { parentId: null },
    { parent: { is: { isVisible: true, deletedAt: null } } },
  ],
} satisfies Prisma.CategoryWhereInput;

export const LIVE_CATEGORY_SELECT = {
  isVisible: true,
  deletedAt: true,
  parent: { select: { isVisible: true, deletedAt: true } },
} as const;

export function isLiveCategory(c: {
  isVisible: boolean;
  deletedAt: Date | null;
  parent: { isVisible: boolean; deletedAt: Date | null } | null;
}): boolean {
  if (!c.isVisible || c.deletedAt !== null) return false;
  if (c.parent === null) return true;
  return c.parent.isVisible && c.parent.deletedAt === null;
}

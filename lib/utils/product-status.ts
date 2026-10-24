import type { PublishStatus } from "@/app/generated/prisma/client";

export const PUBLISH_STATUS_LABELS: Record<PublishStatus, string> = {
  PUBLISHED: "Published",
  DRAFT: "Draft",
  ARCHIVED: "Archived",
};

export const PUBLISH_STATUS_STYLES: Record<
  PublishStatus,
  { backgroundColor: string; color: string }
> = {
  PUBLISHED: { backgroundColor: "#dcfce7", color: "#166534" },
  DRAFT: { backgroundColor: "#f3f4f6", color: "#6b6b6b" },
  ARCHIVED: { backgroundColor: "#fef9c3", color: "#854d0e" },
};

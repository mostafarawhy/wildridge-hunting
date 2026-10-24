import "server-only";
import { db } from "@/lib/db/client";
import { PAGE_KEYS, PAGE_CONFIG, type PageKey } from "@/lib/utils/page-keys";
import { toISOString } from "@/lib/utils/date";

export interface AdminStorePageRow {
  key: PageKey;
  label: string;
  published: boolean;
  authored: { en: boolean; ar: boolean; ru: boolean };
  updatedAt: string | null;
  lastEditorName: string | null;
  titleEn: string;
  titleAr: string;
  titleRu: string | null;
  contentEn: string | null;
  contentAr: string | null;
  contentRu: string | null;
  metaTitleEn: string | null;
  metaTitleAr: string | null;
  metaTitleRu: string | null;
  metaDescriptionEn: string | null;
  metaDescriptionAr: string | null;
  metaDescriptionRu: string | null;
}

export async function listStorePagesForAdmin(): Promise<AdminStorePageRow[]> {
  const rows = await db.page.findMany({
    where: { key: { in: [...PAGE_KEYS] } },
  });
  const rowByKey = new Map(rows.map((r) => [r.key as PageKey, r]));

  const auditRows = await db.auditLog.findMany({
    where: {
      entityType: "Page",
      action: { in: ["settings.page.update", "settings.page.publish"] },
      entityId: { in: [...PAGE_KEYS] },
    },
    orderBy: { createdAt: "desc" },
    select: { entityId: true, actorId: true, actorType: true },
  });

  const latestByKey = new Map<string, { actorId: string | null; actorType: string }>();
  for (const row of auditRows) {
    if (!row.entityId || latestByKey.has(row.entityId)) continue;
    latestByKey.set(row.entityId, { actorId: row.actorId, actorType: row.actorType });
  }

  const staffIds = [
    ...new Set(
      [...latestByKey.values()]
        .filter((v) => v.actorType === "STAFF" && v.actorId)
        .map((v) => v.actorId as string),
    ),
  ];

  const staffRows =
    staffIds.length > 0
      ? await db.staff.findMany({
          where: { id: { in: staffIds } },
          select: { id: true, name: true },
        })
      : [];
  const staffNameById = new Map(staffRows.map((s) => [s.id, s.name]));

  return PAGE_KEYS.map((key) => {
    const row = rowByKey.get(key) ?? null;
    const authored = {
      en: !!row && row.titleEn.trim() !== "" && !!row.contentEn?.trim(),
      ar: !!row && row.titleAr.trim() !== "" && !!row.contentAr?.trim(),
      ru: !!row && !!row.titleRu?.trim() && !!row.contentRu?.trim(),
    };
    const latest = latestByKey.get(key);
    const lastEditorName =
      latest && latest.actorType === "STAFF" && latest.actorId
        ? (staffNameById.get(latest.actorId) ?? null)
        : null;

    return {
      key,
      label: PAGE_CONFIG[key].adminLabel,
      published: row?.isActive ?? false,
      authored,
      updatedAt: row ? toISOString(row.updatedAt) : null,
      lastEditorName,
      titleEn: row?.titleEn ?? "",
      titleAr: row?.titleAr ?? "",
      titleRu: row?.titleRu ?? null,
      contentEn: row?.contentEn ?? null,
      contentAr: row?.contentAr ?? null,
      contentRu: row?.contentRu ?? null,
      metaTitleEn: row?.metaTitleEn ?? null,
      metaTitleAr: row?.metaTitleAr ?? null,
      metaTitleRu: row?.metaTitleRu ?? null,
      metaDescriptionEn: row?.metaDescriptionEn ?? null,
      metaDescriptionAr: row?.metaDescriptionAr ?? null,
      metaDescriptionRu: row?.metaDescriptionRu ?? null,
    };
  });
}

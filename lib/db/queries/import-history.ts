import "server-only";
import { db } from "@/lib/db/client";
import { toISOString, dubaiDayBoundsUtc } from "@/lib/utils/date";
import type { ImportStatus } from "@/app/generated/prisma/enums";
import type { Prisma, StaffRole } from "@/app/generated/prisma/client";
import { describeFieldChange } from "@/lib/services/catalog-import";
import type { ImportFieldChange, ImportIssue } from "@/lib/utils/catalog-import";

export interface ImportHistoryItem {
  id: string;
  filename: string;
  status: ImportStatus;
  totalRows: number;
  successRows: number;
  failedRows: number;
  createdAt: string;
  uploadedByName: string | null;
  hasFile: boolean;
  createdCount: number | null;
  updatedCount: number | null;
  unchangedCount: number | null;
  addonsCreated: number | null;
  addonsUpdated: number | null;
  accessoryLists: number | null;
  problemCount: number;
}

export async function getImportHistory(opts: {
  page: number;
  pageSize: number;
  staffId?: string;
  status?: "COMPLETED" | "FAILED";
  from?: string;
  to?: string;
}): Promise<{ items: ImportHistoryItem[]; total: number }> {
  const where: Prisma.ImportBatchWhereInput = {};

  if (opts.staffId) where.uploadedById = opts.staffId;
  if (opts.status) where.status = opts.status;

  const fromBounds = opts.from ? dubaiDayBoundsUtc(opts.from) : null;
  const toBounds = opts.to ? dubaiDayBoundsUtc(opts.to) : null;
  if (fromBounds || toBounds) {
    where.createdAt = {
      ...(fromBounds ? { gte: fromBounds.start } : {}),
      ...(toBounds ? { lt: toBounds.end } : {}),
    };
  }

  const page = Math.max(1, opts.page);

  const [total, rows] = await Promise.all([
    db.importBatch.count({ where }),
    db.importBatch.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * opts.pageSize,
      take: opts.pageSize,
      select: {
        id: true,
        filename: true,
        status: true,
        totalRows: true,
        successRows: true,
        failedRows: true,
        createdAt: true,
        storageKey: true,
        createdCount: true,
        updatedCount: true,
        unchangedCount: true,
        uploadedBy: { select: { name: true } },
        _count: { select: { errors: true } },
      },
    }),
  ]);

  const importAudits =
    rows.length > 0
      ? await db.auditLog.findMany({
          where: { action: "catalog.import", entityId: { in: rows.map((r) => r.id) } },
          select: { entityId: true, metadata: true },
        })
      : [];
  const importMetaById = new Map(importAudits.map((a) => [a.entityId, asRecord(a.metadata)]));

  const items = rows.map((r) => ({
    id: r.id,
    filename: r.filename,
    status: r.status,
    totalRows: r.totalRows,
    successRows: r.successRows,
    failedRows: r.failedRows,
    createdAt: toISOString(r.createdAt),
    uploadedByName: r.uploadedBy?.name ?? null,
    hasFile: r.storageKey !== null,
    createdCount: r.createdCount,
    updatedCount: r.updatedCount,
    unchangedCount: r.unchangedCount,
    addonsCreated: asNumber(importMetaById.get(r.id)?.addonsCreated),
    addonsUpdated: asNumber(importMetaById.get(r.id)?.addonsUpdated),
    accessoryLists: asNumber(importMetaById.get(r.id)?.accessoryLists),
    problemCount: r._count.errors,
  }));

  return { items, total };
}

export async function getImportStaffOptions(): Promise<{ id: string; name: string }[]> {
  const rows = await db.staff.findMany({
    where: { importBatches: { some: {} } },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
  return rows;
}

export interface ImportDetailChange {
  productId: string;
  sku: string;
  name: string;
  productDeleted: boolean;
  action: "create" | "update";
  row: number | null;
  fields: ImportFieldChange[];
  specs: { before: string[]; after: string[] } | null;
  images: { before: string[]; after: string[] } | null;
  addons: { before: string[]; after: string[] } | null;
  accessories: { before: string[]; after: string[] } | null;
  created: {
    publishStatus: string | null;
    openingStock: number | null;
    specCount: number;
    imageCount: number;
    addonCount: number;
    accessoryCount: number;
  } | null;
}

export interface ImportDetailAddonChange {
  id: string;
  addonId: string;
  name: string;
  action: "create" | "update";
  row: number | null;
  fields: ImportFieldChange[];
}

export interface ImportDetail {
  batch: {
    id: string;
    filename: string;
    status: ImportStatus;
    createdAt: string;
    uploadedBy: { name: string; role: StaffRole } | null;
    totalRows: number;
    createdCount: number | null;
    updatedCount: number | null;
    unchangedCount: number | null;
    fileSizeBytes: number | null;
    fileSha256: string | null;
    hasFile: boolean;
  };
  problems: ImportIssue[];
  downloads: { staffName: string; createdAt: string }[];
  changes: ImportDetailChange[];
  addonChanges: ImportDetailAddonChange[];
  total: number;
  specTables: number;
  addonsCreated: number | null;
  addonsUpdated: number | null;
  addonsUnchanged: number | null;
  galleries: number | null;
  linkLists: number | null;
  accessoryLists: number | null;
}

function asRecord(v: unknown): Record<string, unknown> | null {
  return typeof v === "object" && v !== null && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : null;
}

function asStringArray(v: unknown): string[] | null {
  return Array.isArray(v) && v.every((x) => typeof x === "string")
    ? (v as string[])
    : null;
}

function asString(v: unknown): string | null {
  return typeof v === "string" ? v : null;
}

function asNumber(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

export async function getImportDetail(
  id: string,
  page: number,
  pageSize = 50,
): Promise<ImportDetail | null> {
  const batch = await db.importBatch.findUnique({
    where: { id },
    select: {
      id: true,
      filename: true,
      status: true,
      createdAt: true,
      totalRows: true,
      createdCount: true,
      updatedCount: true,
      unchangedCount: true,
      fileSizeBytes: true,
      fileSha256: true,
      storageKey: true,
      uploadedBy: { select: { name: true, role: true } },
    },
  });
  if (!batch) return null;

  const [errorRows, downloadRows, auditRows, addonAuditRows, importAudit] = await Promise.all([
    db.importBatchError.findMany({
      where: { importBatchId: id },
      orderBy: [{ rowNumber: { sort: "asc", nulls: "first" } }, { createdAt: "asc" }],
      select: {
        rowNumber: true,
        sheet: true,
        columnKey: true,
        sku: true,
        message: true,
        found: true,
        fix: true,
      },
    }),
    db.auditLog.findMany({
      where: { action: "catalog.import_file_downloaded", entityId: id },
      orderBy: { createdAt: "desc" },
      take: 20,
      select: { actorId: true, createdAt: true },
    }),
    db.auditLog.findMany({
      where: {
        action: { in: ["product.create", "product.update"] },
        metadata: { path: ["importBatchId"], equals: id },
      },
      select: {
        entityId: true,
        action: true,
        before: true,
        after: true,
        metadata: true,
      },
    }),
    db.auditLog.findMany({
      where: {
        action: { in: ["addon.create", "addon.update"] },
        metadata: { path: ["importBatchId"], equals: id },
      },
      select: {
        entityId: true,
        action: true,
        before: true,
        after: true,
        metadata: true,
      },
    }),
    db.auditLog.findFirst({
      where: { action: "catalog.import", entityId: id },
      select: { metadata: true },
    }),
  ]);

  const problems: ImportIssue[] = errorRows.map((e) => ({
    severity: "error",
    sheet: e.sheet,
    row: e.rowNumber,
    column: e.columnKey,
    sku: e.sku,
    found: e.found,
    problem: e.message,
    fix: e.fix,
  }));

  const downloaderIds = [
    ...new Set(downloadRows.map((d) => d.actorId).filter((x): x is string => x !== null)),
  ];
  const downloaders =
    downloaderIds.length > 0
      ? await db.staff.findMany({
          where: { id: { in: downloaderIds } },
          select: { id: true, name: true },
        })
      : [];
  const downloaderName = new Map(downloaders.map((s) => [s.id, s.name]));
  const downloads = downloadRows.map((d) => ({
    staffName: (d.actorId && downloaderName.get(d.actorId)) || "Unknown staff",
    createdAt: toISOString(d.createdAt),
  }));

  const rows = auditRows
    .filter((r): r is typeof r & { entityId: string } => r.entityId !== null)
    .map((r) => {
      const meta = asRecord(r.metadata);
      const rowNumber = meta ? asNumber(meta.row) : null;
      return { ...r, rowNumber };
    })
    .sort((a, b) => {
      if (a.rowNumber === null && b.rowNumber === null) return 0;
      if (a.rowNumber === null) return 1;
      if (b.rowNumber === null) return -1;
      return a.rowNumber - b.rowNumber;
    });

  let specTables = 0;
  for (const r of rows) {
    if (r.action === "product.create") {
      const specs = asStringArray(asRecord(r.metadata)?.specs);
      if (specs && specs.length > 0) specTables++;
    } else {
      const before = asRecord(r.before);
      const after = asRecord(r.after);
      if (asStringArray(before?.specs) || asStringArray(after?.specs)) specTables++;
    }
  }

  const total = rows.length;
  const safePage = Math.max(1, page);
  const slice = rows.slice((safePage - 1) * pageSize, safePage * pageSize);

  const productIds = [...new Set(slice.map((r) => r.entityId))];
  const categoryIds = new Set<string>();
  for (const r of slice) {
    for (const side of [asRecord(r.before), asRecord(r.after)]) {
      const c = side?.categoryId;
      if (typeof c === "string") categoryIds.add(c);
    }
  }

  const [products, categories, brands] = await Promise.all([
    productIds.length > 0
      ? db.product.findMany({
          where: { id: { in: productIds } },
          select: { id: true, sku: true, nameEn: true, deletedAt: true },
        })
      : Promise.resolve([]),
    categoryIds.size > 0
      ? db.category.findMany({
          where: { id: { in: [...categoryIds] } },
          select: { id: true, slug: true },
        })
      : Promise.resolve([]),
    db.brand.findMany({ select: { id: true, nameEn: true } }),
  ]);
  const productById = new Map(products.map((p) => [p.id, p]));
  const slugById = new Map(categories.map((c) => [c.id, c.slug]));
  const brandNameById = new Map(brands.map((b) => [b.id, b.nameEn]));

  const changes: ImportDetailChange[] = slice.map((r) => {
    const product = productById.get(r.entityId);
    const before = asRecord(r.before);
    const after = asRecord(r.after);
    const meta = asRecord(r.metadata);
    const isCreate = r.action === "product.create";

    let fields: ImportFieldChange[] = [];
    let specs: ImportDetailChange["specs"] = null;
    let images: ImportDetailChange["images"] = null;
    let addons: ImportDetailChange["addons"] = null;
    let accessories: ImportDetailChange["accessories"] = null;
    let created: ImportDetailChange["created"] = null;

    if (isCreate) {
      created = {
        publishStatus: asString(after?.publishStatus),
        openingStock: asNumber(after?.stockQuantity),
        specCount: asStringArray(meta?.specs)?.length ?? 0,
        imageCount: asStringArray(meta?.images)?.length ?? 0,
        addonCount: asStringArray(meta?.addons)?.length ?? 0,
        accessoryCount: asStringArray(meta?.accessories)?.length ?? 0,
      };
    } else if (after) {
      fields = Object.keys(after)
        .filter(
          (key) =>
            key !== "specs" && key !== "images" && key !== "addons" && key !== "accessories",
        )
        .map((key) => describeFieldChange(key, before?.[key], after[key], slugById, brandNameById));
      const specsBefore = asStringArray(before?.specs);
      const specsAfter = asStringArray(after.specs);
      if (specsBefore || specsAfter) {
        specs = { before: specsBefore ?? [], after: specsAfter ?? [] };
      }
      const imagesBefore = asStringArray(before?.images);
      const imagesAfter = asStringArray(after.images);
      if (imagesBefore || imagesAfter) {
        images = { before: imagesBefore ?? [], after: imagesAfter ?? [] };
      }
      const addonsBefore = asStringArray(before?.addons);
      const addonsAfter = asStringArray(after.addons);
      if (addonsBefore || addonsAfter) {
        addons = { before: addonsBefore ?? [], after: addonsAfter ?? [] };
      }
      const accessoriesBefore = asStringArray(before?.accessories);
      const accessoriesAfter = asStringArray(after.accessories);
      if (accessoriesBefore || accessoriesAfter) {
        accessories = { before: accessoriesBefore ?? [], after: accessoriesAfter ?? [] };
      }
    }

    return {
      productId: r.entityId,
      sku: product?.sku ?? asString(after?.sku) ?? "—",
      name: product?.nameEn ?? asString(after?.nameEn) ?? "—",
      productDeleted: product ? product.deletedAt !== null : true,
      action: isCreate ? "create" : "update",
      row: r.rowNumber,
      fields,
      specs,
      images,
      addons,
      accessories,
      created,
    };
  });

  const addonRows = addonAuditRows
    .filter((r): r is typeof r & { entityId: string } => r.entityId !== null)
    .map((r) => {
      const meta = asRecord(r.metadata);
      return { ...r, rowNumber: meta ? asNumber(meta.row) : null };
    })
    .sort((a, b) => (a.rowNumber ?? Infinity) - (b.rowNumber ?? Infinity));
  const addonEntityIds = [...new Set(addonRows.map((r) => r.entityId))];
  const addonRecords =
    addonEntityIds.length > 0
      ? await db.addon.findMany({
          where: { id: { in: addonEntityIds } },
          select: { id: true, addonId: true, nameEn: true },
        })
      : [];
  const addonByEntityId = new Map(addonRecords.map((a) => [a.id, a]));
  const noSlugs = new Map<string, string>();
  const addonChanges: ImportDetailAddonChange[] = addonRows.map((r) => {
    const record = addonByEntityId.get(r.entityId);
    const before = asRecord(r.before);
    const after = asRecord(r.after);
    const isCreate = r.action === "addon.create";
    const fields: ImportFieldChange[] =
      !isCreate && after
        ? Object.keys(after)
            .filter((key) => key !== "storageKey")
            .map((key) => describeFieldChange(key, before?.[key], after[key], noSlugs, brandNameById))
        : [];
    return {
      id: r.entityId,
      addonId: record?.addonId ?? asString(after?.addonId) ?? "—",
      name: record?.nameEn ?? asString(after?.nameEn) ?? "—",
      action: isCreate ? "create" : "update",
      row: r.rowNumber,
      fields,
    };
  });

  const importMeta = asRecord(importAudit?.metadata);

  return {
    batch: {
      id: batch.id,
      filename: batch.filename,
      status: batch.status,
      createdAt: toISOString(batch.createdAt),
      uploadedBy: batch.uploadedBy,
      totalRows: batch.totalRows,
      createdCount: batch.createdCount,
      updatedCount: batch.updatedCount,
      unchangedCount: batch.unchangedCount,
      fileSizeBytes: batch.fileSizeBytes,
      fileSha256: batch.fileSha256,
      hasFile: batch.storageKey !== null,
    },
    problems,
    downloads,
    changes,
    addonChanges,
    total,
    specTables,
    addonsCreated: asNumber(importMeta?.addonsCreated),
    addonsUpdated: asNumber(importMeta?.addonsUpdated),
    addonsUnchanged: asNumber(importMeta?.addonsUnchanged),
    galleries: asNumber(importMeta?.galleries),
    linkLists: asNumber(importMeta?.linkLists),
    accessoryLists: asNumber(importMeta?.accessoryLists),
  };
}

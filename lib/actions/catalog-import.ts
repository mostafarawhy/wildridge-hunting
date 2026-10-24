"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db/client";
import { demoGate, requireStaffAction } from "@/lib/auth-staff";
import {
  applyCatalogImport,
  discardImportImages,
  hashImportBytes,
  parseCatalogWorkbook,
  planCatalogImport,
  recordFailedImport,
  verifyImportImages,
} from "@/lib/services/catalog-import";
import {
  createSignedUploadUrl,
  createSignedUrl,
  deleteFile,
  uploadFile,
} from "@/lib/services/storage";
import {
  IMPORT_IMAGE_NAME_RE,
  IMPORT_IMAGE_TARGETS,
  IMPORT_IMAGE_TYPES,
  imageExtension,
  typeMatchesExtension,
  type ImportImageTarget,
  type ImportImageType,
} from "@/lib/utils/image-sniff";
import { MAX_PRODUCT_IMAGE_SIZE_BYTES } from "@/lib/validations/product";
import {
  CATALOG_IMPORT_MIME,
  MAX_IMPORT_FILE_BYTES,
  importUploadKey,
  safeImportFileName,
  type CatalogImportImageFile,
  type CatalogImportSummary,
  type ImportIssue,
} from "@/lib/utils/catalog-import";

const CATALOG_IMPORTS_BUCKET = "catalog-imports";
const PRODUCT_IMAGES_BUCKET = "product-images";
const IMPORT_IMAGE_VERIFY_DEADLINE_MS = 45_000;

export type CatalogImportErrorCode =
  | "NO_FILE_PROVIDED"
  | "FILE_TOO_LARGE"
  | "INVALID_FILE_TYPE"
  | "VALIDATION_ERROR"
  | "INTERNAL_ERROR";

export type CatalogImportCheckResult =
  | { success: true; data: CatalogImportSummary }
  | { success: false; error: string; errorCode: CatalogImportErrorCode };

function readImportFile(
  formData: unknown,
):
  | { ok: true; file: File }
  | { ok: false; result: { success: false; error: string; errorCode: CatalogImportErrorCode } } {
  const rawFile = formData instanceof FormData ? formData.get("file") : null;
  if (!(rawFile instanceof File) || rawFile.size === 0) {
    return {
      ok: false,
      result: {
        success: false,
        error: "Choose a file to check.",
        errorCode: "NO_FILE_PROVIDED",
      },
    };
  }
  if (rawFile.size > MAX_IMPORT_FILE_BYTES) {
    return {
      ok: false,
      result: {
        success: false,
        error: "The file is larger than 4 MB.",
        errorCode: "FILE_TOO_LARGE",
      },
    };
  }
  if (!/\.xlsx$/i.test(rawFile.name)) {
    return {
      ok: false,
      result: {
        success: false,
        error: "Only .xlsx files can be imported.",
        errorCode: "INVALID_FILE_TYPE",
      },
    };
  }
  return { ok: true, file: rawFile };
}

const IMPORT_TYPE_VALUES = Object.keys(IMPORT_IMAGE_TYPES) as [
  ImportImageType,
  ...ImportImageType[],
];

const ImageFilesSchema = z
  .array(
    z.object({
      name: z.string().min(1).max(255),
      size: z.number().int().min(0),
      type: z.enum(IMPORT_TYPE_VALUES).nullable(),
    }),
  )
  .max(2000);

const ImageTargetSchema = z.enum(IMPORT_IMAGE_TARGETS);

const ImageUploadsSchema = z
  .array(
    z.object({
      name: z.string().min(1).max(255),
      target: ImageTargetSchema,
      key: z.string().min(1).max(300),
    }),
  )
  .max(4000);

const UPLOAD_ID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

function readJsonField(formData: unknown, name: string): unknown {
  const raw = formData instanceof FormData ? formData.get(name) : null;
  if (raw === null) return [];
  if (typeof raw !== "string") return undefined;
  try {
    return JSON.parse(raw);
  } catch {
    return undefined;
  }
}

function readImageFiles(formData: unknown): CatalogImportImageFile[] | null {
  const parsed = ImageFilesSchema.safeParse(readJsonField(formData, "images"));
  return parsed.success ? parsed.data : null;
}

function readUploadId(formData: unknown): string | null {
  const raw = formData instanceof FormData ? formData.get("uploadId") : null;
  return typeof raw === "string" && UPLOAD_ID_RE.test(raw) ? raw : null;
}

export async function checkCatalogImportAction(
  formData: unknown,
): Promise<CatalogImportCheckResult> {
  const demoRefusal = await demoGate("catalog:import");
  if (demoRefusal) return demoRefusal;

  await requireStaffAction("catalog:import");

  const checked = readImportFile(formData);
  if (!checked.ok) return checked.result;
  const file = checked.file;

  const imageFiles = readImageFiles(formData);
  if (!imageFiles) {
    return {
      success: false,
      error: "The list of selected images couldn't be read. Select the images again.",
      errorCode: "VALIDATION_ERROR",
    };
  }

  try {
    const bytes = new Uint8Array(await file.arrayBuffer());
    const hash = hashImportBytes(bytes);
    const parsed = parseCatalogWorkbook(bytes);

    if (parsed.fileIssues.length > 0) {
      return {
        success: true,
        data: {
          fileName: file.name,
          fileHash: hash,
          refused: true,
          counts: {
            productRows: 0,
            create: 0,
            update: 0,
            unchanged: 0,
            specTables: 0,
            galleries: 0,
            imageRows: 0,
            accessoryLists: 0,
            warnings: 0,
            errors: 0,
          },
          uploads: [],
          issues: parsed.fileIssues,
          issuesTruncated: false,
          changes: [],
        },
      };
    }

    const plan = await planCatalogImport(parsed, db, file.name, hash, imageFiles);
    return { success: true, data: plan.summary };
  } catch (err) {
    console.error("[checkCatalogImportAction]", err);
    return {
      success: false,
      error: "The file couldn't be checked. Try again.",
      errorCode: "INTERNAL_ERROR",
    };
  }
}

export type CommitCatalogImportErrorCode =
  | CatalogImportErrorCode
  | "IMPORT_CHANGED"
  | "IMAGES_MISSING"
  | "IMPORT_INVALID"
  | "NOTHING_TO_IMPORT"
  | "VALIDATION_ERROR"
  | "STORAGE_ERROR";

export type CommitCatalogImportResult =
  | {
      success: true;
      data: {
        batchId: string;
        created: number;
        updated: number;
        unchanged: number;
      };
    }
  | {
      success: false;
      error: string;
      errorCode: CommitCatalogImportErrorCode;
      batchId?: string;
    };

const CommitInputSchema = z.object({
  expectedHash: z.string().regex(/^[a-f0-9]{64}$/),
  expectedCreate: z.coerce.number().int().min(0),
  expectedUpdate: z.coerce.number().int().min(0),
  expectedUnchanged: z.coerce.number().int().min(0),
  expectedGalleries: z.coerce.number().int().min(0),
  expectedImageRows: z.coerce.number().int().min(0),
  expectedAccessoryLists: z.coerce.number().int().min(0),
});

const CATALOG_CHANGED = "The catalog changed since this file was checked. Check it again.";

class CommitFailure extends Error {
  constructor(
    readonly errorCode: CommitCatalogImportErrorCode,
    message: string,
    readonly issues: ImportIssue[] = [],
  ) {
    super(message);
  }
}

export async function commitCatalogImportAction(
  formData: unknown,
): Promise<CommitCatalogImportResult> {
  const demoRefusal = await demoGate("catalog:import");
  if (demoRefusal) return demoRefusal;

  const { id: staffId } = await requireStaffAction("catalog:import");
  const uploadId = readUploadId(formData);

  const checked = readImportFile(formData);
  let file: File;
  let pendingRefusal: { error: string; errorCode: CommitCatalogImportErrorCode } | null = null;
  if (checked.ok) {
    file = checked.file;
  } else if (checked.result.errorCode === "INVALID_FILE_TYPE") {
    file = (formData as FormData).get("file") as File;
    pendingRefusal = {
      error: checked.result.error,
      errorCode: checked.result.errorCode,
    };
  } else {
    if (uploadId) await discardImportImages(uploadId, []);
    return checked.result;
  }
  const form = formData as FormData;

  const bytes = new Uint8Array(await file.arrayBuffer());
  const hash = hashImportBytes(bytes);
  const fileSizeBytes = file.size;
  const batchId = crypto.randomUUID();

  const refuse = async (
    errorCode: CommitCatalogImportErrorCode,
    message: string,
    opts: { storageKey: string | null; issues?: ImportIssue[]; totalRows: number },
  ): Promise<CommitCatalogImportResult> => {
    const issues: ImportIssue[] =
      opts.issues && opts.issues.length > 0
        ? opts.issues
        : [
            {
              severity: "error",
              sheet: null,
              row: null,
              column: null,
              sku: null,
              found: null,
              problem: message,
              fix: null,
            },
          ];
    try {
      await recordFailedImport(db, {
        batchId,
        staffId,
        fileName: file.name,
        fileHash: hash,
        fileSizeBytes,
        storageKey: opts.storageKey,
        totalRows: opts.totalRows,
        errorCode,
        issues,
      });
      return { success: false, error: message, errorCode, batchId };
    } catch (err) {
      console.error("[commitCatalogImportAction] record", err);
      if (opts.storageKey) {
        try {
          await deleteFile(CATALOG_IMPORTS_BUCKET, opts.storageKey);
        } catch {}
      }
      return { success: false, error: message, errorCode };
    } finally {
      if (uploadId) await discardImportImages(uploadId, []);
    }
  };

  if (pendingRefusal) {
    return refuse(pendingRefusal.errorCode, pendingRefusal.error, {
      storageKey: null,
      totalRows: 0,
    });
  }

  const input = CommitInputSchema.safeParse({
    expectedHash: form.get("expectedHash"),
    expectedCreate: form.get("expectedCreate"),
    expectedUpdate: form.get("expectedUpdate"),
    expectedUnchanged: form.get("expectedUnchanged"),
    expectedGalleries: form.get("expectedGalleries"),
    expectedImageRows: form.get("expectedImageRows"),
    expectedAccessoryLists: form.get("expectedAccessoryLists"),
  });
  const imageFiles = readImageFiles(form);
  const uploadsParsed = ImageUploadsSchema.safeParse(readJsonField(form, "uploads"));
  if (!input.success || !imageFiles || !uploadsParsed.success) {
    return refuse("VALIDATION_ERROR", "Check the file again.", {
      storageKey: null,
      totalRows: 0,
    });
  }
  const expected = input.data;
  const uploads = uploadsParsed.data;

  const parsed = parseCatalogWorkbook(bytes);
  if (parsed.fileIssues.length > 0) {
    return refuse("IMPORT_INVALID", "The file no longer passes the check. Check it again.", {
      storageKey: null,
      issues: parsed.fileIssues,
      totalRows: 0,
    });
  }

  const totalRows = parsed.rows.Products.length;
  const storageKey = `${batchId}/${safeImportFileName(file.name)}`;
  try {
    await uploadFile({
      bucket: CATALOG_IMPORTS_BUCKET,
      path: storageKey,
      file: Buffer.from(bytes),
      contentType: CATALOG_IMPORT_MIME,
    });
  } catch {
    return refuse(
      "STORAGE_ERROR",
      "The file couldn't be stored, so nothing was imported. Try again.",
      { storageKey: null, totalRows },
    );
  }

  if (hash !== expected.expectedHash) {
    return refuse("IMPORT_CHANGED", "This isn't the file you checked. Check it again.", {
      storageKey,
      totalRows,
    });
  }

  try {
    const imageKeys = new Map<string, string>();
    const keptImages: { bucket: string; key: string }[] = [];
    if (uploads.length > 0) {
      if (uploadId === null) throw new CommitFailure("IMPORT_CHANGED", CATALOG_CHANGED);

      const infoByName = new Map(imageFiles.map((f) => [f.name, f]));
      const manifest: {
        name: string;
        key: string;
        size: number;
        type: ImportImageType;
        target: ImportImageTarget;
      }[] = [];
      for (const u of uploads) {
        const info = infoByName.get(u.name);
        if (!info || info.type === null) {
          throw new CommitFailure("IMPORT_CHANGED", CATALOG_CHANGED);
        }
        manifest.push({ ...u, size: info.size, type: info.type });
      }

      let deadline: ReturnType<typeof setTimeout> | undefined;
      let failedNames: string[];
      try {
        failedNames = await Promise.race([
          verifyImportImages(uploadId, manifest),
          new Promise<never>((_, reject) => {
            deadline = setTimeout(
              () => reject(new Error("IMAGE_CHECK_TIMED_OUT")),
              IMPORT_IMAGE_VERIFY_DEADLINE_MS,
            );
          }),
        ]);
      } catch (err) {
        if (!(err instanceof Error) || err.message !== "IMAGE_CHECK_TIMED_OUT") throw err;
        console.error("[catalog-import] image check timed out", {
          uploadId,
          images: manifest.length,
        });
        const problem = "Checking the uploaded images took too long, so nothing was imported.";
        throw new CommitFailure("STORAGE_ERROR", problem, [
          {
            severity: "error",
            sheet: null,
            row: null,
            column: null,
            sku: null,
            found: null,
            problem,
            fix: "Commit again. If it happens again, check your connection or commit fewer images at once.",
          },
        ]);
      } finally {
        clearTimeout(deadline);
      }
      if (failedNames.length > 0) {
        const problem = `These images didn't reach storage: ${failedNames.join(", ")}.`;
        throw new CommitFailure("IMAGES_MISSING", problem, [
          {
            severity: "error",
            sheet: null,
            row: null,
            column: null,
            sku: null,
            found: null,
            problem,
            fix: "Commit again. If it fails again, check your connection.",
          },
        ]);
      }
      for (const u of uploads) {
        imageKeys.set(importUploadKey(u), u.key);
        keptImages.push({ bucket: PRODUCT_IMAGES_BUCKET, key: u.key });
      }
    }

    const result = await db.$transaction(
      async (tx) => {
        const plan = await planCatalogImport(parsed, tx, file.name, hash, imageFiles);
        const { counts } = plan.summary;
        if (counts.errors > 0) {
          throw new CommitFailure(
            "IMPORT_INVALID",
            "The file no longer passes the check. Check it again.",
            plan.summary.issues,
          );
        }
        if (
          counts.create !== expected.expectedCreate ||
          counts.update !== expected.expectedUpdate ||
          counts.unchanged !== expected.expectedUnchanged ||
          counts.galleries !== expected.expectedGalleries ||
          counts.imageRows !== expected.expectedImageRows ||
          counts.accessoryLists !== expected.expectedAccessoryLists
        ) {
          throw new CommitFailure("IMPORT_CHANGED", CATALOG_CHANGED);
        }
        if (counts.create + counts.update === 0) {
          throw new CommitFailure(
            "NOTHING_TO_IMPORT",
            "Nothing to import. Everything in this file already matches the store.",
          );
        }
        const planned = new Set(plan.summary.uploads.map(importUploadKey));
        const given = new Set(uploads.map(importUploadKey));
        const pairsMatch =
          given.size === uploads.length &&
          given.size === planned.size &&
          [...planned].every((k) => given.has(k));
        if (!pairsMatch) throw new CommitFailure("IMPORT_CHANGED", CATALOG_CHANGED);
        await applyCatalogImport(tx, plan, {
          staffId,
          fileName: file.name,
          fileHash: hash,
          batchId,
          storageKey,
          fileSizeBytes,
          imageKeys,
        });
        return {
          batchId,
          created: counts.create,
          updated: counts.update,
          unchanged: counts.unchanged,
          galleries: counts.galleries,
        };
      },
      { isolationLevel: "Serializable", timeout: 60_000, maxWait: 10_000 },
    );

    if (uploadId) await discardImportImages(uploadId, keptImages);

    revalidatePath("/admin/products");
    if (result.galleries > 0) revalidatePath("/admin/products/[id]", "page");
    revalidatePath("/admin/import");

    return {
      success: true,
      data: {
        batchId: result.batchId,
        created: result.created,
        updated: result.updated,
        unchanged: result.unchanged,
      },
    };
  } catch (err) {
    let errorCode: CommitCatalogImportErrorCode;
    let message: string;
    const prismaCode =
      typeof err === "object" && err !== null && "code" in err
        ? (err as { code: string }).code
        : undefined;
    if (err instanceof CommitFailure) {
      errorCode = err.errorCode;
      message = err.message;
    } else if (prismaCode === "P2002") {
      errorCode = "IMPORT_CHANGED";
      message = CATALOG_CHANGED;
    } else if (prismaCode === "P2034" || prismaCode === "40001") {
      errorCode = "IMPORT_CHANGED";
      message =
        "Another change to the catalog was saved at the same moment, so nothing was imported. Check the file again.";
    } else if (prismaCode === "P2028") {
      errorCode = "INTERNAL_ERROR";
      message =
        "The import took too long and was cancelled, so nothing was changed. Split the file into smaller imports.";
    } else {
      console.error("[commitCatalogImportAction]", err);
      errorCode = "INTERNAL_ERROR";
      message = "The import couldn't be saved. Nothing was changed.";
    }
    return refuse(errorCode, message, {
      storageKey,
      issues: err instanceof CommitFailure ? err.issues : [],
      totalRows,
    });
  }
}

export type ImportFileUrlErrorCode = "NOT_FOUND" | "FILE_NOT_STORED" | "URL_MINT_FAILED";

export type ImportFileUrlResult =
  | { success: true; data: { url: string } }
  | { success: false; error: string; errorCode: ImportFileUrlErrorCode };

export async function getImportFileUrlAction(
  batchId: unknown,
): Promise<ImportFileUrlResult> {
  const demoRefusal = await demoGate("catalog:import");
  if (demoRefusal) return demoRefusal;

  const { id: staffId } = await requireStaffAction("catalog:import");

  if (typeof batchId !== "string" || batchId === "") {
    return { success: false, error: "Import not found.", errorCode: "NOT_FOUND" };
  }

  const batch = await db.importBatch.findUnique({
    where: { id: batchId },
    select: { filename: true, storageKey: true, fileSha256: true },
  });
  if (!batch) {
    return { success: false, error: "Import not found.", errorCode: "NOT_FOUND" };
  }
  if (batch.storageKey === null) {
    return {
      success: false,
      error: "This import has no stored file.",
      errorCode: "FILE_NOT_STORED",
    };
  }

  try {
    const url = await createSignedUrl(CATALOG_IMPORTS_BUCKET, batch.storageKey, 300, {
      download: safeImportFileName(batch.filename),
    });

    await db.auditLog.create({
      data: {
        actorType: "STAFF",
        actorId: staffId,
        action: "catalog.import_file_downloaded",
        entityType: "ImportBatch",
        entityId: batchId,
        metadata: { filename: batch.filename, fileHash: batch.fileSha256 },
      },
    });

    return { success: true, data: { url } };
  } catch {
    return {
      success: false,
      error: "Could not generate a link.",
      errorCode: "URL_MINT_FAILED",
    };
  }
}

const PrepareImageUploadsSchema = z
  .object({
    files: z
      .array(
        z.object({
          name: z.string().min(1).max(200).regex(IMPORT_IMAGE_NAME_RE),
          size: z.number().int().min(1).max(MAX_PRODUCT_IMAGE_SIZE_BYTES),
          type: z.enum(
            Object.keys(IMPORT_IMAGE_TYPES) as [ImportImageType, ...ImportImageType[]],
          ),
          target: ImageTargetSchema,
        }),
      )
      .min(1)
      .max(4000),
  })
  .superRefine((value, ctx) => {
    const seen = new Set<string>();
    value.files.forEach((f, i) => {
      if (seen.has(`${f.target}:${f.name}`)) {
        ctx.addIssue({
          code: "custom",
          path: ["files", i, "name"],
          message: "Two files share this name.",
        });
      }
      seen.add(`${f.target}:${f.name}`);
      if (!typeMatchesExtension(f.type, f.name)) {
        ctx.addIssue({
          code: "custom",
          path: ["files", i, "type"],
          message: "The file type doesn't match its extension.",
        });
      }
    });
  });

export type PrepareCatalogImageUploadsResult =
  | {
      success: true;
      data: {
        uploadId: string;
        uploads: {
          name: string;
          target: ImportImageTarget;
          key: string;
          signedUrl: string;
        }[];
      };
    }
  | {
      success: false;
      error: string;
      errorCode: "VALIDATION_ERROR" | "STORAGE_ERROR";
    };

export async function prepareCatalogImageUploadsAction(
  raw: unknown,
): Promise<PrepareCatalogImageUploadsResult> {
  const demoRefusal = await demoGate("catalog:import");
  if (demoRefusal) return demoRefusal;

  await requireStaffAction("catalog:import");

  const parsed = PrepareImageUploadsSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      success: false,
      error: "Some image files can't be uploaded. Check them again.",
      errorCode: "VALIDATION_ERROR",
    };
  }

  const uploadId = crypto.randomUUID();

  try {
    const uploads = await Promise.all(
      parsed.data.files.map(async (f) => {
        const key = `catalog/${uploadId}/${crypto.randomUUID()}.${imageExtension(f.name)}`;
        const { signedUrl } = await createSignedUploadUrl(PRODUCT_IMAGES_BUCKET, key);
        return { name: f.name, target: f.target, key, signedUrl };
      }),
    );
    return { success: true, data: { uploadId, uploads } };
  } catch (err) {
    console.error("[prepareCatalogImageUploadsAction]", err);
    return {
      success: false,
      error: "Could not prepare the image upload. Try again.",
      errorCode: "STORAGE_ERROR",
    };
  }
}

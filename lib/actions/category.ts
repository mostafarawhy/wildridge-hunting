"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db/client";
import { demoGate, requireStaffAction } from "@/lib/auth-staff";
import {
  CreateCategorySchema,
  UpdateCategorySchema,
} from "@/lib/validations/category";

export type CategoryActionErrorCode =
  | "VALIDATION_ERROR"
  | "NOT_FOUND"
  | "NAME_TAKEN"
  | "SLUG_TAKEN"
  | "PARENT_NOT_FOUND"
  | "PARENT_NOT_TOP_LEVEL"
  | "SELF_PARENT"
  | "HAS_CHILDREN"
  | "HAS_PRODUCTS"
  | "INTERNAL_ERROR";

export type CategoryActionResult =
  | { success: true; data: { id: string } }
  | {
      success: false;
      error: string;
      errorCode: CategoryActionErrorCode;
      fieldErrors?: Record<string, string[]>;
    };

class CategoryRefusal extends Error {
  constructor(
    public code: CategoryActionErrorCode,
    public text: string,
  ) {
    super(code);
  }
}

const HAS_CHILDREN_MOVE_TEXT =
  "A category with subcategories can't become a subcategory. Move its subcategories first.";

function handleCategoryError(err: unknown, tag: string): CategoryActionResult {
  const prismaCode =
    typeof err === "object" && err !== null && "code" in err
      ? (err as { code: string }).code
      : undefined;

  if (prismaCode === "P2002") {
    const rawTarget = (err as { meta?: { target?: string[] | string } }).meta
      ?.target;
    const targets = Array.isArray(rawTarget)
      ? rawTarget.join(",")
      : (rawTarget ?? "");
    if (targets.includes("nameEn")) {
      return {
        success: false,
        error: "A category with this name already exists.",
        errorCode: "NAME_TAKEN",
        fieldErrors: { nameEn: ["A category with this name already exists."] },
      };
    }
    if (targets.includes("slug")) {
      return {
        success: false,
        error: "A category with this web address already exists.",
        errorCode: "SLUG_TAKEN",
        fieldErrors: {
          slug: ["A category with this web address already exists."],
        },
      };
    }
  }

  if (err instanceof CategoryRefusal) {
    return { success: false, error: err.text, errorCode: err.code };
  }

  if (err instanceof Error) {
    switch (err.message) {
      case "NOT_FOUND":
        return {
          success: false,
          error: "Category not found.",
          errorCode: "NOT_FOUND",
        };
      case "PARENT_NOT_FOUND":
        return {
          success: false,
          error: "The selected parent category does not exist.",
          errorCode: "PARENT_NOT_FOUND",
        };
      case "PARENT_NOT_TOP_LEVEL":
        return {
          success: false,
          error: "The selected parent must be a top-level category.",
          errorCode: "PARENT_NOT_TOP_LEVEL",
        };
      case "SELF_PARENT":
        return {
          success: false,
          error: "A category cannot be its own parent.",
          errorCode: "SELF_PARENT",
        };
      case "SLUG_TAKEN":
        return {
          success: false,
          error: "A category with this web address already exists.",
          errorCode: "SLUG_TAKEN",
          fieldErrors: {
            slug: ["A category with this web address already exists."],
          },
        };
    }
  }

  console.error(`[${tag}]`, err);
  return {
    success: false,
    error: "An unexpected error occurred.",
    errorCode: "INTERNAL_ERROR",
  };
}

export async function createCategoryAction(
  raw: unknown,
): Promise<CategoryActionResult> {
  const demoRefusal = await demoGate("catalog:write");
  if (demoRefusal) return demoRefusal;

  const { id: staffId } = await requireStaffAction("catalog:write");

  const parsed = CreateCategorySchema.safeParse(raw);
  if (!parsed.success) {
    return {
      success: false,
      error: "Validation failed.",
      errorCode: "VALIDATION_ERROR",
      fieldErrors: z.flattenError(parsed.error).fieldErrors as Record<
        string,
        string[]
      >,
    };
  }

  const data = parsed.data;

  try {
    const category = await db.$transaction(
      async (tx) => {
        if (data.parentId) {
          const parent = await tx.category.findFirst({
            where: { id: data.parentId, deletedAt: null },
            select: { id: true, parentId: true },
          });
          if (!parent) throw new Error("PARENT_NOT_FOUND");
          if (parent.parentId !== null) throw new Error("PARENT_NOT_TOP_LEVEL");
        }

        const createData = { ...data, isVisible: false };

        const created = await tx.category.create({
          data: createData,
          select: { id: true },
        });

        await tx.auditLog.create({
          data: {
            actorType: "STAFF",
            actorId: staffId,
            action: "category.create",
            entityType: "Category",
            entityId: created.id,
            after: createData,
          },
        });

        return created;
      },
      { isolationLevel: "Serializable" },
    );

    revalidatePath("/admin/categories");
    revalidatePath("/[locale]", "layout");

    return { success: true, data: { id: category.id } };
  } catch (err) {
    return handleCategoryError(err, "createCategoryAction");
  }
}

export async function updateCategoryAction(
  id: string,
  raw: unknown,
): Promise<CategoryActionResult> {
  const demoRefusal = await demoGate("catalog:write");
  if (demoRefusal) return demoRefusal;

  const { id: staffId } = await requireStaffAction("catalog:write");

  const parsed = UpdateCategorySchema.safeParse(raw);
  if (!parsed.success) {
    return {
      success: false,
      error: "Validation failed.",
      errorCode: "VALIDATION_ERROR",
      fieldErrors: z.flattenError(parsed.error).fieldErrors as Record<
        string,
        string[]
      >,
    };
  }

  const data = parsed.data;

  try {
    await db.$transaction(
      async (tx) => {
        const category = await tx.category.findFirst({
          where: { id, deletedAt: null },
          select: {
            id: true,
            nameEn: true,
            nameAr: true,
            nameRu: true,
            slug: true,
            parentId: true,
            displayOrder: true,
            navGroup: true,
            _count: {
              select: {
                children: { where: { deletedAt: null } },
              },
            },
          },
        });
        if (!category) throw new Error("NOT_FOUND");

        if (data.parentId) {
          if (data.parentId === id) throw new Error("SELF_PARENT");
          if (category._count.children > 0) {
            throw new CategoryRefusal("HAS_CHILDREN", HAS_CHILDREN_MOVE_TEXT);
          }
          const parent = await tx.category.findFirst({
            where: { id: data.parentId, deletedAt: null },
            select: { id: true, parentId: true },
          });
          if (!parent) throw new Error("PARENT_NOT_FOUND");
          if (parent.parentId !== null) throw new Error("PARENT_NOT_TOP_LEVEL");
        }

        if (data.slug !== category.slug) {
          const slugConflict = await tx.category.findFirst({
            where: { slug: data.slug, id: { not: id }, deletedAt: null },
            select: { id: true },
          });
          if (slugConflict) throw new Error("SLUG_TAKEN");
        }

        await tx.category.update({ where: { id }, data });

        await tx.auditLog.create({
          data: {
            actorType: "STAFF",
            actorId: staffId,
            action: "category.update",
            entityType: "Category",
            entityId: id,
            before: {
              nameEn: category.nameEn,
              nameAr: category.nameAr,
              nameRu: category.nameRu,
              slug: category.slug,
              parentId: category.parentId,
              displayOrder: category.displayOrder,
              navGroup: category.navGroup,
            },
            after: data,
          },
        });
      },
      { isolationLevel: "Serializable" },
    );

    revalidatePath("/admin/categories");
    revalidatePath(`/admin/categories/${id}`);
    revalidatePath("/[locale]", "layout");

    return { success: true, data: { id } };
  } catch (err) {
    return handleCategoryError(err, "updateCategoryAction");
  }
}

export async function setCategoryVisibilityAction(
  id: string,
  isVisible: boolean,
): Promise<CategoryActionResult> {
  const demoRefusal = await demoGate("catalog:write");
  if (demoRefusal) return demoRefusal;

  const { id: staffId } = await requireStaffAction("catalog:write");

  try {
    const changed = await db.$transaction(
      async (tx) => {
        const category = await tx.category.findFirst({
          where: { id, deletedAt: null },
          select: { id: true, isVisible: true },
        });
        if (!category) throw new Error("NOT_FOUND");

        if (category.isVisible === isVisible) return false;

        await tx.category.update({ where: { id }, data: { isVisible } });

        await tx.auditLog.create({
          data: {
            actorType: "STAFF",
            actorId: staffId,
            action: "category.visibility",
            entityType: "Category",
            entityId: id,
            before: { isVisible: category.isVisible },
            after: { isVisible },
          },
        });

        return true;
      },
      { isolationLevel: "Serializable" },
    );

    if (changed) {
      revalidatePath("/admin/categories");
      revalidatePath(`/admin/categories/${id}`);
      revalidatePath("/[locale]", "layout");
    }

    return { success: true, data: { id } };
  } catch (err) {
    return handleCategoryError(err, "setCategoryVisibilityAction");
  }
}

export async function deleteCategoryAction(
  id: string,
): Promise<CategoryActionResult> {
  const demoRefusal = await demoGate("catalog:write", "delete");
  if (demoRefusal) return demoRefusal;

  const { id: staffId } = await requireStaffAction("catalog:write");

  try {
    await db.$transaction(
      async (tx) => {
        const category = await tx.category.findFirst({
          where: { id, deletedAt: null },
          select: {
            id: true,
            isVisible: true,
            _count: {
              select: {
                products: { where: { deletedAt: null } },
                children: { where: { deletedAt: null } },
              },
            },
          },
        });
        if (!category) throw new Error("NOT_FOUND");
        const productCount = category._count.products;
        if (productCount > 0) {
          throw new CategoryRefusal(
            "HAS_PRODUCTS",
            productCount === 1
              ? "This category still holds 1 product. Move it to another category, then delete it."
              : `This category still holds ${productCount} products. Move them to another category, then delete it.`,
          );
        }
        const childCount = category._count.children;
        if (childCount > 0) {
          throw new CategoryRefusal(
            "HAS_CHILDREN",
            childCount === 1
              ? "This category has 1 subcategory. Move or delete it first."
              : `This category has ${childCount} subcategories. Move or delete them first.`,
          );
        }

        const deletedAt = new Date();

        const productLinks = await tx.productCategory.deleteMany({
          where: { categoryId: id },
        });

        await tx.category.update({
          where: { id },
          data: { deletedAt, isVisible: false },
        });

        await tx.auditLog.create({
          data: {
            actorType: "STAFF",
            actorId: staffId,
            action: "category.delete",
            entityType: "Category",
            entityId: id,
            before: { deletedAt: null, isVisible: category.isVisible },
            after: { deletedAt: deletedAt.toISOString(), isVisible: false },
            metadata: { productLinksRemoved: productLinks.count },
          },
        });
      },
      { isolationLevel: "Serializable" },
    );

    revalidatePath("/admin/categories");
    revalidatePath(`/admin/categories/${id}`);
    revalidatePath("/[locale]", "layout");

    return { success: true, data: { id } };
  } catch (err) {
    return handleCategoryError(err, "deleteCategoryAction");
  }
}

const MoveTargetSchema = z.preprocess(
  (v) => (v === "" || v == null ? null : v),
  z.string().min(1).nullable(),
);

export async function moveCategoryAction(
  id: string,
  parentId: unknown,
): Promise<CategoryActionResult> {
  const demoRefusal = await demoGate("catalog:write");
  if (demoRefusal) return demoRefusal;

  const { id: staffId } = await requireStaffAction("catalog:write");

  const parsed = MoveTargetSchema.safeParse(parentId);
  if (!parsed.success) {
    return {
      success: false,
      error: "Validation failed.",
      errorCode: "VALIDATION_ERROR",
    };
  }
  const target = parsed.data;

  try {
    const changed = await db.$transaction(
      async (tx) => {
        const category = await tx.category.findFirst({
          where: { id, deletedAt: null },
          select: {
            id: true,
            parentId: true,
            navGroup: true,
            displayOrder: true,
            parent: { select: { nameEn: true } },
            _count: {
              select: {
                children: { where: { deletedAt: null } },
              },
            },
          },
        });
        if (!category) throw new Error("NOT_FOUND");

        if (target === category.parentId) return false;

        let toParent: string | null = null;
        if (target) {
          if (target === id) throw new Error("SELF_PARENT");
          if (category._count.children > 0) {
            throw new CategoryRefusal("HAS_CHILDREN", HAS_CHILDREN_MOVE_TEXT);
          }
          const parent = await tx.category.findFirst({
            where: { id: target, deletedAt: null },
            select: { id: true, parentId: true, nameEn: true },
          });
          if (!parent) throw new Error("PARENT_NOT_FOUND");
          if (parent.parentId !== null) throw new Error("PARENT_NOT_TOP_LEVEL");
          toParent = parent.nameEn;
        }

        const siblings = await tx.category.aggregate({
          where: { parentId: target, deletedAt: null, id: { not: id } },
          _max: { displayOrder: true },
        });
        const displayOrder =
          siblings._max.displayOrder === null
            ? 0
            : siblings._max.displayOrder + 1;
        const navGroup = target ? null : category.navGroup;

        await tx.category.update({
          where: { id },
          data: { parentId: target, displayOrder, navGroup },
        });

        await tx.auditLog.create({
          data: {
            actorType: "STAFF",
            actorId: staffId,
            action: "category.update",
            entityType: "Category",
            entityId: id,
            before: {
              parentId: category.parentId,
              displayOrder: category.displayOrder,
              navGroup: category.navGroup,
            },
            after: { parentId: target, displayOrder, navGroup },
            metadata: {
              change: "move",
              fromParent: category.parent?.nameEn ?? null,
              toParent,
            },
          },
        });

        return true;
      },
      { isolationLevel: "Serializable" },
    );

    if (changed) {
      revalidatePath("/admin/categories");
      revalidatePath(`/admin/categories/${id}`);
      revalidatePath("/[locale]", "layout");
    }

    return { success: true, data: { id } };
  } catch (err) {
    return handleCategoryError(err, "moveCategoryAction");
  }
}

const ReorderDirectionSchema = z.enum(["up", "down"]);

export async function reorderCategoryAction(
  id: string,
  direction: unknown,
): Promise<CategoryActionResult> {
  const demoRefusal = await demoGate("catalog:write");
  if (demoRefusal) return demoRefusal;

  const { id: staffId } = await requireStaffAction("catalog:write");

  const parsed = ReorderDirectionSchema.safeParse(direction);
  if (!parsed.success) {
    return {
      success: false,
      error: "Validation failed.",
      errorCode: "VALIDATION_ERROR",
    };
  }
  const dir = parsed.data;

  try {
    const changed = await db.$transaction(
      async (tx) => {
        const category = await tx.category.findFirst({
          where: { id, deletedAt: null },
          select: { id: true, parentId: true, displayOrder: true, nameEn: true },
        });
        if (!category) throw new Error("NOT_FOUND");

        const list = await tx.category.findMany({
          where: { parentId: category.parentId, deletedAt: null },
          orderBy: [{ displayOrder: "asc" }, { nameEn: "asc" }],
          select: { id: true, displayOrder: true },
        });

        const from = list.findIndex((row) => row.id === id);
        const to = dir === "up" ? from - 1 : from + 1;
        if (from === -1 || to < 0 || to >= list.length) return false;

        [list[from], list[to]] = [list[to], list[from]];

        let renumbered = 0;
        for (let i = 0; i < list.length; i++) {
          if (list[i].displayOrder === i) continue;
          await tx.category.update({
            where: { id: list[i].id },
            data: { displayOrder: i },
          });
          if (list[i].id !== id) renumbered++;
        }

        await tx.auditLog.create({
          data: {
            actorType: "STAFF",
            actorId: staffId,
            action: "category.update",
            entityType: "Category",
            entityId: id,
            before: { displayOrder: category.displayOrder },
            after: { displayOrder: to },
            metadata: {
              change: "reorder",
              direction: dir,
              position: to + 1,
              of: list.length,
              renumbered,
            },
          },
        });

        return true;
      },
      { isolationLevel: "Serializable" },
    );

    if (changed) {
      revalidatePath("/admin/categories");
      revalidatePath(`/admin/categories/${id}`);
      revalidatePath("/[locale]", "layout");
    }

    return { success: true, data: { id } };
  } catch (err) {
    return handleCategoryError(err, "reorderCategoryAction");
  }
}

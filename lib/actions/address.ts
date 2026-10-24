"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { getSessionCustomerId } from "@/lib/auth-customer";
import { db } from "@/lib/db/client";
import {
  checkoutAddressSchema,
  type CheckoutAddressInput,
} from "@/lib/validations/checkout";

export type AddressActionErrorCode =
  | "UNAUTHORIZED"
  | "VALIDATION_ERROR"
  | "ADDRESS_NOT_FOUND"
  | "ADDRESS_NOT_OWNED"
  | "CANNOT_DELETE_LAST_DEFAULT"
  | "INTERNAL_ERROR";

export type AddressActionResult<T = void> =
  | { success: true; data: T }
  | {
      success: false;
      error: string;
      errorCode: AddressActionErrorCode;
      fieldErrors?: Record<string, string[]>;
    };

const addressIdSchema = z.string().min(1);

export async function addAddressAction(
  input: unknown,
): Promise<AddressActionResult<{ addressId: string }>> {
  try {
    const session = await auth();
    const customerId = await getSessionCustomerId();
    if (session?.user?.principal !== "customer" || !customerId) {
      return {
        success: false,
        error: "Unauthorized",
        errorCode: "UNAUTHORIZED",
      };
    }

    const parsed = checkoutAddressSchema.safeParse(input);
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

    if (data.saveToProfile === false) {
      return {
        success: false,
        error: "Use placeOrder for transient addresses",
        errorCode: "VALIDATION_ERROR",
      };
    }

    const existingCount = await db.customerAddress.count({
      where: { customerId },
    });

    const isFirstAddress = existingCount === 0;

    const address = await db.customerAddress.create({
      data: {
        customerId,
        fullName: data.fullName,
        phone: data.phone,
        addressLine1: data.addressLine1,
        addressLine2: data.addressLine2 ?? null,
        city: data.city,
        emirate: data.emirate,
        postalCode: data.postalCode ?? null,
        country: data.country,
        label: data.label ?? null,
        isDefault: isFirstAddress,
      },
      select: { id: true },
    });

    revalidatePath("/[locale]/checkout", "page");
    return { success: true, data: { addressId: address.id } };
  } catch (err) {
    console.error("[addAddressAction]", err);
    return {
      success: false,
      error: "Something went wrong",
      errorCode: "INTERNAL_ERROR",
    };
  }
}

export async function updateAddressAction(
  input: { id: string } & CheckoutAddressInput,
): Promise<AddressActionResult<void>> {
  try {
    const session = await auth();
    const customerId = await getSessionCustomerId();
    if (session?.user?.principal !== "customer" || !customerId) {
      return {
        success: false,
        error: "Unauthorized",
        errorCode: "UNAUTHORIZED",
      };
    }

    const idResult = addressIdSchema.safeParse(input.id);
    if (!idResult.success) {
      return {
        success: false,
        error: "Invalid address id",
        errorCode: "VALIDATION_ERROR",
      };
    }

    const { id, ...rest } = input;
    const parsed = checkoutAddressSchema.safeParse(rest);
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

    const address = await db.customerAddress.findUnique({
      where: { id },
      select: { customerId: true },
    });

    if (!address) {
      return {
        success: false,
        error: "Address not found",
        errorCode: "ADDRESS_NOT_FOUND",
      };
    }

    if (address.customerId !== customerId) {
      return {
        success: false,
        error: "Address not found",
        errorCode: "ADDRESS_NOT_OWNED",
      };
    }

    const data = parsed.data;

    await db.customerAddress.update({
      where: { id },
      data: {
        fullName: data.fullName,
        phone: data.phone,
        addressLine1: data.addressLine1,
        addressLine2: data.addressLine2 ?? null,
        city: data.city,
        emirate: data.emirate,
        postalCode: data.postalCode ?? null,
        country: data.country,
        label: data.label ?? null,
      },
    });

    revalidatePath("/[locale]/checkout", "page");
    return { success: true, data: undefined };
  } catch (err) {
    console.error("[updateAddressAction]", err);
    return {
      success: false,
      error: "Something went wrong",
      errorCode: "INTERNAL_ERROR",
    };
  }
}

export async function deleteAddressAction(
  addressId: string,
): Promise<AddressActionResult<void>> {
  try {
    const session = await auth();
    const customerId = await getSessionCustomerId();
    if (session?.user?.principal !== "customer" || !customerId) {
      return {
        success: false,
        error: "Unauthorized",
        errorCode: "UNAUTHORIZED",
      };
    }

    const idResult = addressIdSchema.safeParse(addressId);
    if (!idResult.success) {
      return {
        success: false,
        error: "Invalid address id",
        errorCode: "VALIDATION_ERROR",
      };
    }

    const address = await db.customerAddress.findUnique({
      where: { id: addressId },
      select: { customerId: true, isDefault: true },
    });

    if (!address) {
      return {
        success: false,
        error: "Address not found",
        errorCode: "ADDRESS_NOT_FOUND",
      };
    }

    if (address.customerId !== customerId) {
      return {
        success: false,
        error: "Address not found",
        errorCode: "ADDRESS_NOT_OWNED",
      };
    }

    if (address.isDefault) {
      const allAddresses = await db.customerAddress.findMany({
        where: { customerId },
        select: { id: true },
        orderBy: { createdAt: "desc" },
      });

      if (allAddresses.length === 1) {
        return {
          success: false,
          error: "Cannot delete your only address",
          errorCode: "CANNOT_DELETE_LAST_DEFAULT",
        };
      }

      const nextDefault = allAddresses.find((a) => a.id !== addressId);

      await db.$transaction([
        db.customerAddress.delete({ where: { id: addressId } }),
        db.customerAddress.update({
          where: { id: nextDefault!.id },
          data: { isDefault: true },
        }),
      ]);
    } else {
      await db.customerAddress.delete({ where: { id: addressId } });
    }

    revalidatePath("/[locale]/checkout", "page");
    return { success: true, data: undefined };
  } catch (err) {
    console.error("[deleteAddressAction]", err);
    return {
      success: false,
      error: "Something went wrong",
      errorCode: "INTERNAL_ERROR",
    };
  }
}

export async function setDefaultAddressAction(
  addressId: string,
): Promise<AddressActionResult<void>> {
  try {
    const session = await auth();
    const customerId = await getSessionCustomerId();
    if (session?.user?.principal !== "customer" || !customerId) {
      return {
        success: false,
        error: "Unauthorized",
        errorCode: "UNAUTHORIZED",
      };
    }

    const idResult = addressIdSchema.safeParse(addressId);
    if (!idResult.success) {
      return {
        success: false,
        error: "Invalid address id",
        errorCode: "VALIDATION_ERROR",
      };
    }

    const address = await db.customerAddress.findUnique({
      where: { id: addressId },
      select: { customerId: true },
    });

    if (!address) {
      return {
        success: false,
        error: "Address not found",
        errorCode: "ADDRESS_NOT_FOUND",
      };
    }

    if (address.customerId !== customerId) {
      return {
        success: false,
        error: "Address not found",
        errorCode: "ADDRESS_NOT_OWNED",
      };
    }

    await db.$transaction([
      db.customerAddress.updateMany({
        where: { customerId },
        data: { isDefault: false },
      }),
      db.customerAddress.update({
        where: { id: addressId },
        data: { isDefault: true },
      }),
    ]);

    revalidatePath("/[locale]/checkout", "page");
    return { success: true, data: undefined };
  } catch (err) {
    console.error("[setDefaultAddressAction]", err);
    return {
      success: false,
      error: "Something went wrong",
      errorCode: "INTERNAL_ERROR",
    };
  }
}

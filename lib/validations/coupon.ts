import { z } from "zod";
import { CouponType, CustomerRole } from "@/app/generated/prisma/enums";

function optNum() {
  return z.preprocess(
    (v) => (v === "" || v == null ? null : v),
    z.coerce.number().min(0).nullable(),
  );
}

function optPosNum() {
  return z.preprocess(
    (v) => (v === "" || v == null ? null : v),
    z.coerce.number().positive().nullable(),
  );
}

function optInt() {
  return z.preprocess(
    (v) => (v === "" || v == null ? null : v),
    z.coerce.number().int().min(1).nullable(),
  );
}

function optDate() {
  return z.preprocess(
    (v) => (v === "" || v == null ? null : v),
    z.string().nullable(),
  );
}

function couponRefinements(
  d: {
    type: CouponType;
    value: number;
    maxDiscountAmount: number | null;
    startsAt: string | null;
    endsAt: string | null;
  },
  ctx: z.RefinementCtx,
) {
  if (d.type === CouponType.PERCENTAGE) {
    if (d.value < 1 || d.value > 100) {
      ctx.addIssue({
        code: "custom",
        path: ["value"],
        message: "Percentage discount must be between 1 and 100.",
      });
    }
  } else if (d.type === CouponType.FIXED) {
    if (d.value <= 0) {
      ctx.addIssue({
        code: "custom",
        path: ["value"],
        message: "Fixed discount must be greater than 0.",
      });
    }
  }
  if (d.maxDiscountAmount != null && d.type !== CouponType.PERCENTAGE) {
    ctx.addIssue({
      code: "custom",
      path: ["maxDiscountAmount"],
      message: "Max discount amount is only allowed for percentage coupons.",
    });
  }
  if (d.startsAt != null && d.endsAt != null && d.endsAt <= d.startsAt) {
    ctx.addIssue({
      code: "custom",
      path: ["endsAt"],
      message: "End date must be after start date.",
    });
  }
}

const CouponBaseObject = z.object({
  code: z
    .string()
    .trim()
    .min(1, "Code is required")
    .regex(/^[A-Za-z0-9_]+$/, "Code must contain only letters, digits, or underscores."),
  type: z.enum(CouponType, { error: "Choose a discount type." }),
  value: z.coerce.number(),
  minOrderAmount: optNum(),
  maxDiscountAmount: optPosNum(),
  usageLimit: optInt(),
  startsAt: optDate(),
  endsAt: optDate(),
  allowedRole: z.preprocess(
    (v) => (v === "" || v == null ? null : v),
    z.enum(CustomerRole, { error: "Choose who can use the code." }).nullable(),
  ),
  isActive: z.boolean().default(true),
});

export const CreateCouponSchema = CouponBaseObject.superRefine(couponRefinements);
export const UpdateCouponSchema = CouponBaseObject.omit({ code: true }).superRefine(
  couponRefinements,
);

export type CreateCouponInput = z.infer<typeof CreateCouponSchema>;
export type UpdateCouponInput = z.infer<typeof UpdateCouponSchema>;

const RotateBaseObject = z.object({
  code: z
    .string()
    .trim()
    .min(1, "Code is required")
    .regex(/^[A-Za-z0-9_]+$/, "Code must contain only letters, digits, or underscores."),
  startsAt: optDate(),
  endsAt: optDate(),
});

export const RotateCouponSchema = RotateBaseObject.superRefine((d, ctx) => {
  if (d.startsAt != null && d.endsAt != null && d.endsAt <= d.startsAt) {
    ctx.addIssue({
      code: "custom",
      path: ["endsAt"],
      message: "End date must be after start date.",
    });
  }
});

export type RotateCouponInput = z.infer<typeof RotateCouponSchema>;

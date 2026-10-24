import { z } from "zod";
import { CouponType } from "@/app/generated/prisma/enums";

function optPosNum() {
  return z.preprocess(
    (v) => (v === "" || v == null ? null : v),
    z.coerce.number().positive().nullable(),
  );
}

function optNonNegNum() {
  return z.preprocess(
    (v) => (v === "" || v == null ? null : v),
    z.coerce.number().min(0).nullable(),
  );
}

function rewardRuleRefinements(
  d: {
    rewardType: CouponType;
    rewardValue: number;
    rewardMaxDiscountAmount: number | null;
  },
  ctx: z.RefinementCtx,
) {
  if (d.rewardType === CouponType.PERCENTAGE) {
    if (d.rewardValue < 1 || d.rewardValue > 100) {
      ctx.addIssue({
        code: "custom",
        path: ["rewardValue"],
        message: "Percentage reward must be between 1 and 100.",
      });
    }
  } else if (d.rewardType === CouponType.FIXED) {
    if (d.rewardValue <= 0) {
      ctx.addIssue({
        code: "custom",
        path: ["rewardValue"],
        message: "Fixed reward must be greater than 0.",
      });
    }
  }
  if (
    d.rewardMaxDiscountAmount != null &&
    d.rewardType !== CouponType.PERCENTAGE
  ) {
    ctx.addIssue({
      code: "custom",
      path: ["rewardMaxDiscountAmount"],
      message: "Max discount amount is only allowed for percentage rewards.",
    });
  }
}

const RewardRuleBaseObject = z.object({
  name: z.string().trim().min(1, "Name is required"),
  minOrderTotal: z.coerce.number().positive(),
  rewardType: z.enum(CouponType, { error: "Choose a reward type." }),
  rewardValue: z.coerce.number(),
  rewardMaxDiscountAmount: optPosNum(),
  rewardMinOrderAmount: optNonNegNum(),
  validityDays: z.coerce.number().int().min(1),
  codePrefix: z
    .string()
    .trim()
    .min(1, "Code prefix is required")
    .regex(/^[A-Za-z0-9_]+$/, "Code prefix must contain only letters, digits, or underscores."),
  isActive: z.boolean().default(true),
});

export const CreateRewardRuleSchema = RewardRuleBaseObject.superRefine(
  rewardRuleRefinements,
);
export const UpdateRewardRuleSchema = RewardRuleBaseObject.superRefine(
  rewardRuleRefinements,
);

export type CreateRewardRuleInput = z.infer<typeof CreateRewardRuleSchema>;
export type UpdateRewardRuleInput = z.infer<typeof UpdateRewardRuleSchema>;

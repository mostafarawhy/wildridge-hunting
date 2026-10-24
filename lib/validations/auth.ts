import { z } from "zod";
import { StaffRole } from "@/app/generated/prisma/client";

export const loginSchema = z.object({
  email: z.string().min(1, "Email is required").email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
});

export const customerPasswordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .regex(
    /^(?=.*[a-zA-Z])(?=.*\d).+$/,
    "Password must contain at least one letter and one digit",
  );

export const registerSchema = z.object({
  email: z.string().min(1, "Email is required").email("Invalid email address"),
  password: customerPasswordSchema,
  name: z.string().min(1, "Name is required").max(100, "Name is too long"),
  locale: z.enum(["en", "ar", "ru"]).default("en"),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;

export const staffPasswordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .regex(
    /^(?=.*[a-zA-Z])(?=.*\d).+$/,
    "Password must contain at least one letter and one digit",
  );

export const createStaffSchema = z.object({
  name: z.string().min(1, "Name is required").max(100, "Name is too long"),
  email: z.string().min(1, "Email is required").email("Invalid email address"),
  role: z.enum(StaffRole),
  password: staffPasswordSchema,
});

export const setOwnPasswordSchema = z.object({
  newPassword: staffPasswordSchema,
});

export type CreateStaffInput = z.infer<typeof createStaffSchema>;
export type SetOwnPasswordInput = z.infer<typeof setOwnPasswordSchema>;

export const requestPasswordResetSchema = z.object({
  email: z.string().min(1, "Email is required").email("Invalid email address"),
  locale: z.enum(["en", "ar", "ru"]).default("en"),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(1, "Token is required"),
  password: customerPasswordSchema,
});

export type RequestPasswordResetInput = z.infer<
  typeof requestPasswordResetSchema
>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;

export const confirmEmailVerificationSchema = z.object({
  token: z.string().min(1, "Token is required"),
});

export type ConfirmEmailVerificationInput = z.infer<
  typeof confirmEmailVerificationSchema
>;

export const uaePassLinkSchema = z.object({
  token: z.string().min(1, "Token is required"),
  email: z.string().min(1, "Email is required").email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
});

export type UaePassLinkInput = z.infer<typeof uaePassLinkSchema>;

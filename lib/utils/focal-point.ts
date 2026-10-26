import { z } from "zod";

export const focalPointSchema = z.object({
  x: z.number().int().min(0).max(100),
  y: z.number().int().min(0).max(100),
});

export type FocalPoint = z.infer<typeof focalPointSchema>;

export { focalPosition } from "./focal-position";

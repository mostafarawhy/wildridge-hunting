import type { FocalPoint } from "./focal-point";

export function focalPosition(p: FocalPoint): string {
  return `${p.x}% ${p.y}%`;
}

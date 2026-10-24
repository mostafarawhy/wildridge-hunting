// prisma/seed/seed-utils.ts
// Shared utilities for all seed modules

import { BRAND } from "../../lib/config/brand";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { createHash } from "node:crypto";
import {
  ActionType,
  PublishStatus,
  Prisma,
} from "../../app/generated/prisma/client";

// replace your Decimal type usage with Prisma.Decimal

// ─── TYPE MAPPERS ──────────────────────────────────────────────────────────────

export function toActionType(val: string | null | undefined): ActionType {
  const map: Record<string, ActionType> = {
    Spring: ActionType.Spring,
    PCP: ActionType.PCP,
    CO2: ActionType.CO2,
    "Gas-Ram": ActionType.Gas_Ram,
    "Multi-Pump": ActionType.Multi_Pump,
    "N/A": ActionType.NA,
  };
  return map[val ?? "N/A"] ?? ActionType.NA;
}

export function toPublishStatus(val: string | null | undefined): PublishStatus {
  if (val === "PUBLISHED") return PublishStatus.PUBLISHED;
  if (val === "ARCHIVED") return PublishStatus.ARCHIVED;
  return PublishStatus.DRAFT;
}

// ─── MONEY HELPERS ────────────────────────────────────────────────────────────

export function dec(val: number | null | undefined): Prisma.Decimal | null {
  if (val == null) return null;
  return new Prisma.Decimal(val);
}

export function decRequired(val: number): Prisma.Decimal {
  return new Prisma.Decimal(val);
}

// ─── LOYALTY HELPERS ─────────────────────────────────────────────────────────

export function loyaltyPoints(price: number, override?: number | null): number {
  if (override != null && override > 0) return override;
  return Math.floor(price / 10);
}

// ─── SEO AUTO-GENERATE ────────────────────────────────────────────────────────

export function autoMetaTitle(name: string, maxLen = 60): string {
  const suffix = ` | ${BRAND.name}`;
  const base = name.slice(0, maxLen - suffix.length);
  return base + suffix;
}

export function autoMetaDesc(
  desc: string | null | undefined,
  maxLen = 160,
): string | null {
  if (!desc) return null;
  return desc.slice(0, maxLen);
}

// ─── SLUG HELPERS ─────────────────────────────────────────────────────────────

export function toSlug(str: string): string {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

// ─── STORAGE KEY CONVENTION ───────────────────────────────────────────────────
// Storage keys follow: products/{sku}/{filename}
// Allows R2/S3 prefix-listing per product

export function productStorageKey(sku: string, filename: string): string {
  return `products/${sku}/${filename}`;
}

export function categoryStorageKey(slug: string, filename: string): string {
  return `categories/${slug}/${filename}`;
}

// ─── ENVIRONMENT ──────────────────────────────────────────────────────────────

export function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `${name} is not set. Set it in .env.local (or the environment) before running the seed.`,
    );
  }
  return value;
}

// ─── ASSETS ───────────────────────────────────────────────────────────────────

const ASSET_ROOT = join(process.cwd(), "prisma", "seed", "assets");

const CONTENT_TYPES: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  mp4: "video/mp4",
};

export function assetExists(relativePath: string): boolean {
  return existsSync(join(ASSET_ROOT, relativePath));
}

export async function uploadSeedAsset(
  bucket: string,
  key: string,
  relativePath: string,
): Promise<boolean> {
  const absolute = join(ASSET_ROOT, relativePath);
  if (!existsSync(absolute)) {
    console.warn(`   ⚠️  Missing seed asset ${relativePath}, skipped`);
    return false;
  }
  const { uploadFile } = await import("../../lib/services/storage");
  const extension = relativePath.split(".").pop()?.toLowerCase() ?? "png";
  await uploadFile({
    bucket,
    path: key,
    file: readFileSync(absolute),
    contentType: CONTENT_TYPES[extension] ?? "application/octet-stream",
    upsert: true,
    trusted: true,
    cacheControl: "31536000",
  });
  return true;
}

export function hashInt(value: string): number {
  return createHash("sha1").update(value).digest().readUInt32BE(0);
}

export function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ─── LOGGING ─────────────────────────────────────────────────────────────────

export function log(emoji: string, label: string, count?: number) {
  const countStr = count != null ? ` (${count})` : "";
  console.log(`${emoji}  ${label}${countStr}`);
}

export function logSection(title: string) {
  console.log(`\n${"─".repeat(60)}`);
  console.log(`  ${title}`);
  console.log("─".repeat(60));
}

export function logDone(label: string, count: number) {
  console.log(`   ✅ ${count} ${label} seeded`);
}

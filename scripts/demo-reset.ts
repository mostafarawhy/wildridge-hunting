import "../prisma/seed/load-env";
import * as childProcess from "node:child_process";
import { existsSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import * as supabase from "@supabase/supabase-js";
import { DEMO_UPLOAD_BUCKETS } from "../lib/config/demo";

const CONTENT_ASSETS = join(process.cwd(), "prisma", "seed", "assets", "content");
const LIST_PAGE = 1000;
const DELETE_BATCH = 100;

function fail(name: string): never {
  console.error(`Demo reset refused: check failed for ${name}`);
  process.exit(1);
}

function projectRef(value: string | undefined): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    const user = decodeURIComponent(url.username);
    const dot = user.indexOf(".");
    if (dot !== -1) return user.slice(dot + 1);
    if (url.hostname.startsWith("db.")) return url.hostname.split(".")[1] ?? null;
    return url.hostname.split(".")[0] ?? null;
  } catch {
    return null;
  }
}

function guard() {
  if (process.env.NEXT_PUBLIC_DEMO_MODE !== "true") fail("NEXT_PUBLIC_DEMO_MODE");
  const ref = process.env.DEMO_PROJECT_REF ?? "";
  if (!/^[a-z0-9]{20}$/.test(ref)) fail("DEMO_PROJECT_REF");
  const names = ["DATABASE_URL", "DIRECT_URL", "SUPABASE_URL"];
  if (process.env.NEXT_PUBLIC_SUPABASE_URL) names.push("NEXT_PUBLIC_SUPABASE_URL");
  for (const name of names) {
    if (projectRef(process.env[name]) !== ref) fail(name);
  }
}

function walk(dir: string, prefix = ""): string[] {
  const found: string[] = [];
  for (const name of readdirSync(dir).sort()) {
    const absolute = join(dir, name);
    const relative = prefix ? `${prefix}/${name}` : name;
    if (statSync(absolute).isDirectory()) found.push(...walk(absolute, relative));
    else found.push(relative);
  }
  return found;
}

function contentKeys(): Map<string, Set<string>> {
  const byBucket = new Map<string, Set<string>>();
  if (!existsSync(CONTENT_ASSETS)) return byBucket;
  for (const relative of walk(CONTENT_ASSETS)) {
    const slash = relative.indexOf("/");
    if (slash === -1) throw new Error(`Asset ${relative} must sit in a bucket folder`);
    const bucket = relative.slice(0, slash);
    const set = byBucket.get(bucket) ?? new Set<string>();
    set.add(relative.slice(slash + 1));
    byBucket.set(bucket, set);
  }
  return byBucket;
}

function runStep(label: string, command: string, args: string[]) {
  console.log(`\n> ${label}`);
  const started = Date.now();
  childProcess.execFileSync(command, args, { stdio: "inherit", env: process.env });
  console.log(`  ${label} took ${((Date.now() - started) / 1000).toFixed(1)}s`);
}

async function listAll(
  client: supabase.SupabaseClient,
  bucket: string,
  prefix = "",
): Promise<string[]> {
  const keys: string[] = [];
  for (let offset = 0; ; offset += LIST_PAGE) {
    const { data, error } = await client.storage
      .from(bucket)
      .list(prefix, { limit: LIST_PAGE, offset });
    if (error) throw new Error(error.message);
    for (const entry of data) {
      const path = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (entry.id === null) keys.push(...(await listAll(client, bucket, path)));
      else keys.push(path);
    }
    if (data.length < LIST_PAGE) break;
  }
  return keys;
}

async function sweep(
  client: supabase.SupabaseClient,
  content: Map<string, Set<string>>,
  dryRun: boolean,
) {
  for (const bucket of DEMO_UPLOAD_BUCKETS) {
    const keep = content.get(bucket) ?? new Set<string>();
    const all = await listAll(client, bucket);
    const stale = all.filter((key) => !key.startsWith("seed/") && !keep.has(key));
    const kept = all.length - stale.length;
    if (dryRun) {
      for (const key of stale) console.log(`  would delete ${bucket}/${key}`);
      console.log(`${bucket}: ${kept} kept, ${stale.length} would be deleted`);
      continue;
    }
    for (let i = 0; i < stale.length; i += DELETE_BATCH) {
      const batch = stale.slice(i, i + DELETE_BATCH);
      const { error } = await client.storage.from(bucket).remove(batch);
      if (error) throw new Error(error.message);
      for (const key of batch) console.log(`  deleted ${bucket}/${key}`);
    }
    console.log(`${bucket}: ${kept} kept, ${stale.length} deleted`);
  }
}

async function main() {
  guard();

  const content = contentKeys();
  if ((content.get("product-images")?.size ?? 0) === 0) {
    console.error("Demo reset refused: no product-images keys in prisma/seed/assets/content");
    process.exit(1);
  }

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) throw new Error("SUPABASE_SERVICE_ROLE_KEY is not set");
  const client = supabase.createClient(process.env.SUPABASE_URL as string, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  if (process.argv.includes("--check")) {
    console.log("Guard and content check passed. Sweep candidates:");
    await sweep(client, content, true);
    return;
  }

  const started = Date.now();
  runStep("prisma migrate reset", "npx", ["prisma", "migrate", "reset", "--force"]);
  runStep("seed", "npm", ["run", "seed"]);

  console.log("\n> storage sweep");
  await sweep(client, content, false);

  console.log(`\nDemo reset complete in ${((Date.now() - started) / 1000).toFixed(1)}s`);
}

main().catch((err) => {
  console.error("Demo reset failed:", err instanceof Error ? err.message : err);
  process.exit(1);
});

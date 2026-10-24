import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { env } from "@/lib/env";
import {
  DEMO_UPLOAD_BUCKETS,
  DEMO_UPLOAD_MESSAGE,
  isDemoMode,
} from "@/lib/config/demo";

const globalForStorage = globalThis as unknown as {
  storageClient: SupabaseClient | undefined;
};

function getStorageClient(): SupabaseClient {
  if (globalForStorage.storageClient) return globalForStorage.storageClient;

  const client = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  if (process.env.NODE_ENV !== "production") {
    globalForStorage.storageClient = client;
  }

  return client;
}

export interface UploadFileInput {
  bucket: string;
  path: string;
  file: Buffer | Blob | File;
  contentType: string;
  upsert?: boolean;
  trusted?: boolean;
  cacheControl?: string;
}

export interface UploadFileResult {
  storageKey: string;
}

export async function uploadFile(
  input: UploadFileInput,
): Promise<UploadFileResult> {
  const {
    bucket,
    path,
    file,
    contentType,
    upsert = false,
    trusted = false,
    cacheControl,
  } = input;

  if (isDemoMode() && !trusted && !DEMO_UPLOAD_BUCKETS.includes(bucket)) {
    throw new Error(DEMO_UPLOAD_MESSAGE);
  }

  const { error } = await getStorageClient()
    .storage.from(bucket)
    .upload(path, file, {
      contentType,
      upsert,
      ...(cacheControl !== undefined ? { cacheControl } : {}),
    });

  if (error) {
    throw new Error(
      `[storage] Failed to upload file to ${bucket}/${path}: ${error.message}`,
    );
  }

  return { storageKey: path };
}

export async function downloadFile(
  bucket: string,
  path: string,
): Promise<Blob> {
  const { data, error } = await getStorageClient()
    .storage.from(bucket)
    .download(path);

  if (error || !data) {
    throw new Error(
      `[storage] Failed to download file ${bucket}/${path}: ${error?.message ?? "no data returned"}`,
    );
  }

  return data;
}

export async function createSignedUrl(
  bucket: string,
  path: string,
  expiresInSeconds: number,
  options?: { download?: boolean | string },
): Promise<string> {
  const { data, error } = await getStorageClient()
    .storage.from(bucket)
    .createSignedUrl(path, expiresInSeconds, options);

  if (error || !data?.signedUrl) {
    throw new Error(
      `[storage] Failed to create signed URL for ${bucket}/${path}: ${error?.message ?? "no URL returned"}`,
    );
  }

  return data.signedUrl;
}

export async function deleteFile(bucket: string, path: string): Promise<void> {
  const { error } = await getStorageClient()
    .storage.from(bucket)
    .remove([path]);

  if (error) {
    throw new Error(
      `[storage] Failed to delete file ${bucket}/${path}: ${error.message}`,
    );
  }
}

export async function createSignedUploadUrl(
  bucket: string,
  path: string,
): Promise<{ signedUrl: string; token: string; path: string }> {
  if (isDemoMode() && !DEMO_UPLOAD_BUCKETS.includes(bucket)) {
    throw new Error(DEMO_UPLOAD_MESSAGE);
  }

  const { data, error } = await getStorageClient()
    .storage.from(bucket)
    .createSignedUploadUrl(path);

  if (error || !data?.signedUrl) {
    throw new Error(
      `[storage] Failed to create signed upload URL for ${bucket}/${path}: ${error?.message ?? "no URL returned"}`,
    );
  }

  return { signedUrl: data.signedUrl, token: data.token, path: data.path };
}

const LIST_PAGE_SIZE = 1000;

export async function listFiles(
  bucket: string,
  prefix: string,
): Promise<{ name: string; size: number | null; mimetype: string | null }[]> {
  const files: { name: string; size: number | null; mimetype: string | null }[] = [];

  for (let offset = 0; ; offset += LIST_PAGE_SIZE) {
    const { data, error } = await getStorageClient()
      .storage.from(bucket)
      .list(prefix, { limit: LIST_PAGE_SIZE, offset });

    if (error) {
      throw new Error(
        `[storage] Failed to list files in ${bucket}/${prefix}: ${error.message}`,
      );
    }

    const page = data ?? [];
    for (const entry of page) {
      files.push({
        name: `${prefix}/${entry.name}`,
        size: entry.metadata?.size ?? null,
        mimetype: entry.metadata?.mimetype ?? null,
      });
    }
    if (page.length < LIST_PAGE_SIZE) break;
  }

  return files;
}

export async function deleteFiles(
  bucket: string,
  paths: string[],
): Promise<void> {
  if (paths.length === 0) return;

  const { error } = await getStorageClient().storage.from(bucket).remove(paths);

  if (error) {
    throw new Error(
      `[storage] Failed to delete ${paths.length} files from ${bucket}: ${error.message}`,
    );
  }
}

const PUBLIC_READ_TIMEOUT_MS = 10_000;

export async function readPublicObjectHead(
  bucket: string,
  path: string,
  bytes: number,
): Promise<Uint8Array> {
  const { data } = getStorageClient().storage.from(bucket).getPublicUrl(path);

  const response = await fetch(data.publicUrl, {
    headers: { Range: `bytes=0-${bytes - 1}` },
    cache: "no-store",
    signal: AbortSignal.timeout(PUBLIC_READ_TIMEOUT_MS),
  });

  if (!response.ok) {
    throw new Error(
      `[storage] Failed to read ${bucket}/${path}: HTTP ${response.status}`,
    );
  }

  return new Uint8Array(await response.arrayBuffer()).subarray(0, bytes);
}

const UPLOAD_CONCURRENCY = 4;

export async function uploadImportImages(
  uploads: { name: string; signedUrl: string }[],
  files: Map<string, File>,
  onProgress: (done: number, total: number) => void,
): Promise<{ failed: string[] }> {
  const failed: string[] = [];
  const total = uploads.length;
  let next = 0;
  let done = 0;

  async function sendOne(upload: { name: string; signedUrl: string }): Promise<boolean> {
    const file = files.get(upload.name);
    if (!file) return false;
    try {
      const body = new FormData();
      body.append("cacheControl", "3600");
      body.append("", file);
      const response = await fetch(upload.signedUrl, {
        method: "PUT",
        headers: { "x-upsert": "false" },
        body,
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  async function worker(): Promise<void> {
    while (next < total) {
      const upload = uploads[next++];
      if (!(await sendOne(upload))) failed.push(upload.name);
      done++;
      onProgress(done, total);
    }
  }

  await Promise.all(Array.from({ length: Math.min(UPLOAD_CONCURRENCY, total) }, worker));

  return { failed };
}

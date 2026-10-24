import { execFileSync } from "node:child_process";
import {
  existsSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { basename, dirname, extname, join } from "node:path";

const CONTENT_ASSETS = join(process.cwd(), "prisma", "seed", "assets", "content");
const CONTENT_FILE = join(process.cwd(), "prisma", "seed", "content", "content.json");
const MARKER = "wr-optimized";
const MiB = 1024 * 1024;
const BUCKET_LIMITS = { "product-images": 5 * MiB, "site-media": 20 * MiB };
const JPEG_ARGS = [
  "-auto-orient",
  "-resize",
  "2560x2560>",
  "-strip",
  "-set",
  "comment",
  MARKER,
  "-sampling-factor",
  "4:2:0",
  "-interlace",
  "JPEG",
  "-quality",
  "82",
];

function run(command, args) {
  return execFileSync(command, args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
}

function walk(dir, prefix = "") {
  const found = [];
  for (const name of readdirSync(dir).sort()) {
    const absolute = join(dir, name);
    const relative = prefix ? `${prefix}/${name}` : name;
    if (statSync(absolute).isDirectory()) found.push(...walk(absolute, relative));
    else found.push(relative);
  }
  return found;
}

function imageComment(file) {
  return run("magick", ["identify", "-format", "%c", `${file}[0]`]).trim();
}

function imageDimensions(file) {
  return run("magick", ["identify", "-format", "%wx%h", `${file}[0]`]).trim();
}

function videoComment(file) {
  return run("ffprobe", [
    "-v",
    "error",
    "-show_entries",
    "format_tags=comment",
    "-of",
    "default=noprint_wrappers=1:nokey=1",
    file,
  ]).trim();
}

function videoDimensions(file) {
  return run("ffprobe", [
    "-v",
    "error",
    "-select_streams",
    "v:0",
    "-show_entries",
    "stream=width,height",
    "-of",
    "csv=s=x:p=0",
    file,
  ]).trim();
}

function isOpaque(file) {
  return run("magick", ["identify", "-format", "%[opaque]", `${file}[0]`]).trim().toLowerCase() === "true";
}

function tempPath(file, extension) {
  return join(dirname(file), `.tmp-${basename(file, extname(file))}${extension}`);
}

function convertJpeg(input, output) {
  const tmp = tempPath(output, ".jpg");
  run("magick", [input, ...JPEG_ARGS, tmp]);
  return tmp;
}

function format(bytes) {
  return `${(bytes / 1024).toFixed(0)} KiB`;
}

const rows = [];
const totals = { before: 0, after: 0, skipped: 0, compressed: 0, converted: 0 };

for (const relative of walk(CONTENT_ASSETS)) {
  const slash = relative.indexOf("/");
  if (slash === -1) throw new Error(`Asset ${relative} must sit in a bucket folder`);
  const bucket = relative.slice(0, slash);
  const key = relative.slice(slash + 1);
  const file = join(CONTENT_ASSETS, relative);
  const extension = extname(file).toLowerCase();
  const isVideo = extension === ".mp4";
  const isImage = [".jpg", ".jpeg", ".png"].includes(extension);

  const sizeBefore = statSync(file).size;
  let finalPath = file;
  let action = "skipped";
  let dimsBefore = "-";

  if (isImage || isVideo) {
    dimsBefore = isVideo ? videoDimensions(file) : imageDimensions(file);
    const marked = (isVideo ? videoComment(file) : imageComment(file)) === MARKER;

    if (!marked) {
      if (isVideo) {
        const tmp = tempPath(file, ".mp4");
        run("ffmpeg", [
          "-y",
          "-i",
          file,
          "-map_metadata",
          "-1",
          "-metadata",
          `comment=${MARKER}`,
          "-an",
          "-vf",
          "scale=-2:'min(1080,ih)'",
          "-c:v",
          "libx264",
          "-preset",
          "veryfast",
          "-crf",
          "24",
          "-profile:v",
          "high",
          "-pix_fmt",
          "yuv420p",
          "-movflags",
          "+faststart",
          tmp,
        ]);
        renameSync(tmp, file);
        action = "compressed";
      } else if (extension === ".png" && isOpaque(file)) {
        const oldKey = key;
        const newKey = `${key.slice(0, -extname(key).length)}.jpg`;
        const target = join(dirname(file), basename(newKey));
        if (existsSync(target)) throw new Error(`${relative}: ${basename(newKey)} already exists`);
        const json = readFileSync(CONTENT_FILE, "utf8");
        const occurrences = json.split(oldKey).length - 1;
        if (occurrences === 0) throw new Error(`${relative}: key ${oldKey} not found in content.json`);
        const tmp = convertJpeg(file, target);
        renameSync(tmp, target);
        rmSync(file);
        writeFileSync(CONTENT_FILE, json.split(oldKey).join(newKey));
        finalPath = target;
        action = "converted";
      } else if (extension === ".png") {
        const tmp = tempPath(file, ".png");
        run("magick", [
          file,
          "-resize",
          "2560x2560>",
          "-strip",
          "-set",
          "comment",
          MARKER,
          "-define",
          "png:compression-level=9",
          tmp,
        ]);
        renameSync(tmp, file);
        action = "compressed";
      } else {
        const tmp = convertJpeg(file, file);
        renameSync(tmp, file);
        action = "compressed";
      }
    }
  }

  const sizeAfter = statSync(finalPath).size;
  const dimsAfter = isImage || isVideo ? (isVideo ? videoDimensions(finalPath) : imageDimensions(finalPath)) : "-";
  const limit = BUCKET_LIMITS[bucket];
  if (limit !== undefined && sizeAfter > limit) {
    throw new Error(`${relative}: ${sizeAfter} bytes exceeds the ${limit} byte limit for ${bucket}`);
  }

  const shownPath = finalPath === file ? relative : `${dirname(relative)}/${basename(finalPath)}`;
  rows.push(
    `${shownPath}\t${format(sizeBefore)} → ${format(sizeAfter)}\t${dimsBefore} → ${dimsAfter}\t${action}`,
  );
  totals.before += sizeBefore;
  totals.after += sizeAfter;
  totals[action] += 1;
}

console.log("path\tsize\tdimensions\taction");
for (const row of rows) console.log(row);
console.log(
  `\n${rows.length} files: ${totals.compressed} compressed, ${totals.converted} converted, ${totals.skipped} skipped`,
);
console.log(`total ${format(totals.before)} → ${format(totals.after)}`);

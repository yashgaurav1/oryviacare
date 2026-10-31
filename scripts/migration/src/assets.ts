// Downloads original brand media from the approved source host into local storage.
// Derivative sizes (e.g. -300x300.jpg) are recorded but not downloaded; derivatives are regenerated.
// Usage: npm run source:assets
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { imageSize } from "image-size";
import { politeFetch, sha256 } from "./http.js";
import { DATA_DIR, REPO_ROOT, writeJson } from "./paths.js";

const MAX_BYTES = 15 * 1024 * 1024;
const ALLOWED: Record<string, string> = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp", "image/gif": "gif", "image/avif": "avif" };
const PUBLIC_DIR = join(REPO_ROOT, "storage", "public", "media");
mkdirSync(PUBLIC_DIR, { recursive: true });

const manifest = JSON.parse(readFileSync(join(DATA_DIR, "assets.manifest.json"), "utf8"));
const derivative = /-\d{2,4}x\d{2,4}\.(png|jpe?g|webp|gif)$/i;
const isElementorThumb = /\/elementor\/thumbs\//;

/** Sniff magic bytes; never trust the server's content-type alone. */
function sniff(buf: Buffer): string | null {
  if (buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "image/png";
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "image/jpeg";
  if (buf.subarray(0, 4).toString("ascii") === "RIFF" && buf.subarray(8, 12).toString("ascii") === "WEBP") return "image/webp";
  if (buf.subarray(0, 3).toString("ascii") === "GIF") return "image/gif";
  if (buf.subarray(4, 12).toString("ascii").startsWith("ftypavi")) return "image/avif";
  return null;
}

let downloaded = 0, skipped = 0, failed = 0;
for (const a of manifest.assets) {
  const url: string = a.original_url;
  if (derivative.test(url) || isElementorThumb.test(url)) {
    a.download_state = "derivative_not_downloaded";
    a.original_candidate = url.replace(derivative, ".$1");
    skipped++;
    continue;
  }
  if (a.checksum_sha256 && a.storage_key && existsSync(join(REPO_ROOT, "storage", a.storage_key))) {
    skipped++;
    continue;
  }
  try {
    const r = await politeFetch(url, { maxBytes: MAX_BYTES, accept: "image/*" });
    if (r.status !== 200) throw new Error(`status ${r.status}`);
    const mime = sniff(r.body);
    if (!mime || !ALLOWED[mime]) throw new Error(`unrecognised image bytes (declared ${r.contentType})`);
    const checksum = sha256(r.body);
    const key = `public/media/${checksum.slice(0, 32)}.${ALLOWED[mime]}`;
    writeFileSync(join(REPO_ROOT, "storage", key), r.body);
    let dims: { width?: number; height?: number } = {};
    try {
      dims = imageSize(r.body);
    } catch {
      /* dimensions unknown */
    }
    Object.assign(a, {
      checksum_sha256: checksum,
      storage_key: key,
      mime,
      size_bytes: r.body.length,
      width: dims.width ?? a.width,
      height: dims.height ?? a.height,
      fetched_at: r.fetchedAt,
      download_state: "downloaded",
    });
    downloaded++;
    console.log(`↓ ${key} ${url}`);
  } catch (err) {
    a.download_state = "failed";
    a.download_error = String((err as Error).message);
    failed++;
    console.log(`✗ ${url} ${a.download_error}`);
  }
}
manifest.downloaded_at = new Date().toISOString();
writeJson("assets.manifest.json", manifest);
console.log(JSON.stringify({ downloaded, skipped, failed }));

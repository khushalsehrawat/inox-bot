import "server-only";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { RowDataPacket } from "mysql2/promise";
import { mysqlTransaction, websitePool } from "./web-mysql.mjs";
import { usesMysql, webDataDirectory } from "./web-taxonomy";

function location(url: string) {
  const match = /^\/api\/web\/(product-media|category-images)\/([a-f0-9-]{36}\.(?:webp|pdf))$/.exec(url);
  if (!match || (match[1] === "category-images" && !match[2].endsWith(".webp"))) throw new Error("Invalid media URL.");
  return { folder: match[1] === "product-media" ? "product-media" : "media", filename: match[2] };
}
export async function saveWebsiteMedia(url: string, bytes: Buffer, mime: string) {
  const file = location(url);
  if (usesMysql()) {
    await mysqlTransaction(async c => {
      await c.execute("INSERT INTO web_media(url,mime,byte_length,sha256) VALUES(?,?,?,?)", [url,mime,bytes.length,createHash("sha256").update(bytes).digest("hex")]);
      await c.execute("INSERT INTO web_media_content(url,content) VALUES(?,?)", [url,bytes]);
    });
    return;
  }
  const directory = join(webDataDirectory(),file.folder);
  await mkdir(directory,{recursive:true});
  await writeFile(join(directory,file.filename),bytes,{flag:"wx",mode:0o640});
}
export async function readWebsiteMedia(url: string): Promise<Buffer> {
  const file = location(url);
  if (usesMysql()) {
    const [rows] = await websitePool().execute<RowDataPacket[]>("SELECT c.content,m.byte_length,m.sha256 FROM web_media_content c JOIN web_media m ON m.url=c.url WHERE c.url=?",[url]);
    if (!rows.length) throw new Error("Media not found.");
    const bytes = Buffer.from(rows[0].content);
    if (bytes.length !== rows[0].byte_length || createHash("sha256").update(bytes).digest("hex") !== rows[0].sha256) throw new Error("Media integrity check failed.");
    return bytes;
  }
  return readFile(join(webDataDirectory(),file.folder,file.filename));
}
export async function websiteMediaExists(url: string) {
  location(url);
  if (usesMysql()) {
    const [rows] = await websitePool().execute<RowDataPacket[]>("SELECT url FROM web_media_content WHERE url=?",[url]);
    return rows.length === 1;
  }
  try { await readWebsiteMedia(url); return true; } catch { return false; }
}

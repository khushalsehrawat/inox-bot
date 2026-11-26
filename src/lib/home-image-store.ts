import "server-only";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import type { RowDataPacket } from "mysql2/promise";
import { websitePool } from "./web-mysql.mjs";
import { getPublicWebCategories, usesMysql, webDataDirectory } from "./web-taxonomy";
import { homeImages, homeCollectionImage, type HomeImage } from "./home-images";
import { TaxonomyError } from "./web-taxonomy-store.mjs";
import { websiteMediaExists } from "./website-media";

async function database() {
  const pool = websitePool();
  await pool.execute("CREATE TABLE IF NOT EXISTS web_home_images (id VARCHAR(191) PRIMARY KEY, body JSON NOT NULL)");
  return pool;
}
async function overrides(): Promise<Record<string, { src: string; alt: string; zoom?: number; positionX?: number; positionY?: number }>> {
  if (usesMysql()) {
    const [rows] = await (await database()).execute<RowDataPacket[]>("SELECT id,body FROM web_home_images");
    return Object.fromEntries(rows.map(r => [r.id, typeof r.body === "string" ? JSON.parse(r.body) : r.body]));
  }
  try { return JSON.parse(await readFile(join(webDataDirectory(), "home-images.json"), "utf8")); }
  catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") return {}; throw error; }
}
export async function getHomeImages(): Promise<HomeImage[]> {
  const [saved, categories] = await Promise.all([overrides(), getPublicWebCategories()]);
  return [...homeImages, ...categories.filter(c => !c.parentId).map(c => ({ id: `collection-${c.id}`, name: c.name, section: "Collections / scrolling strip", src: homeCollectionImage(c), alt: `${c.name} interior inspiration` }))]
    .map(image => ({ ...image, ...saved[image.id] }));
}
export async function saveHomeImage(input: { id?: unknown; src?: unknown; alt?: unknown; zoom?: unknown; positionX?: unknown; positionY?: unknown }) {
  const images = await getHomeImages();
  if (typeof input.id !== "string" || !images.some(image => image.id === input.id)) throw new TaxonomyError(404, "Homepage image not found.");
  const current = images.find(image => image.id === input.id)!;
  if (input.src !== current.src && (typeof input.src !== "string" || !/^\/api\/web\/product-media\/[a-f0-9-]{36}\.webp$/.test(input.src) || !await websiteMediaExists(input.src))) throw new TaxonomyError(422, "Upload a replacement image before saving.");
  if (typeof input.alt !== "string" || !input.alt.trim() || input.alt.length > 500) throw new TaxonomyError(422, "Enter an image description up to 500 characters.");
  const zoom = input.zoom ?? current.zoom ?? 1;
  const positionX = input.positionX ?? current.positionX ?? 50;
  const positionY = input.positionY ?? current.positionY ?? 50;
  if (typeof zoom !== "number" || !Number.isFinite(zoom) || zoom < 0.5 || zoom > 2 ||
      typeof positionX !== "number" || !Number.isFinite(positionX) || positionX < 0 || positionX > 100 ||
      typeof positionY !== "number" || !Number.isFinite(positionY) || positionY < 0 || positionY > 100)
    throw new TaxonomyError(422, "Choose zoom between 50% and 200% and positions between 0 and 100.");
  const value = { src: input.src as string, alt: input.alt.trim(), zoom, positionX, positionY };
  if (usesMysql()) await (await database()).execute("INSERT INTO web_home_images(id,body) VALUES(?,?) ON DUPLICATE KEY UPDATE body=VALUES(body)", [input.id, JSON.stringify(value)]);
  else {
    const saved = await overrides();
    saved[input.id as string] = value;
    const directory = webDataDirectory();
    await mkdir(directory, { recursive: true });
    const temp = join(directory, `home-images-${randomUUID()}.tmp`);
    await writeFile(temp, JSON.stringify(saved), { mode: 0o640 });
    await rename(temp, join(directory, "home-images.json"));
  }
  return { ...images.find(image => image.id === input.id)!, ...value };
}

import "server-only";
import { mkdir, readFile, writeFile, rename } from "node:fs/promises";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import type { RowDataPacket, ResultSetHeader } from "mysql2/promise";
import { defaultEventAlbums, type EventAlbum, type EventPhoto } from "./event-albums";
import { websitePool } from "./web-mysql.mjs";
import { usesMysql, webDataDirectory } from "./web-taxonomy";
import { websiteMediaExists } from "./website-media";
import { TaxonomyError } from "./web-taxonomy-store.mjs";

let ready: Promise<ReturnType<typeof websitePool>> | undefined;
async function initializeDatabase() {
  const pool = websitePool();
  await pool.execute("CREATE TABLE IF NOT EXISTS web_event_albums (id VARCHAR(191) PRIMARY KEY, version INT NOT NULL, body JSON NOT NULL)");
  for (const album of defaultEventAlbums) await pool.execute("INSERT IGNORE INTO web_event_albums(id,version,body) VALUES(?,1,?)", [album.id, JSON.stringify(album)]);
  return pool;
}
function database() {
  if (!ready) ready = initializeDatabase().catch(error => { ready = undefined; throw error; });
  return ready;
}
async function localAlbums(): Promise<EventAlbum[]> {
  try { return JSON.parse(await readFile(join(webDataDirectory(), "event-albums.json"), "utf8")); }
  catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") return structuredClone(defaultEventAlbums); throw error; }
}
export async function getEventAlbums(): Promise<EventAlbum[]> {
  if (!usesMysql()) return localAlbums();
  const [rows] = await (await database()).execute<RowDataPacket[]>("SELECT body,version FROM web_event_albums");
  const saved = rows.map(row => ({ ...(typeof row.body === "string" ? JSON.parse(row.body) : row.body), version: row.version })) as EventAlbum[];
  return defaultEventAlbums.map(album => saved.find(item => item.id === album.id)!);
}
function text(value: unknown, name: string, max: number) {
  if (typeof value !== "string" || !value.trim() || value.length > max) throw new TaxonomyError(422, `Enter ${name} up to ${max} characters.`);
  return value.trim();
}
async function photo(value: unknown): Promise<EventPhoto> {
  if (!value || typeof value !== "object") throw new TaxonomyError(422, "Choose a valid event photo.");
  const input = value as Record<string, unknown>;
  const src = text(input.src, "a photo URL", 300);
  const bundled = defaultEventAlbums.some(a => a.photos.some(p => p.src === src));
  if (!bundled && (!/^\/api\/web\/product-media\/[a-f0-9-]{36}\.webp$/.test(src) || !await websiteMediaExists(src))) throw new TaxonomyError(422, "Upload an event photo before saving.");
  return { src, alt: text(input.alt, "an image description", 500), city: text(input.city, "a photo location", 100) };
}
let localSave: Promise<unknown> = Promise.resolve();
export async function saveEventAlbum(value: unknown): Promise<EventAlbum> {
  if (!value || typeof value !== "object") throw new TaxonomyError(400, "Invalid event details.");
  const input = value as Record<string, unknown>;
  const id = text(input.id, "an event ID", 100);
  if (!defaultEventAlbums.some(album => album.id === id)) throw new TaxonomyError(404, "Event not found.");
  if (!Number.isSafeInteger(input.version) || (input.version as number) < 1) throw new TaxonomyError(422, "Refresh this event before saving.");
  if (!Array.isArray(input.photos) || !input.photos.length || input.photos.length > 250) throw new TaxonomyError(422, "Keep between 1 and 250 photos in each event.");
  const photos: EventPhoto[] = [];
  for (const item of input.photos) photos.push(await photo(item));
  if (new Set(photos.map(p => p.src)).size !== photos.length) throw new TaxonomyError(422, "Each photo can appear only once in an event.");
  const cover = photos.find(p => p.src === (input.cover as EventPhoto | undefined)?.src);
  if (!cover) throw new TaxonomyError(422, "Choose a cover from this event's photos.");
  const album: EventAlbum = { id, version: (input.version as number) + 1, title: text(input.title, "a title", 120), label: text(input.label, "a category", 100), location: text(input.location, "a location", 100), description: text(input.description, "event details", 2000), cover, photos };
  const conflict = () => new TaxonomyError(409, "This event changed in another session. Refresh the events and try again.");
  if (usesMysql()) {
    const [result] = await (await database()).execute<ResultSetHeader>("UPDATE web_event_albums SET body=?,version=? WHERE id=? AND version=?", [JSON.stringify(album), album.version, id, input.version as number]);
    if (result.affectedRows !== 1) throw conflict();
  } else {
    const work = localSave.catch(() => {}).then(async () => {
      const albums = await localAlbums();
      const index = albums.findIndex(a => a.id === id);
      if (index < 0 || albums[index].version !== input.version) throw conflict();
      albums[index] = album;
      const directory = webDataDirectory();
      await mkdir(directory, { recursive: true });
      const temp = join(directory, `events-${randomUUID()}.tmp`);
      await writeFile(temp, JSON.stringify(albums), { mode: 0o640 });
      await rename(temp, join(directory, "event-albums.json"));
    });
    localSave = work;
    await work;
  }
  return album;
}

import "server-only";
import { mkdir, readFile, writeFile, rename } from "node:fs/promises";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import type { RowDataPacket, ResultSetHeader } from "mysql2/promise";
import { blogSlug, type BlogPost } from "./blog-model";
import { websitePool } from "./web-mysql.mjs";
import { usesMysql, webDataDirectory } from "./web-taxonomy";
import { websiteMediaExists } from "./website-media";
import { TaxonomyError } from "./web-taxonomy-store.mjs";

let ready: Promise<ReturnType<typeof websitePool>> | undefined;
async function database() {
  if (!ready) ready = (async () => {
    const pool = websitePool();
    await pool.execute("CREATE TABLE IF NOT EXISTS web_blog_posts (slug VARCHAR(191) PRIMARY KEY, version INT NOT NULL, body JSON NOT NULL)");
    return pool;
  })().catch(error => { ready = undefined; throw error; });
  return ready;
}
async function localPosts(): Promise<BlogPost[]> {
  try { return JSON.parse(await readFile(join(webDataDirectory(), "blog-posts.json"), "utf8")); }
  catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") return []; throw error; }
}
export async function getBlogPosts(publicOnly = true): Promise<BlogPost[]> {
  let posts: BlogPost[];
  if (!usesMysql()) posts = await localPosts();
  else {
    const [rows] = await (await database()).execute<RowDataPacket[]>("SELECT body,version FROM web_blog_posts");
    posts = rows.map(row => ({ ...(typeof row.body === "string" ? JSON.parse(row.body) : row.body), version: row.version }));
  }
  return publicOnly ? posts.filter(post => post.published) : posts;
}
export async function getSavedBlogPost(slug: string) { return (await getBlogPosts()).find(post => post.slug === slug); }
function text(value: unknown, label: string, max: number) {
  if (typeof value !== "string" || !value.trim() || value.length > max) throw new TaxonomyError(422, `Enter ${label} up to ${max} characters.`);
  return value.trim();
}
let localSave: Promise<unknown> = Promise.resolve();
export async function saveBlogPost(value: unknown): Promise<BlogPost> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new TaxonomyError(400, "Invalid blog details.");
  const input = value as Record<string, unknown>;
  const title = text(input.title, "an H1 heading", 240);
  const slug = text(input.slug || blogSlug(title), "a blog address", 150);
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) throw new TaxonomyError(422, "Use letters, numbers and hyphens for the blog address.");
  if (!Number.isSafeInteger(input.version) || (input.version as number) < 0 || typeof input.published !== "boolean") throw new TaxonomyError(422, "Refresh this blog before saving.");
  const image = text(input.image, "a cover image", 300);
  const previous = (input.version as number) > 0 ? (await getBlogPosts(false)).find(post => post.slug === slug) : undefined;
  const existingImage = previous?.image === image;
  if (!existingImage && (!/^\/api\/web\/product-media\/[a-f0-9-]{36}\.webp$/.test(image) || !await websiteMediaExists(image))) throw new TaxonomyError(422, "Upload a blog image before saving.");
  if (!Array.isArray(input.sections) || !input.sections.length || input.sections.length > 50) throw new TaxonomyError(422, "Add between 1 and 50 H2 sections.");
  const sections = input.sections.map((section: unknown, index: number) => {
    if (!section || typeof section !== "object") throw new TaxonomyError(422, "Invalid blog section.");
    const item = section as Record<string, unknown>;
    const heading = text(item.title, "an H2 heading", 240);
    return { id: `${blogSlug(heading) || "section"}-${index + 1}`, title: heading, text: text(item.text, "a paragraph", 20000) };
  });
  const excerpt = typeof input.excerpt === "string" && input.excerpt.trim() ? text(input.excerpt, "a short introduction", 2000) : sections[0].text.slice(0, 220);
  const post: BlogPost = { slug, title, image, imageAlt: typeof input.imageAlt === "string" && input.imageAlt.trim() ? text(input.imageAlt, "an image description", 500) : title, category: typeof input.category === "string" && input.category.trim() ? text(input.category, "a category", 120) : "Hardware guide", targetKeyword: typeof input.targetKeyword === "string" ? input.targetKeyword.slice(0, 240) : undefined, readTime: `${Math.max(1, Math.ceil(sections.map(s => s.text).join(" ").split(/\s+/).length / 200))} min read`, excerpt, sections, published: input.published, version: (input.version as number) + 1 };
  const conflict = () => new TaxonomyError(409, "This blog changed or its address already exists. Refresh the blogs and try again.");
  if (usesMysql()) {
    const pool = await database();
    if (input.version === 0) {
      const [result] = await pool.execute<ResultSetHeader>("INSERT IGNORE INTO web_blog_posts(slug,version,body) VALUES(?,?,?)", [slug, post.version, JSON.stringify(post)]);
      if (result.affectedRows !== 1) throw conflict();
    } else {
      const [result] = await pool.execute<ResultSetHeader>("UPDATE web_blog_posts SET body=?,version=? WHERE slug=? AND version=?", [JSON.stringify(post), post.version, slug, input.version as number]);
      if (result.affectedRows !== 1) throw conflict();
    }
  } else {
    const work = localSave.catch(() => {}).then(async () => {
      const posts = await localPosts(), current = posts.find(p => p.slug === slug);
      if ((current?.version ?? 0) !== input.version) throw conflict();
      const next = current ? posts.map(p => p.slug === slug ? post : p) : [post, ...posts];
      const directory = webDataDirectory();
      await mkdir(directory, { recursive: true });
      const temp = join(directory, `blogs-${randomUUID()}.tmp`);
      await writeFile(temp, JSON.stringify(next), { mode: 0o640 });
      await rename(temp, join(directory, "blog-posts.json"));
    });
    localSave = work;
    await work;
  }
  return post;
}

export async function deleteBlogPost(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new TaxonomyError(400, "Invalid blog details.");
  const input = value as Record<string, unknown>;
  const slug = text(input.slug, "a blog address", 150);
  if (!Number.isSafeInteger(input.version) || (input.version as number) < 1) throw new TaxonomyError(422, "Refresh this blog before deleting.");
  const conflict = () => new TaxonomyError(409, "This blog changed or was deleted. Refresh the blogs and try again.");
  if (usesMysql()) {
    const [result] = await (await database()).execute<ResultSetHeader>("DELETE FROM web_blog_posts WHERE slug=? AND version=?", [slug, input.version as number]);
    if (result.affectedRows !== 1) throw conflict();
  } else {
    const work = localSave.catch(() => {}).then(async () => {
      const posts = await localPosts();
      if (!posts.some(post => post.slug === slug && post.version === input.version)) throw conflict();
      const directory = webDataDirectory();
      await mkdir(directory, { recursive: true });
      const temp = join(directory, `blogs-${randomUUID()}.tmp`);
      await writeFile(temp, JSON.stringify(posts.filter(post => post.slug !== slug)), { mode: 0o640 });
      await rename(temp, join(directory, "blog-posts.json"));
    });
    localSave = work;
    await work;
  }
}

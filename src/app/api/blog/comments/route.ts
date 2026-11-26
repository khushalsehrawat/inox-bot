import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { mkdir, writeFile, readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import type { RowDataPacket } from "mysql2/promise";
import { getSavedBlogPost } from "@/lib/blog-store";
import { isSameOrigin } from "@/lib/request";
import { limitedBody } from "@/lib/web-admin";
import { TaxonomyError } from "@/lib/web-taxonomy-store.mjs";
import { websitePool } from "@/lib/web-mysql.mjs";
import { usesMysql, webDataDirectory } from "@/lib/web-taxonomy";
export const runtime = "nodejs";
const reply = (message:string,status:number) => NextResponse.json({message},{status,headers:{"Cache-Control":"no-store"}});
let ready:Promise<unknown> | undefined;
export async function POST(request:NextRequest) {
  if (!isSameOrigin(request)) return reply("Invalid request origin.",403);
  if (!request.headers.get("content-type")?.startsWith("application/json")) return reply("Use JSON.",415);
  try {
    let input;
    try { input = JSON.parse(Buffer.from(await limitedBody(request,16000)).toString()); }
    catch (e) { if (e instanceof TaxonomyError) throw e; return reply("Invalid comment.",400); }
    if (!input || typeof input !== "object" || Array.isArray(input) || typeof input.slug !== "string" || !await getSavedBlogPost(input.slug)) return reply("Article not found.",404);
    const valid = typeof input.name === "string" && input.name.trim().length >= 2 && input.name.length <= 120 && typeof input.email === "string" && input.email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email.trim()) && typeof input.comment === "string" && input.comment.trim().length > 0 && input.comment.length <= 5000 && typeof input.website === "string" && input.website.length <= 500 && !input.company;
    if (!valid) return reply("Check your name, email, website and comment.",422);
    const website = input.website.trim();
    if (website) { try {const url = new URL(website); if (!["https:","http:"].includes(url.protocol) || url.username || url.password) throw new Error();} catch {return reply("Enter a website beginning with https:// or leave it empty.",422);} }
    const id = randomUUID(), email = input.email.trim().toLowerCase();
    const comment = {id,slug:input.slug,name:input.name.trim(),email,website,comment:input.comment.trim(),status:"pending",createdAt:new Date().toISOString()};
    if (usesMysql()) {
      const pool = websitePool();
      if (!ready) ready = pool.execute("CREATE TABLE IF NOT EXISTS web_blog_comments (id CHAR(36) PRIMARY KEY, slug VARCHAR(191) NOT NULL, email VARCHAR(254) NOT NULL, status VARCHAR(20) NOT NULL DEFAULT 'pending', body JSON NOT NULL, created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, INDEX blog_comments_email_created(email,created_at))").catch(e => {ready=undefined;throw e;});
      await ready;
      const [recent] = await pool.execute<RowDataPacket[]>("SELECT id FROM web_blog_comments WHERE email=? AND created_at > DATE_SUB(NOW(), INTERVAL 1 MINUTE) LIMIT 1",[email]);
      if (recent.length) return reply("Please wait a minute before posting another comment.",429);
      await pool.execute("INSERT INTO web_blog_comments(id,slug,email,status,body) VALUES(?,?,?,'pending',?)",[id,input.slug,email,JSON.stringify(comment)]);
    } else {
      const directory = join(webDataDirectory(),"blog-comments");
      await mkdir(directory,{recursive:true});
      const files = await readdir(directory);
      for (const file of files.filter(f => /^[a-f0-9-]{36}\.json$/.test(f))) {
        const previous = JSON.parse(await readFile(join(directory,file),"utf8"));
        if (previous.email === email && Date.now()-Date.parse(previous.createdAt)<60000) return reply("Please wait a minute before posting another comment.",429);
      }
      await writeFile(join(directory,`${id}.json`),JSON.stringify(comment),{flag:"wx",mode:0o640});
    }
    return reply("Thank you. Your comment has been submitted for review.",201);
  } catch (e) { return reply(e instanceof TaxonomyError ? e.message : "Your comment could not be saved. Please try again.",e instanceof TaxonomyError ? e.status : 503); }
}

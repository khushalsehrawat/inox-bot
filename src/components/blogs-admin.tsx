"use client";
import { useEffect, useState } from "react";
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { blogSlug, type BlogPost } from "@/lib/blog-model";
import { imagePreviewUrl, uploadAdminImage } from "./admin-image-editor";
import "./blogs-admin.css";

function blankBlog(): BlogPost {
  return { slug: "", title: "", image: "", imageAlt: "", category: "Hardware guide", excerpt: "", readTime: "1 min read", sections: [{ id: crypto.randomUUID(), title: "", text: "" }], version: 0, published: false };
}
export function BlogsAdmin() {
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [draft, setDraft] = useState<BlogPost | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  useEffect(() => {
    fetch("/api/admin/blogs", { cache: "no-store" }).then(async response => {
      const data = await response.json();
      if (!response.ok) throw new Error(data.message);
      setPosts(data.posts);
    }).catch(e => setError(e.message)).finally(() => setLoading(false));
  }, []);
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
  function change(patch: Partial<BlogPost>) { setDraft(current => current ? { ...current, ...patch } : null); setDirty(true); setNotice(""); }
  function open(post: BlogPost | null) {
    if (dirty && !window.confirm("Discard unsaved blog changes?")) return;
    setDraft(post ? structuredClone(post) : null); setDirty(false); setError(""); setNotice("");
  }
  function section(index: number, patch: Partial<BlogPost["sections"][number]>) {
    if (draft) change({ sections: draft.sections.map((item, i) => i === index ? { ...item, ...patch } : item) });
  }
  function move(index: number, offset: number) {
    if (!draft) return;
    const sections = [...draft.sections];
    [sections[index], sections[index + offset]] = [sections[index + offset], sections[index]];
    change({ sections });
  }
  async function upload(file?: File) {
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type) || file.size > 25 * 1024 * 1024) { setError("Choose a JPEG, PNG or WebP image up to 25 MB."); return; }
    setBusy(true); setError("");
    try { change({ image: await uploadAdminImage(file, "/api/admin/blogs/upload") }); }
    catch (e) { setError(e instanceof Error ? e.message : "Image upload failed."); }
    finally { setBusy(false); }
  }
  async function save(published: boolean) {
    if (!draft) return;
    setBusy(true); setError(""); setNotice("");
    try {
      const response = await fetch("/api/admin/blogs", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...draft, slug: draft.slug || blogSlug(draft.title), published }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message);
      setPosts(current => [data.post, ...current.filter(post => post.slug !== data.post.slug)]);
      setDraft(data.post); setDirty(false); setNotice(published ? "Blog published. It is now visible on the website." : "Blog saved as a draft. It is hidden from the website.");
    } catch (e) { setError(e instanceof Error ? e.message : "Could not save the blog."); }
    finally { setBusy(false); }
  }
  async function removeBlog() {
    if (!draft || draft.version < 1 || !window.confirm(`Delete "${draft.title}"? This permanently removes the blog from your website.`)) return;
    setBusy(true); setError(""); setNotice("");
    try {
      const response = await fetch("/api/admin/blogs", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ slug: draft.slug, version: draft.version }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message);
      setPosts(current => current.filter(post => post.slug !== draft.slug));
      setDraft(null); setDirty(false); setNotice("Blog deleted.");
    } catch (e) { setError(e instanceof Error ? e.message : "Could not delete the blog."); }
    finally { setBusy(false); }
  }
  return <section className="blogs-admin">
    <div className="blog-admin-toolbar"><div><h2>Blogs</h2><p>Write a story, add an image and publish it to your website.</p></div><button type="button" className="button dark" disabled={busy || loading} onClick={() => open(blankBlog())}><Plus size={16}/> Create blog</button></div>
    {error && <p className="form-error" role="alert">{error}</p>}
    {notice && <p className="form-feedback" role="status">{notice}</p>}
    {loading ? <p role="status">Loading blogs…</p> : draft ? <form onSubmit={event => { event.preventDefault(); void save(true); }}>
      <fieldset disabled={busy}>
        <div className="blog-editor-intro">
          <div className="blog-editor-cover">
            <label className="blog-upload">Cover image *{draft.image ? <img src={imagePreviewUrl(draft.image)} alt="Blog cover preview"/> : <span className="blog-upload-empty">Upload your blog image</span>}<input aria-label="Upload blog image" type="file" accept="image/jpeg,image/png,image/webp" onChange={event => { void upload(event.target.files?.[0]); event.target.value = ""; }}/></label>
            <small>JPEG, PNG or WebP · Up to 25 MB</small>
            <label>Image description<input value={draft.imageAlt} maxLength={500} onChange={e => change({ imageAlt: e.target.value })} placeholder="Describe the image"/></label>
          </div>
          <div className="blog-editor-title">
            <label>H1 heading *<input required value={draft.title} maxLength={240} onChange={e => change({ title: e.target.value })} placeholder="Your blog title"/></label>
            <label>Short introduction<textarea value={draft.excerpt} maxLength={2000} rows={4} onChange={e => change({ excerpt: e.target.value })} placeholder="A short introduction for your blog and its listing card"/></label>
            <label>Category<input value={draft.category} maxLength={120} onChange={e => change({ category: e.target.value })}/></label>
            <small>Blog address: /blog/{draft.slug || blogSlug(draft.title) || "your-blog-title"}</small>
          </div>
        </div>
        <div className="blog-editor-body">
          <aside className="blog-editor-contents"><h3>In this story</h3><p>Your H2 headings appear here and in the left-side panel on the public blog page.</p><ol>{draft.sections.map((item, index) => <li key={item.id}><a href={`#edit-${item.id}`}>{item.title || `Section ${index + 1}`}</a></li>)}</ol></aside>
          <div className="blog-editor-sections">{draft.sections.map((item, index) => <div className="blog-editor-section" id={`edit-${item.id}`} key={item.id}>
            <div className="blog-section-actions"><strong>Section {index + 1}</strong><div><button type="button" aria-label={`Move section ${index + 1} up`} disabled={busy || index === 0} onClick={() => move(index, -1)}><ArrowUp size={16}/></button><button type="button" aria-label={`Move section ${index + 1} down`} disabled={busy || index === draft.sections.length - 1} onClick={() => move(index, 1)}><ArrowDown size={16}/></button><button type="button" aria-label={`Remove section ${index + 1}`} disabled={busy || draft.sections.length === 1} onClick={() => change({ sections: draft.sections.filter((_, i) => i !== index) })}><Trash2 size={16}/></button></div></div>
            <label>H2 heading *<input required aria-label={`H2 heading ${index + 1}`} value={item.title} maxLength={240} onChange={e => section(index, { title: e.target.value })} placeholder="Section heading"/></label>
            <label>Paragraph *<textarea required aria-label={`Paragraph ${index + 1}`} value={item.text} maxLength={20000} rows={7} onChange={e => section(index, { text: e.target.value })} placeholder="Write your content. Leave a blank line between paragraphs."/></label>
          </div>)}<button type="button" disabled={busy || draft.sections.length >= 50} onClick={() => change({ sections: [...draft.sections, { id: crypto.randomUUID(), title: "", text: "" }] })}><Plus size={16}/> Add H2 & paragraph</button></div>
        </div>
        <div className="blog-editor-footer"><button type="button" onClick={() => open(null)}>Back to blogs</button><button type="button" onClick={() => void save(false)}>Save draft</button><button type="submit" className="button dark">{busy ? "Saving…" : draft.published ? "Update blog" : "Publish blog"}</button>{draft.version > 0 && <button type="button" className="upload-danger-button" onClick={() => void removeBlog()}><Trash2 size={16}/> Delete blog</button>}{draft.version > 0 && draft.published && <a href={`/blog/${draft.slug}`} target="_blank" rel="noreferrer">View blog ↗</a>}</div>
      </fieldset>
    </form> : <div className="blog-admin-list">{posts.length === 0 && <p>No blogs yet. Create your first story.</p>}{posts.map(post => <button type="button" className="blog-admin-card" key={post.slug} onClick={() => open(post)}><img src={imagePreviewUrl(post.image)} alt=""/><div><small>{post.published ? "Published" : "Draft"}</small><h3>{post.title}</h3><p>{post.sections.length} sections · Edit blog</p></div></button>)}</div>}
  </section>;
}

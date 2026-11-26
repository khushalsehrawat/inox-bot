"use client";
import { useEffect, useState, type FormEvent } from "react";
import { ArrowRight } from "lucide-react";
const storageKey = "inox-blog-comment-details";
export function BlogCommentForm({slug}:{slug:string}) {
  const [name,setName] = useState("");
  const [email,setEmail] = useState("");
  const [website,setWebsite] = useState("");
  const [comment,setComment] = useState("");
  const [remember,setRemember] = useState(false);
  const [busy,setBusy] = useState(false);
  const [error,setError] = useState("");
  const [notice,setNotice] = useState("");
  useEffect(() => {
    try { const saved = JSON.parse(localStorage.getItem(storageKey) || "null");
      if (saved && typeof saved.name === "string" && typeof saved.email === "string" && typeof saved.website === "string") { setName(saved.name); setEmail(saved.email); setWebsite(saved.website); setRemember(true); }
    } catch { /* Browser storage is optional. */ }
  }, []);
  async function submit(event:FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true); setError(""); setNotice("");
    const form = new FormData(event.currentTarget);
    try {
      const response = await fetch("/api/blog/comments",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({slug,name,email,website,comment,company:form.get("company")})});
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Your comment could not be saved. Please try again.");
      try { if (remember) localStorage.setItem(storageKey,JSON.stringify({name,email,website})); else localStorage.removeItem(storageKey); } catch { /* Posting still works without browser storage. */ }
      setComment(""); setNotice(data.message);
    } catch (e) { setError(e instanceof Error ? e.message : "Your comment could not be saved. Please try again."); }
    finally { setBusy(false); }
  }
  return <section className="blog-comments" aria-labelledby="blog-comment-title"><span className="eyebrow">Join the conversation</span><h2 id="blog-comment-title">Leave a comment</h2><p>Your email address will not be published. Required fields are marked *. Comments are submitted for review.</p>
    <form onSubmit={submit}>
      <fieldset disabled={busy}>
        <label htmlFor="blog-comment">Comment *</label><textarea id="blog-comment" required maxLength={5000} rows={6} value={comment} onChange={e => setComment(e.target.value)}/>
        <div className="blog-comment-fields"><div><label htmlFor="blog-comment-name">Name *</label><input id="blog-comment-name" name="name" autoComplete="name" required minLength={2} maxLength={120} value={name} onChange={e => setName(e.target.value)}/></div><div><label htmlFor="blog-comment-email">Email *</label><input id="blog-comment-email" name="email" type="email" autoComplete="email" required maxLength={254} value={email} onChange={e => setEmail(e.target.value)}/></div></div>
        <label htmlFor="blog-comment-website">Website</label><input id="blog-comment-website" name="website" type="url" placeholder="https://" autoComplete="url" maxLength={500} value={website} onChange={e => setWebsite(e.target.value)}/>
        <div className="blog-comment-trap" aria-hidden="true"><label>Company<input name="company" tabIndex={-1} autoComplete="off"/></label></div>
        <label className="blog-comment-remember"><input type="checkbox" checked={remember} onChange={e => {setRemember(e.target.checked); if (!e.target.checked) {try {localStorage.removeItem(storageKey);} catch {}}}}/><span>Save my name, email, and website in this browser for the next time I comment.</span></label>
        <button className="button dark" type="submit">{busy ? "Posting..." : "Post comment"}<ArrowRight size={16}/></button>
      </fieldset>
      {error && <p className="form-error" role="alert">{error}</p>}{notice && <p className="form-feedback" role="status">{notice}</p>}
    </form>
  </section>;
}

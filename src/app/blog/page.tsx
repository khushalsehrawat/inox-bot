import Link from "next/link";
import { ArrowRight, Clock3 } from "lucide-react";
import { getBlogPosts } from "@/lib/blog-store";
import { connection } from "next/server";
import { Picture } from "@/components/ui";
import { HighlightInox } from "@/components/highlight-inox";

export const metadata = { title: "Blog", description: "Thoughtful advice on kitchen hardware, cabinet fittings and the details that make everyday spaces work beautifully." };
export default async function Blog() {
  await connection();
  const blogPosts = await getBlogPosts();
  return <main id="main" className="wrap blog-index">
    <header className="blog-index-intro"><div><span className="eyebrow">The INOX journal / Blog</span><h1>Better spaces.<br/><em>By design.</em></h1></div><p>Ideas, practical guides and a closer look at the details that make everyday living feel effortless.</p></header>
    <div className="blog-list-label"><span>Latest stories</span><span>{String(blogPosts.length).padStart(2,"0")} articles / Hardware & everyday living</span></div>
    <section className="blog-cards" aria-label="Blog articles">{blogPosts.map(post => <article key={post.slug} className="blog-feature-card"><Link href={`/blog/${post.slug}`} className="blog-feature-link">
      <div className="blog-feature-image"><Picture src={post.image} alt={post.imageAlt}/></div>
      <div className="blog-feature-copy"><div className="blog-meta"><span>{post.category}</span><span><Clock3 size={13}/>{post.readTime}</span></div><h2>{post.title}</h2><p>{post.excerpt}</p><span className="blog-read-link">Read the story <ArrowRight size={17}/></span></div>
    </Link></article>)}</section>
    <aside className="blog-index-note"><span className="eyebrow">Considered details. Everyday difference.</span><p>Good design is in the things you use every day.</p><Link href="/products">Explore <HighlightInox text="INOX"/> collections <ArrowRight size={16}/></Link></aside>
  </main>;
}

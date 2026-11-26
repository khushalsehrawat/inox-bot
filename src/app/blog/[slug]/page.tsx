import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowUpRight, Clock3 } from "lucide-react";
import { getSavedBlogPost } from "@/lib/blog-store";
import { connection } from "next/server";
import { Picture } from "@/components/ui";
import { HighlightInox } from "@/components/highlight-inox";
import { BlogCommentForm } from "@/components/blog-comment-form";

export async function generateMetadata({params}:{params:Promise<{slug:string}>}) {
  await connection();
  const post = await getSavedBlogPost((await params).slug);
  return post ? {title:post.title,description:post.excerpt,keywords:post.targetKeyword ? [post.targetKeyword] : undefined,openGraph:{title:post.title,description:post.excerpt,images:[post.image],type:"article"}} : {title:"Article not found"};
}
export default async function BlogArticle({params}:{params:Promise<{slug:string}>}) {
  await connection();
  const post = await getSavedBlogPost((await params).slug);
  if (!post) notFound();
  return <main id="main" className="wrap blog-article-page">
    <Link className="blog-back" href="/blog"><ArrowLeft size={15}/> All stories</Link>
    <article>
      <div className="blog-article-intro">
      <div className="blog-article-hero"><Picture src={post.image} alt={post.imageAlt} priority/><span>Kitchen hardware / A closer look</span></div>
      <header className="blog-article-header"><div className="blog-meta"><span>{post.category}</span><span><Clock3 size={13}/>{post.readTime}</span></div><h1>{post.title}</h1><p>{post.excerpt}</p><span className="blog-byline">By <HighlightInox text="INOX"/> / Design for everyday living</span></header>
      </div>
      <div className="blog-reading-layout"><aside className="blog-contents"><span className="eyebrow">In this story</span><nav aria-label="Article contents">{post.sections.map((section,index) => <a key={section.id} href={`#${section.id}`}><span>{String(index+1).padStart(2,"0")}</span>{section.title}</a>)}</nav><Link className="blog-contents-cta" href="/products">Explore our hardware <ArrowUpRight size={15}/></Link></aside>
        <div className="blog-body">{post.sections.map(section => <section id={section.id} key={section.id}><h2>{section.title}</h2>{section.text.split(/\r?\n\s*\r?\n/).filter(text => text.trim()).map((text, index) => <p key={index}><HighlightInox text={text}/></p>)}</section>)}
          <div className="blog-article-signoff"><span className="eyebrow">The INOX perspective</span><p>Considered details.<br/><em>A quieter everyday.</em></p><Link className="text-link" href="/contact">Find the right hardware for your space <ArrowUpRight size={16}/></Link></div>
          <BlogCommentForm slug={post.slug}/>
        </div>
      </div>
    </article>
  </main>;
}

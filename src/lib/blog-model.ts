export type BlogPost = {
  slug: string;
  title: string;
  category: string;
  targetKeyword?: string;
  readTime: string;
  image: string;
  imageAlt: string;
  excerpt: string;
  sections: { id: string; title: string; text: string }[];
  version: number;
  published: boolean;
};

export function blogSlug(text: string) {
  return text.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 150).replace(/-$/, "");
}

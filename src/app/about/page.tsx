import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { PageIntro, Picture, ProjectCTA } from "@/components/ui";
export const metadata = {
  title: "About INOX",
  description:
    "Discover INOX interior solutions, kitchen hardware and architectural fittings.",
};
export default function About() {
  return (
    <main id="main" className="wrap inner-page">
      <div className="about-intro">
        <div>
          <PageIntro eyebrow="About INOX" title="Who we are." />
          <p>
            <mark className="inox-word">INOX</mark> is a trusted name in premium fittings, hardware and interior
            solutions for modern living.
          </p>
          <p>
            We create thoughtfully engineered products that bring function,
            durability and refined design to kitchens, wardrobes and everyday
            spaces. With a focus on quality, innovation and long-term
            performance, <mark className="inox-word">INOX</mark> helps shape interiors that work beautifully every
            day.
          </p>
          <Link className="text-link" href="/products">
            Explore our solutions <ArrowRight size={16} />
          </Link>
        </div>
        <div className="about-images">
          <Picture
            src="editorial/editorial-wardrobe.webp"
            alt="Conceptual illuminated wardrobe interior"
          />
          <Picture
            src="editorial/editorial-kitchen.webp"
            alt="Conceptual contemporary kitchen interior"
          />
        </div>
      </div>
      <section className="about-values">
        <span className="eyebrow">Our approach</span>
        <h2>Purpose in every detail.</h2>
        <div>
          {[
            [
              "Thoughtful function",
              "Fittings that make the most of your space and simplify the everyday.",
            ],
            [
              "Considered design",
              "Materials, proportions and details that belong together.",
            ],
            [
              "A shared vision",
              "Working with designers, architects and partners to bring spaces to life.",
            ],
          ].map(([title, text]) => (
            <article key={title}>
              <h3>{title}</h3>
              <p>{text}</p>
            </article>
          ))}
        </div>
      </section>
      <ProjectCTA />
    </main>
  );
}

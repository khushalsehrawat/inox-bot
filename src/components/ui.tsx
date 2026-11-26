import Link from "next/link";
import Image from "next/image";
import { ArrowRight } from "lucide-react";
import { Reveal } from "./motion-system";
import { HighlightInox } from "./highlight-inox";
export function Picture({
  src,
  alt,
  className = "",
  priority = false,
  framing,
}: {
  src: string;
  alt: string;
  className?: string;
  priority?: boolean;
  framing?: { zoom?: number; positionX?: number; positionY?: number };
}) {
  return (
    <div className={`picture ${className}`}>
      {src ? (
        <Image
          src={src.startsWith("/") ? src : `/media/${src}`}
          alt={alt}
          fill
          style={framing ? { scale: framing.zoom ?? 1, objectPosition: `${framing.positionX ?? 50}% ${framing.positionY ?? 50}%` } : undefined}
          sizes="(max-width: 700px) 100vw, 50vw"
          priority={priority}
          unoptimized={src.startsWith("/api/")}
        />
      ) : (
        <span className="collection-image-placeholder">
          Collection image pending
        </span>
      )}
    </div>
  );
}
export function PageIntro({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description?: string;
}) {
  return (
    <Reveal className="page-intro" kind="aside">
      <span className="eyebrow">
        <HighlightInox text={eyebrow} />
      </span>
      <h1>
        <HighlightInox text={title} />
      </h1>
      {description && (
        <p>
          <HighlightInox text={description} />
        </p>
      )}
    </Reveal>
  );
}
export function ProjectCTA() {
  return (
    <Reveal className="project-cta" kind="aside">
      <div>
        <span className="eyebrow">From an idea to a space of your own</span>
        <h2>
          Start your project with <mark className="inox-word">INOX</mark>.
        </h2>
        <p>
          Tell us what you have in mind. Let’s find the details that bring it
          together.
        </p>
      </div>
      <Link className="button light" href="/contact">
        Let’s talk <ArrowRight size={17} />
      </Link>
    </Reveal>
  );
}

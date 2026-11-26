import { connection } from "next/server";
import { getHomeImages } from "@/lib/home-image-store";
import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  BadgeCheck,
  LayoutGrid,
  UsersRound,
  Heart,
  MapPin,
  Globe,
} from "lucide-react";
import { getPublicWebCategories } from "@/lib/web-taxonomy";
import { Picture, ProjectCTA } from "@/components/ui";
import { HeroStage, Reveal, ParallaxImage } from "@/components/motion-system";
import { HomeEvents } from "@/components/home-events";
import { getEventAlbums } from "@/lib/event-store";
import { CollectionStrip } from "@/components/collection-strip";
import { CollectionSlider } from "@/components/collection-slider";

export default async function Home() {
  await connection();
  const images = await getHomeImages();
  const image = (id: string) => images.find(item => item.id === id)!;
  const categories = (await getPublicWebCategories())
    .filter(c => !c.parentId)
    .map(c => {
      const framing = images.find(item => item.id === `collection-${c.id}`);
      return { ...c, image: framing?.src || c.image || "/media/editorial/editorial-hardware.webp", framing };
    });
  const collectionCategories = categories;
  return (
    <main id="main">
      <div className="wrap">
        <HeroStage>
          <Picture
            className="hero-image"
            framing={image("hero")}
            src={image("hero").src}
            alt={image("hero").alt}
            priority
          />
          <div className="hero-shade" />
          <div className="hero-copy">
            <span className="eyebrow">The art of everyday living</span>
            <h1 aria-label="A kitchen worth staying in.">
              <span className="mask-line">
                <span>A kitchen</span>
              </span>
              <span className="mask-line">
                <span>worth staying in.</span>
              </span>
            </h1>
            <p>
              The details make the difference.
              <br />
              Every time. Every day.
            </p>
            <Link href="/products?category=kitchen" className="hero-link">
              Discover the collection <ArrowUpRight size={19} />
            </Link>
          </div>
          <div className="hero-caption">
            <span>
              <mark className="inox-word">INOX</mark> / KITCHEN SOLUTIONS
            </span>
          </div>
        </HeroStage>
        <section className="hero-intro">
          <h2>
            Engineered interiors.
            <br />
            Designed to endure.
          </h2>
          <p>
            <mark className="inox-word">INOX</mark> is a complete interior
            solutions brand offering premium Hardware, Kitchens, Wardrobes,
            XCOMB aluminium honeycomb panels and Facade.
          </p>
          <div className="intro-actions">
            <Link className="button dark" href="/products">
              Explore Products <ArrowUpRight size={15} />
            </Link>
            <Link className="button outline" href="/contact">
              Partner With Us
            </Link>
          </div>
        </section>
        <CollectionStrip categories={categories} />
        <div className="principles brand-facts">
          <span>
            <BadgeCheck aria-hidden="true" />
            26+ Years of Excellence
          </span>
          <span>
            <LayoutGrid aria-hidden="true" />
            2,100+ Products
          </span>
          <span>
            <UsersRound aria-hidden="true" />
            670+ Channel Partners
          </span>
          <span>
            <Heart aria-hidden="true" />
            4M+ Happy Customers
          </span>
          <span>
            <MapPin aria-hidden="true" />
            Presence in 18 States, 85 Cities
          </span>
          <span>
            <Globe aria-hidden="true" />
            Global Presence
          </span>
        </div>
      </div>
      <section className="home-collections" aria-labelledby="collections-title">
        <div className="wrap">
          <Reveal className="collections-heading" kind="aside">
            <div>
              <span className="eyebrow">
                <span className="collections-rule" aria-hidden="true" />
                <span>The <mark className="inox-word">INOX</mark> collections</span>
              </span>
              <h2 id="collections-title">
                <span className="living-title-line">Considered details.</span>
                <br />
                <span className="living-title-line">Extraordinary spaces.</span>
              </h2>
            </div>
            <div className="collections-intro">
              <span className="collections-edition">Living collections / Engineering in motion</span>
              <p>Explore fittings, hardware and storage solutions that bring every part of your interior together.</p>
              <Link href="/products" className="text-link">Explore all products <ArrowUpRight size={18} /></Link>
            </div>
          </Reveal>
          <div className="collections-gallery-label" aria-hidden="true">
            <span>Materials. Movement. Possibilities.</span>
            <span>{String(collectionCategories.length).padStart(2, "0")} collections / INOX</span>
          </div>
          <CollectionSlider categories={collectionCategories.map((category, index) => ({ ...category, number: index + 1 }))} />
          <div className="collections-footnote">
            <span>Thoughtfully selected. Beautifully connected.</span>
            <Link href="/contact">
              Find the right details for your project <ArrowUpRight size={16} />
            </Link>
          </div>
        </div>
      </section>
      <section className="wrap story section">
        <Reveal className="story-copy" kind="aside">
          <span className="eyebrow">
            The <mark className="inox-word">INOX</mark> perspective
          </span>
          <h2>
            Designed for spaces
            <br />
            that <em>demand more.</em>
          </h2>
          <p>
            A kitchen that moves with you. A wardrobe that brings order to your
            day. Hardware that quietly makes everything feel right.
          </p>
          <p>We believe the best details are the ones you feel, every day.</p>
          <Link className="text-link" href="/about">
            Discover our story <ArrowRight size={18} />
          </Link>
        </Reveal>
        <ParallaxImage>
          <Picture
            framing={image("story")}
            src={image("story").src}
            alt={image("story").alt}
          />
        </ParallaxImage>
      </section>
      <HomeEvents albums={await getEventAlbums()} />
      <section className="catalogue-feature">
        <div className="wrap catalogue-feature-inner">
          <Reveal className="catalogue-art" kind="image">
            <span>
              <mark className="inox-word">INOX</mark>
            </span>
            <Picture
              framing={image("catalogue")}
            src={image("catalogue").src}
              alt={image("catalogue").alt}
            />
            <div>
              THE ART OF
              <br />
              CONSIDERED LIVING.<small>KITCHEN · WARDROBE · HARDWARE</small>
            </div>
          </Reveal>
          <Reveal kind="aside">
            <span className="eyebrow">Explore the finer details</span>
            <h2>
              Your next idea
              <br />
              starts here.
            </h2>
            <p>
              Explore our interior solutions, materials and possibilities in the
              <mark className="inox-word"> INOX</mark> collection.
            </p>
            <Link className="button outline" href="/catalogues">
              View Catalogues <ArrowUpRight size={16} />
            </Link>
          </Reveal>
        </div>
      </section>
      <div className="wrap section">
        <ProjectCTA />
      </div>
    </main>
  );
}

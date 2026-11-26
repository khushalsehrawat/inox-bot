"use client";

import { useState } from "react";
import Image from "next/image";
import facadeImage from "../../public/media/facade.png";
import Link from "next/link";
import { motion, useReducedMotion } from "motion/react";
import { ArrowDown, ArrowUpRight, Layers3, MoveUpRight } from "lucide-react";

const collections = {
  facade: {
    name: "Facade", eyebrow: "Architecture, in a new light", title: "Buildings System",
    description: "Bespoking Luxury Metalness \b Grandiodising Exterirors and Interiors.",
    image: facadeImage, alt: "Sculptural metallic architectural facade in warm sunlight",
    words: ["Rhythm", "Texture", "Identity"],
    details: [
      ["01", "An architectural signature", "Explore expressive surfaces for entrances, exterior compositions and distinctive architectural features."],
      ["02", "Designed around light", "Consider how profiles, patterns and finishes change with the sun, bringing depth and movement to a building’s elevation."],
      ["03", "A considered specification", "Discuss the finish, supporting structure and installation requirements with our team to find a direction suited to your project."],
    ],
  },
  xcomb: {
    name: "Xcomb", eyebrow: "The intelligence within", title: "Extraordinary, at the core.",
    description: "Discover INOX XCOMB aluminium honeycomb panels. A cellular core brings a different approach to panel construction, opening possibilities for considered interior surfaces.",
    image: "/media/honeycomb.png", alt: "Exploded panel showing acrylic faces and an aluminium honeycomb core",
    words: ["Surface", "Structure", "Possibility"],
    details: [
      ["01", "A cellular foundation", "An aluminium honeycomb core sits between outer layers, creating a sandwich panel structure inspired by the efficiency of a honeycomb."],
      ["02", "A surface for your vision", "Explore panel possibilities for furniture, cabinetry and interior features. The right finish and construction depend on your application."],
      ["03", "Details that make the difference", "Talk to our team about panel sizes, available finishes, edge details and suitability before specifying XCOMB for your project."],
    ],
  },
};

function Entrance({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  const reduced = useReducedMotion();
  return <motion.div className={className} initial={false} whileInView={reduced ? {} : { opacity: [0.55, 1], y: [30, 0] }} viewport={{ once: true, amount: 0.1 }} transition={{ duration: 0.85, ease: [0.22, 1, 0.36, 1] }}>{children}</motion.div>;
}

export function ArchitecturalCollections() {
  return <div className="architectural-collections">
    {(["facade", "xcomb"] as const).map((type, index) => {
      const item = collections[type];
      return <section className={`material-preview material-${type}`} key={type} aria-labelledby={`${type}-preview-title`}>
        <div className="wrap material-preview-grid">
          <Entrance className="material-copy">
            <span className="material-kicker">INOX / {String(index + 1).padStart(2, "0")} — {item.eyebrow}</span>
            <h2 id={`${type}-preview-title`}>{item.name}{type === "facade" ? <span className="facade-building-title">Building<strong>Systems</strong></span> : <span>{item.title}</span>}</h2>
            <p>{type === "facade" ? <>Bespoke luxury metalwork.<br />Grand designs for exteriors and interiors.</> : item.description}</p>
            <Link className="material-link" href={`/${type}`}>Discover {item.name} <ArrowUpRight size={20} /></Link>
          </Entrance>
          <Entrance className="material-preview-art">
            <Link href={`/${type}`} aria-label={`Explore INOX ${item.name}`}>
              <Image src={item.image} alt={item.alt} width={1000} height={700} sizes="(max-width: 760px) 100vw, 55vw" />
              <span className="material-art-index">{type === "facade" ? "The art of the exterior" : "A new perspective on panels"}</span>
              <span className="material-art-arrow"><ArrowUpRight /></span>
            </Link>
          </Entrance>
          <div className="material-words">{item.words.map(word => <span key={word}>{word}</span>)}<span>INOX {item.name}</span></div>
        </div>
      </section>;
    })}
  </div>;
}

function LayerStudy() {
  const [expanded, setExpanded] = useState(false);
  const reduced = useReducedMotion();
  return <div className="layer-study">
    <div className={`layer-model${expanded ? " is-expanded" : ""}`} aria-hidden="true">
      {["Surface layer", "Aluminium honeycomb core", "Backing layer"].map((label, i) => <motion.div key={label} className={`panel-layer panel-layer-${i}`} animate={{ y: expanded ? (i - 1) * 58 : (i - 1) * 12 }} transition={{ duration: reduced ? 0 : 0.9, ease: [0.22, 1, 0.36, 1] }}><span>{label}</span></motion.div>)}
    </div>
    <button className="material-link" type="button" aria-expanded={expanded} aria-controls="layer-explanation" onClick={() => setExpanded(!expanded)}><Layers3 size={18} />{expanded ? "Bring the layers together" : "Explore the layers"}<MoveUpRight size={18} /></button>
    <p id="layer-explanation">{expanded ? "Outer faces surround the cellular aluminium core. Finishes and layer specifications vary by panel selection." : "One panel. A considered combination of layers. Tap to look inside."}</p>
    <small>Concept illustration · not to scale</small>
  </div>;
}

export function MaterialExperience({ type }: { type: "facade" | "xcomb" }) {
  const item = collections[type];
  const other = type === "facade" ? "xcomb" : "facade";
  return <main id="main" className={`material-experience material-${type}`}>
    <section className="material-hero wrap">
      <Entrance className="material-hero-copy">
        <span className="material-kicker">INOX / {item.eyebrow}</span>
        <h1>{item.name}{type === "facade" ? <span className="facade-building-title">Building<strong>Systems</strong></span> : <span>{item.title}</span>}</h1>
        <p>{type === "facade" ? <>Bespoke luxury metalwork.<br />Grand designs for exteriors and interiors.</> : item.description}</p>
        <a className="material-link" href="#material-story">Explore the possibilities <ArrowDown size={18} /></a>
      </Entrance>
      <Entrance className="material-hero-art"><Image src={item.image} alt={item.alt} width={1200} height={850} priority sizes="(max-width: 760px) 100vw, 60vw" /><span className="material-image-note">Material, considered. / INOX {item.name}</span></Entrance>
      <div className="material-words">{item.words.map(word => <span key={word}>{word}</span>)}</div>
    </section>
    <section id="material-story" className="material-story wrap">
      <Entrance className="material-story-heading"><span className="material-kicker">Behind the expression</span><h2>{type === "facade" ? "The building becomes the statement." : "Beauty on the surface. Intelligence underneath."}</h2></Entrance>
      <div className="material-details">{item.details.map(([number, title, copy]) => <Entrance className="material-detail" key={number}><span>{number} /</span><div><h3>{title}</h3><p>{copy}</p></div></Entrance>)}</div>
    </section>
    {type === "xcomb" && <section className="material-structure wrap" aria-label="Interactive honeycomb panel structure"><Entrance><span className="material-kicker">An exploration of structure</span><h2>Discover what’s within.</h2><LayerStudy /></Entrance></section>}
    {type === "facade" && <section className="facade-study wrap"><Entrance><span className="material-kicker">A study in light & shadow</span><h2>Still architecture.<br /><em>Endlessly changing light.</em></h2><div className="facade-fins" aria-hidden="true">{Array.from({ length: 18 }, (_, i) => <i key={i} style={{ animationDelay: `${i * -0.18}s` }} />)}</div><p>From a bold entrance to a distinctive elevation, begin with the character you want to create.</p></Entrance></section>}
    <section className="material-contact wrap"><Entrance><span className="material-kicker">Your next architectural chapter</span><h2>Let’s shape something<br /><em>exceptional.</em></h2><Link className="material-link" href={`/contact?subject=${type}`}>Discuss your {item.name} project <ArrowUpRight size={20} /></Link><Link className="material-other" href={`/${other}`}>Explore INOX {collections[other].name} <ArrowUpRight size={16} /></Link></Entrance></section>
  </main>;
}

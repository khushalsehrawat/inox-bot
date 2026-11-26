import { Picture } from "./ui";
import { Reveal } from "./motion-system";

export function HomeAbout() {
  return (
    <section className="wrap home-about" aria-labelledby="home-about-title">
      <Reveal className="home-about-copy" kind="aside">
        <span className="about-kicker">About Inox<span aria-hidden="true" /></span>
        <h2 id="home-about-title">Who We Are</h2>
        <span className="about-heading-rule" aria-hidden="true" />
        <p>
          INOX is a trusted name in premium fittings, hardware and interior
          solutions for modern living. We create thoughtfully engineered products
          that bring function, durability and refined design to kitchens,
          wardrobes and everyday spaces. With a focus on quality, innovation and
          long-term performance, INOX helps shape interiors that work beautifully
          every day.
        </p>
        <dl className="about-highlights">
          {[
            ["20+", "Years of Excellence"],
            ["Premium", "Quality Products"],
            ["Millions", "Happy Customers"],
            ["Pan India", "Partner Network"],
          ].map(([value, label]) => (
            <div key={label}><dt>{value}</dt><dd>{label}</dd></div>
          ))}
        </dl>
      </Reveal>
      <div className="home-about-collage">
        <Reveal className="about-photo-tall" kind="image">
          <Picture src="editorial/editorial-wardrobe.webp" alt="oak wardrobe interior with illuminated storage" />
        </Reveal>
        <Reveal className="about-photo-detail" kind="image" delay={0.1}>
          <Picture src="editorial/editorial-hardware.webp" alt="brushed-metal cabinet hinge detail" />
        </Reveal>
        <Reveal className="about-photo-wide" kind="image" delay={0.18}>
          <Picture src="editorial/editorial-kitchen.webp" alt="contemporary kitchen with integrated cabinetry" />
        </Reveal>
      </div>
    </section>
  );
}

"use client";

import { createContext, useContext, useEffect, useRef, useState } from "react";
import {
  MotionConfig,
  motion,
  useAnimate,
  useInView,
  useReducedMotion,
  useScroll,
  useSpring,
  useTransform,
} from "motion/react";
import { usePathname } from "next/navigation";

const MotionContext = createContext({ reduced: true, rich: false });
export const editorialEase = [0.22, 1, 0.36, 1] as const;
export function useMotionPreferences() {
  return useContext(MotionContext);
}
export function MotionRoot({ children }: { children: React.ReactNode }) {
  const reduced = useReducedMotion();
  const [rich, setRich] = useState(false);
  useEffect(() => {
    const media = matchMedia(
      "(min-width: 900px) and (hover: hover) and (pointer: fine)",
    );
    const update = () => setRich(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  return (
    <MotionConfig reducedMotion="user">
      <MotionContext.Provider value={{ reduced: reduced !== false, rich }}>
        {children}
      </MotionContext.Provider>
    </MotionConfig>
  );
}

// Server output remains visible. Animation starts only after hydration/observation.
export function Reveal({
  children,
  className = "",
  kind = "text",
  delay = 0,
}: {
  children: React.ReactNode;
  className?: string;
  kind?: "text" | "image" | "aside";
  delay?: number;
}) {
  const [scope, animate] = useAnimate();
  const visible = useInView(scope, { once: true, amount: 0.12 });
  const { reduced, rich } = useMotionPreferences();
  useEffect(() => {
    if (!visible || reduced) return;
    const controls =
      kind === "image"
        ? animate(
            scope.current,
            {
              clipPath: ["inset(0 0 18% 0)", "inset(0 0 0% 0)"],
              opacity: [0.5, 1],
            },
            { duration: rich ? 0.8 : 0.5, ease: editorialEase, delay },
          )
        : animate(
            scope.current,
            {
              opacity: [0, 1],
              x: kind === "aside" ? [rich ? -24 : -10, 0] : [0, 0],
              y: kind === "text" ? [rich ? 24 : 10, 0] : [0, 0],
            },
            { duration: rich ? 0.65 : 0.45, ease: editorialEase, delay },
          );
    return () => {
      controls.stop();
    };
  }, [visible, reduced, rich, kind, delay, animate, scope]);
  return (
    <div ref={scope} className={`reveal ${className}`} data-reveal={kind}>
      {children}
    </div>
  );
}

export function HeroStage({ children }: { children: React.ReactNode }) {
  const [scope, animate] = useAnimate();
  const { reduced, rich } = useMotionPreferences();
  useEffect(() => {
    if (reduced) return;
    const controls = animate([
      [
        ".hero-image",
        { scale: [rich ? 1.055 : 1.025, 1], opacity: [0.65, 1] },
        { duration: 1.3, ease: editorialEase },
      ],
      [
        ".hero-copy .eyebrow",
        { opacity: [0, 1], y: [8, 0] },
        { at: 0.1, duration: 0.45 },
      ],
      [
        ".mask-line > span",
        { y: ["105%", "0%"] },
        {
          at: 0.2,
          duration: 0.85,
          delay: (i: number) => i * 0.11,
          ease: editorialEase,
        },
      ],
      [
        ".hero-copy p, .hero-link",
        { opacity: [0, 1], y: [12, 0] },
        {
          at: 0.65,
          duration: 0.55,
          delay: (i: number) => i * 0.1,
          ease: editorialEase,
        },
      ],
      [".hero-caption", { opacity: [0, 1] }, { at: 0.9, duration: 0.4 }],
    ]);
    return () => {
      controls.stop();
    };
  }, [reduced, rich, animate]);
  return (
    <section
      ref={scope}
      className="hero"
      aria-label="Kitchen design inspiration"
    >
      {children}
    </section>
  );
}

function DesktopParallax({ children }: { children: React.ReactNode }) {
  const target = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target,
    offset: ["start end", "end start"],
  });
  const y = useSpring(useTransform(scrollYProgress, [0, 1], [-22, 22]), {
    stiffness: 110,
    damping: 30,
  });
  return (
    <div ref={target} className="parallax-frame">
      <motion.div className="parallax-image" style={{ y }}>
        {children}
      </motion.div>
    </div>
  );
}
export function ParallaxImage({ children }: { children: React.ReactNode }) {
  const { reduced, rich } = useMotionPreferences();
  return rich && !reduced ? (
    <DesktopParallax>{children}</DesktopParallax>
  ) : (
    <div className="parallax-frame">{children}</div>
  );
}
export function RouteEntrance({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const [scope, animate] = useAnimate();
  const { reduced } = useMotionPreferences();
  useEffect(() => {
    if (reduced) return;
    const controls = animate(
      scope.current,
      { opacity: [0.75, 1] },
      { duration: 0.28, ease: "easeOut" },
    );
    return () => {
      controls.stop();
    };
  }, [path, reduced, animate, scope]);
  return (
    <div ref={scope} className="route-content">
      {children}
    </div>
  );
}

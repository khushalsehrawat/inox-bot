"use client";

import { useEffect, useRef, type RefObject } from "react";

// Transform writes only: no React renders or layout reads in the animation loop.
export function useCollectionMotion({ viewport, track, group, automatic, paused, reverse, speed }: {
  viewport: RefObject<HTMLDivElement | null>; track: RefObject<HTMLDivElement | null>;
  group: RefObject<HTMLDivElement | null>; automatic: boolean; paused: boolean; reverse: boolean; speed: number;
}) {
  const shouldPause = useRef(paused);
  useEffect(() => { shouldPause.current = paused; }, [paused]);
  useEffect(() => {
    const el = viewport.current, moving = track.current, sequence = group.current;
    if (!el || !moving || !sequence) return;
    if (!automatic) { moving.style.transform = ""; return; }
    let width = sequence.getBoundingClientRect().width;
    let position = 0, velocity = 0, previous = 0, frame = 0, visible = false;
    const measure = new ResizeObserver(() => { width = sequence.getBoundingClientRect().width; });
    measure.observe(sequence);
    const tick = (time: number) => {
      const delta = previous ? Math.min((time - previous) / 1000, .05) : 0;
      previous = time;
      const target = shouldPause.current ? 0 : speed;
      velocity += (target - velocity) * (1 - Math.exp(-delta / .16));
      if (Math.abs(velocity - target) < .015) velocity = target;
      if (width) {
        position = (position + velocity * delta) % width;
        moving.style.transform = "translate3d(" + (-width + (reverse ? position : -position)) + "px,0,0)";
      }
      if (visible && !document.hidden) frame = requestAnimationFrame(tick);
    };
    const restart = () => {
      cancelAnimationFrame(frame); previous = 0;
      if (visible && !document.hidden) frame = requestAnimationFrame(tick);
    };
    const observer = new IntersectionObserver(entries => { visible = entries[0].isIntersecting; restart(); }, { rootMargin: "60px" });
    observer.observe(el);
    document.addEventListener("visibilitychange", restart);
    return () => {
      cancelAnimationFrame(frame); observer.disconnect(); measure.disconnect();
      document.removeEventListener("visibilitychange", restart); moving.style.transform = "";
    };
  }, [automatic, reverse, speed, viewport, track, group]);
}

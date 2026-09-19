"use client";

import { useEffect } from "react";
import Lenis from "lenis";

export default function MotionLayer() {
  useEffect(() => {
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduceMotion) return;

    const lenis = new Lenis({
      lerp: 0.085,
      smoothWheel: true,
      wheelMultiplier: 0.9,
      touchMultiplier: 1
    });

    let frame = 0;
    const raf = (time: number) => {
      lenis.raf(time);
      frame = requestAnimationFrame(raf);
    };
    frame = requestAnimationFrame(raf);

    const anchorHandler = (event: MouseEvent) => {
      const target = (event.target as Element | null)?.closest<HTMLAnchorElement>('a[href^="#"]');
      if (!target) return;
      const href = target.getAttribute("href");
      if (!href || href === "#") return;
      const element = document.querySelector<HTMLElement>(href);
      if (!element) return;
      event.preventDefault();
      lenis.scrollTo(element, { offset: -78, duration: 1.05 });
    };

    document.addEventListener("click", anchorHandler);

    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener("click", anchorHandler);
      lenis.destroy();
    };
  }, []);

  return null;
}

"use client";

import { useEffect } from "react";
import Lenis from "lenis";

type MotionElement = HTMLElement;

const clamp = (value: number, min = 0, max = 1) => Math.min(max, Math.max(min, value));

export default function MotionLayer() {
  useEffect(() => {
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduceMotion) return;

    const root = document.documentElement;
    root.classList.add("inx-scroll-motion");

    const animations: Animation[] = [];
    const observers: IntersectionObserver[] = [];
    const isCompact = window.matchMedia("(max-width: 800px)");

    const play = (
      element: MotionElement | null,
      keyframes: Keyframe[],
      options: KeyframeAnimationOptions = {}
    ) => {
      if (!element) return null;

      const animation = element.animate(keyframes, {
        duration: 680,
        easing: "cubic-bezier(.22,.8,.24,1)",
        fill: "both",
        ...options
      });

      animations.push(animation);
      animation.finished
        .then(() => animation.cancel())
        .catch(() => undefined);

      return animation;
    };

    const observeOnce = (
      target: Element | null,
      onEnter: () => void,
      threshold = 0.18,
      rootMargin = "0px 0px -8% 0px"
    ) => {
      if (!target) return;

      const observer = new IntersectionObserver(entries => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          onEnter();
          observer.disconnect();
          break;
        }
      }, { threshold, rootMargin });

      observers.push(observer);
      observer.observe(target);
    };

    const stagger = (
      elements: MotionElement[],
      keyframes: (element: MotionElement, index: number) => Keyframe[],
      step = 70,
      duration = 620
    ) => {
      elements.forEach((element, index) => {
        play(element, keyframes(element, index), {
          duration,
          delay: index * step
        });
      });
    };

    const heroCopy = document.querySelector<MotionElement>(".hero-copy");
    const heroProduct = document.querySelector<MotionElement>(".hero-product");
    const heroHeading = document.querySelector<MotionElement>(".hero-copy h1");
    const heroLead = document.querySelector<MotionElement>(".hero-copy > p");
    const heroActions = document.querySelector<MotionElement>(".hero-actions");
    const heroProof = document.querySelector<MotionElement>(".hero-proof");
    const productWindow = document.querySelector<MotionElement>(".hero-product .product-window");
    const heroChips = Array.from(document.querySelectorAll<MotionElement>(".hero-product .floating-chip"));

    requestAnimationFrame(() => {
      play(heroHeading, [
        { opacity: 0, transform: "translate3d(0,24px,0)" },
        { opacity: 1, transform: "translate3d(0,0,0)" }
      ], { duration: 760, delay: 40 });

      [heroLead, heroActions, heroProof].forEach((element, index) => {
        play(element, [
          { opacity: 0, transform: "translate3d(0,16px,0)" },
          { opacity: 1, transform: "translate3d(0,0,0)" }
        ], { duration: 620, delay: 150 + index * 90 });
      });

      play(productWindow, [
        { opacity: 0, transform: "perspective(1200px) rotateY(-2.3deg) rotateX(1deg) translate3d(0,28px,0) scale(.965)" },
        { opacity: 1, transform: "perspective(1200px) rotateY(-2.3deg) rotateX(1deg) translate3d(0,0,0) scale(1)" }
      ], { duration: 900, delay: 170 });

      stagger(heroChips, (_element, index) => [
        { opacity: 0, transform: `translate3d(${index === 0 ? -14 : 14}px,12px,0) scale(.94)` },
        { opacity: 1, transform: "translate3d(0,0,0) scale(1)" }
      ], 120, 560);
    });

    const platformSection = document.querySelector("#platforms");
    const platformCards = Array.from(document.querySelectorAll<MotionElement>(".platform-card"));
    observeOnce(platformSection, () => {
      stagger(platformCards, () => [
        { opacity: 0, transform: "translate3d(0,18px,0) scale(.92)" },
        { opacity: 1, transform: "translate3d(0,0,0) scale(1)" }
      ], 48, 540);
    }, 0.16);

    const capabilitiesSection = document.querySelector("#capabilities");
    const capabilityCards = Array.from(document.querySelectorAll<MotionElement>(".capability-card"));
    observeOnce(capabilitiesSection, () => {
      stagger(capabilityCards, (_element, index) => [
        {
          opacity: 0,
          transform: `translate3d(${index % 2 === 0 ? -22 : 22}px,12px,0) scale(.975)`
        },
        { opacity: 1, transform: "translate3d(0,0,0) scale(1)" }
      ], 76, 650);
    }, 0.13);

    const workflowSection = document.querySelector("#workflow");
    const workflowSteps = Array.from(document.querySelectorAll<MotionElement>(".workflow-step"));
    const workflowArrows = Array.from(document.querySelectorAll<MotionElement>(".step-arrow"));
    observeOnce(workflowSection, () => {
      stagger(workflowSteps, () => [
        { opacity: 0, transform: "translate3d(0,18px,0) scale(.96)" },
        { opacity: 1, transform: "translate3d(0,0,0) scale(1)" }
      ], 120, 620);

      stagger(workflowArrows, () => [
        { opacity: 0, transform: "translate3d(-10px,0,0)" },
        { opacity: 1, transform: "translate3d(0,0,0)" }
      ], 120, 480);
    }, 0.12);

    const productProof = document.querySelector(".product-proof-section");
    const productProofCopy = document.querySelector<MotionElement>(".product-proof-copy");
    const dashboardShowcase = document.querySelector<MotionElement>(".dashboard-showcase");
    observeOnce(productProof, () => {
      play(productProofCopy, [
        { opacity: 0, transform: "translate3d(-24px,10px,0)" },
        { opacity: 1, transform: "translate3d(0,0,0)" }
      ], { duration: 720 });

      play(dashboardShowcase, [
        { opacity: 0, transform: "translate3d(24px,16px,0) scale(.965)" },
        { opacity: 1, transform: "translate3d(0,0,0) scale(1)" }
      ], { duration: 820, delay: 100 });
    }, 0.12);

    const aiSection = document.querySelector("#ai");
    const aiCopy = document.querySelector<MotionElement>(".ai-studio-copy");
    const aiCards = Array.from(document.querySelectorAll<MotionElement>(".ai-feature-card"));
    observeOnce(aiSection, () => {
      play(aiCopy, [
        { opacity: 0, transform: "translate3d(-26px,12px,0)" },
        { opacity: 1, transform: "translate3d(0,0,0)" }
      ], { duration: 740 });

      stagger(aiCards, (_element, index) => [
        {
          opacity: 0,
          transform: `translate3d(${index % 2 === 0 ? 22 : -22}px,20px,0) scale(.965)`
        },
        { opacity: 1, transform: "translate3d(0,0,0) scale(1)" }
      ], 105, 720);

      aiCards.forEach((card, index) => {
        const art = card.querySelector<MotionElement>(".ai-feature-art");
        play(art, [
          {
            opacity: 0.45,
            transform: `translate3d(${index % 2 === 0 ? 18 : -18}px,10px,0) scale(.92) rotate(${index % 2 === 0 ? 2 : -2}deg)`
          },
          { opacity: 1, transform: "translate3d(0,0,0) scale(1) rotate(0deg)" }
        ], { duration: 900, delay: 220 + index * 105 });
      });
    }, 0.1);

    const pricingSection = document.querySelector("#pricing");
    const planCards = Array.from(document.querySelectorAll<MotionElement>(".plan-card"));
    observeOnce(pricingSection, () => {
      planCards.forEach((card, index) => {
        const featured = card.classList.contains("plan-featured");
        play(card, [
          {
            opacity: 0,
            transform: `translate3d(0,${featured ? 26 : 20}px,0) scale(${featured ? ".95" : ".975"})`
          },
          { opacity: 1, transform: "translate3d(0,0,0) scale(1)" }
        ], {
          duration: featured ? 800 : 660,
          delay: index * 80
        });
      });
    }, 0.11);

    const faqSection = document.querySelector(".faq-section");
    const faqIntro = document.querySelector<MotionElement>(".faq-intro");
    const faqItems = Array.from(document.querySelectorAll<MotionElement>(".faq-item"));
    observeOnce(faqSection, () => {
      play(faqIntro, [
        { opacity: 0, transform: "translate3d(-20px,10px,0)" },
        { opacity: 1, transform: "translate3d(0,0,0)" }
      ], { duration: 650 });

      stagger(faqItems, () => [
        { opacity: 0, transform: "translate3d(20px,10px,0)" },
        { opacity: 1, transform: "translate3d(0,0,0)" }
      ], 95, 590);
    }, 0.12);

    const finalCta = document.querySelector(".final-cta");
    const finalCard = document.querySelector<MotionElement>(".final-card");
    observeOnce(finalCta, () => {
      play(finalCard, [
        { opacity: 0, transform: "translate3d(0,24px,0) scale(.975)" },
        { opacity: 1, transform: "translate3d(0,0,0) scale(1)" }
      ], { duration: 760 });
    }, 0.16);

    const lenis = new Lenis({
      lerp: 0.085,
      smoothWheel: true,
      wheelMultiplier: 0.9,
      touchMultiplier: 1
    });

    const updateScrollEffects = () => {
      const viewportHeight = window.innerHeight || 1;

      if (heroProduct && !isCompact.matches) {
        const heroRect = heroProduct.getBoundingClientRect();
        const heroProgress = clamp((viewportHeight - heroRect.top) / (viewportHeight + heroRect.height));
        root.style.setProperty("--hero-parallax", `${(heroProgress - 0.5) * -18}px`);
      }

      if (workflowSection) {
        const rect = workflowSection.getBoundingClientRect();
        const progress = clamp((viewportHeight * 0.76 - rect.top) / Math.max(rect.height * 0.68, 1));
        root.style.setProperty("--workflow-progress", progress.toFixed(4));

        workflowSteps.forEach((step, index) => {
          const threshold = workflowSteps.length === 1 ? 0 : (index / (workflowSteps.length - 1)) * 0.92;
          step.classList.toggle("is-flow-active", progress >= threshold);
        });
      }

      if (dashboardShowcase && !isCompact.matches) {
        const rect = dashboardShowcase.getBoundingClientRect();
        const progress = clamp((viewportHeight - rect.top) / (viewportHeight + rect.height));
        const shift = (0.5 - progress) * 12;
        const scale = 0.994 + progress * 0.012;
        dashboardShowcase.style.setProperty("--dashboard-shift", `${shift.toFixed(2)}px`);
        dashboardShowcase.style.setProperty("--dashboard-scale", scale.toFixed(4));
      }

      if (finalCard && !isCompact.matches) {
        const rect = finalCard.getBoundingClientRect();
        const progress = clamp((viewportHeight - rect.top) / (viewportHeight + rect.height));
        finalCard.style.setProperty("--final-shift", `${((0.5 - progress) * 10).toFixed(2)}px`);
      }
    };

    let frame = 0;
    const raf = (time: number) => {
      lenis.raf(time);
      updateScrollEffects();
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
      observers.forEach(observer => observer.disconnect());
      animations.forEach(animation => animation.cancel());
      workflowSteps.forEach(step => step.classList.remove("is-flow-active"));
      root.classList.remove("inx-scroll-motion");
      root.style.removeProperty("--hero-parallax");
      root.style.removeProperty("--workflow-progress");
      dashboardShowcase?.style.removeProperty("--dashboard-shift");
      dashboardShowcase?.style.removeProperty("--dashboard-scale");
      finalCard?.style.removeProperty("--final-shift");
      lenis.destroy();
    };
  }, []);

  return null;
}

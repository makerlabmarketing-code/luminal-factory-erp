"use client";

import { useEffect } from "react";

const CARD = ".admin-metric-card, .admin-card:not(:has(table)), .admin-panel:not(:has(table))";

export function BentoCardLight() {
  useEffect(() => {
    const supported = window.matchMedia("(hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference)");
    let frame = 0;
    let active: HTMLElement | null = null;

    function move(event: PointerEvent) {
      if (!supported.matches || event.pointerType === "touch") return;
      const card = event.target instanceof Element
        ? event.target.closest<HTMLElement>(CARD)
        : null;
      if (card !== active) {
        active?.removeAttribute("data-luminal-card-lit");
        active = card;
      }
      cancelAnimationFrame(frame);
      if (!card) return;
      frame = requestAnimationFrame(() => {
        const rect = card.getBoundingClientRect();
        card.style.setProperty("--card-light-x", `${event.clientX - rect.left}px`);
        card.style.setProperty("--card-light-y", `${event.clientY - rect.top}px`);
        card.setAttribute("data-luminal-card-lit", "");
      });
    }

    function clear() {
      cancelAnimationFrame(frame);
      active?.removeAttribute("data-luminal-card-lit");
      active = null;
    }

    document.addEventListener("pointermove", move, { passive: true });
    document.documentElement.addEventListener("pointerleave", clear);
    window.addEventListener("blur", clear);
    supported.addEventListener("change", clear);
    return () => {
      clear();
      document.removeEventListener("pointermove", move);
      document.documentElement.removeEventListener("pointerleave", clear);
      window.removeEventListener("blur", clear);
      supported.removeEventListener("change", clear);
    };
  }, []);

  return null;
}

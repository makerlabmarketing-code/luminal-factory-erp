'use client';

import type { ReactNode } from 'react';
import { useEffect, useRef, useState } from 'react';

interface ScrollRevealProps {
  children: ReactNode;
  className?: string;
  delayMs?: number;
}

type RevealPhase = 'idle' | 'hidden' | 'visible';

export function ScrollReveal({ children, className = '', delayMs = 0 }: ScrollRevealProps) {
  const elementRef = useRef<HTMLDivElement>(null);
  const [phase, setPhase] = useState<RevealPhase>('idle');
  const safeDelayMs = Math.min(Math.max(delayMs, 0), 120);

  useEffect(() => {
    const element = elementRef.current;
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (!element || prefersReducedMotion || !('IntersectionObserver' in window)) return;

    const bounds = element.getBoundingClientRect();
    if (bounds.top < window.innerHeight * 0.9) {
      setPhase('visible');
      return;
    }

    setPhase('hidden');

    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;

        setPhase('visible');
        observer.disconnect();
      },
      { rootMargin: '0px 0px -8% 0px', threshold: 0.12 },
    );

    const animationFrame = window.requestAnimationFrame(() => observer.observe(element));

    return () => {
      window.cancelAnimationFrame(animationFrame);
      observer.disconnect();
    };
  }, []);

  const motionClass = phase === 'hidden'
    ? 'translate-y-3 opacity-0'
    : 'translate-y-0 opacity-100';

  return (
    <div
      ref={elementRef}
      data-scroll-reveal={phase}
      className={`${className} ${motionClass} transition-[opacity,transform] duration-[250ms] ease-out motion-reduce:translate-y-0 motion-reduce:opacity-100 motion-reduce:transition-none`}
      style={{ transitionDelay: `${safeDelayMs}ms` }}
    >
      {children}
    </div>
  );
}

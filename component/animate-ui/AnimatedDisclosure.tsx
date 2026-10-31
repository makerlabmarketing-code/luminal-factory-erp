"use client";

import { useId, useState, type ReactNode } from "react";
import { motion, useReducedMotion } from "motion/react";

/**
 * Adapted from Animate UI v1 CollapsibleContent (imskyleen/animate-ui).
 * See docs/vendor/animate-ui-LICENSE.md. Native button semantics replace Radix;
 * panels stay mounted so collapsing a form does not discard its local state.
 */
export function AnimatedDisclosure({
  title, children, className, triggerClassName, contentClassName,
}: Readonly<{
  title: ReactNode;
  children: ReactNode;
  className?: string;
  triggerClassName?: string;
  contentClassName?: string;
}>) {
  const [isOpen, setIsOpen] = useState(false);
  const id = useId();
  const reduceMotion = useReducedMotion();

  return (
    <div className={className} data-state={isOpen ? "open" : "closed"}>
      <button
        id={`${id}-trigger`}
        type="button"
        aria-expanded={isOpen}
        aria-controls={`${id}-panel`}
        className={triggerClassName}
        onClick={() => setIsOpen((open) => !open)}
      >
        <span>{title}</span>
        <span aria-hidden="true">{isOpen ? "−" : "+"}</span>
      </button>
      <motion.div
        id={`${id}-panel`}
        aria-labelledby={`${id}-trigger`}
        aria-hidden={!isOpen}
        inert={!isOpen}
        initial={false}
        animate={isOpen
          ? { height: "auto", opacity: 1, visibility: "visible" }
          : { height: 0, opacity: 0, transitionEnd: { visibility: "hidden" } }}
        transition={{ duration: reduceMotion !== false ? 0 : isOpen ? 0.18 : 0.12, ease: "easeOut" }}
        style={{ overflow: "hidden" }}
      >
        <div className={contentClassName}>{children}</div>
      </motion.div>
    </div>
  );
}

"use client";

import type { Ref } from "react";
import { motion, useReducedMotion, type HTMLMotionProps } from "motion/react";

/** Animate UI v1 Fade adaptation; provenance/license in docs/vendor/animate-ui.md. */
export function Fade({ ref, ...props }: Omit<HTMLMotionProps<"div">, "initial" | "animate" | "exit" | "transition"> & { ref?: Ref<HTMLDivElement> }) {
  const reduceMotion = useReducedMotion();
  return <motion.div
    ref={ref}
    initial={reduceMotion !== false ? false : "hidden"}
    animate="visible"
    variants={{ hidden: { opacity: 0 }, visible: { opacity: 1 } }}
    transition={{ duration: reduceMotion !== false ? 0 : 0.16, ease: "easeOut" }}
    {...props}
  />;
}

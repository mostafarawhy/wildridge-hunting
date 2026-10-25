"use client";

import { useEffect, useRef, type CSSProperties, type ReactNode } from "react";

const HIDE_AFTER = 56;
const HIDE_OFFSET = 56;
const DELTA = 8;

interface StickyHeaderProps {
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
}

export default function StickyHeader({
  className,
  style,
  children,
}: StickyHeaderProps) {
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const desktop = window.matchMedia("(min-width: 1024px)");
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    let lastY = window.scrollY;
    let hidden = false;
    let frame = 0;

    function applyMotion() {
      if (!el) return;
      el.style.transition = reduced.matches ? "none" : "top 200ms ease-out";
    }

    function setHidden(next: boolean) {
      if (!el || hidden === next) return;
      hidden = next;
      el.style.top = next ? `-${HIDE_OFFSET}px` : "0px";
    }

    function update() {
      frame = 0;
      const y = Math.max(0, window.scrollY);
      if (desktop.matches || y <= 0) {
        setHidden(false);
        lastY = y;
        return;
      }
      const diff = y - lastY;
      if (diff <= -DELTA) {
        setHidden(false);
        lastY = y;
      } else if (diff >= DELTA) {
        const locked =
          document.body.style.overflow === "hidden" ||
          !!el?.contains(document.activeElement);
        if (y > HIDE_AFTER && !locked) setHidden(true);
        lastY = y;
      }
    }

    function onScroll() {
      if (!frame) frame = requestAnimationFrame(update);
    }

    function onBreakpoint() {
      if (desktop.matches) setHidden(false);
    }

    applyMotion();
    window.addEventListener("scroll", onScroll, { passive: true });
    desktop.addEventListener("change", onBreakpoint);
    reduced.addEventListener("change", applyMotion);
    return () => {
      window.removeEventListener("scroll", onScroll);
      desktop.removeEventListener("change", onBreakpoint);
      reduced.removeEventListener("change", applyMotion);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <header ref={ref} className={className} style={style}>
      {children}
    </header>
  );
}

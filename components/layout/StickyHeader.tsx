"use client";

import { useEffect, useRef, type CSSProperties, type ReactNode } from "react";

const HIDE_AFTER = 56;
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

    function measure() {
      return el ? Math.ceil(el.getBoundingClientRect().height) : 0;
    }

    function setHidden(next: boolean) {
      if (!el || hidden === next) return;
      hidden = next;
      const height = measure();
      el.style.top = next ? `-${height}px` : "0px";
      document.documentElement.style.setProperty(
        "--header-offset",
        next ? "0px" : `${height}px`,
      );
    }

    function publishShown() {
      document.documentElement.style.setProperty(
        "--header-offset",
        `${measure()}px`,
      );
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
      if (!hidden) publishShown();
    }

    applyMotion();
    publishShown();
    window.addEventListener("scroll", onScroll, { passive: true });
    desktop.addEventListener("change", onBreakpoint);
    reduced.addEventListener("change", applyMotion);
    return () => {
      window.removeEventListener("scroll", onScroll);
      desktop.removeEventListener("change", onBreakpoint);
      reduced.removeEventListener("change", applyMotion);
      document.documentElement.style.removeProperty("--header-offset");
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <header ref={ref} className={className} style={style}>
      {children}
    </header>
  );
}

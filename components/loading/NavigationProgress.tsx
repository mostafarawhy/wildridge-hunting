"use client";

import { useEffect, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";

type Progress = number | null;
type Setter = (value: Progress | ((previous: Progress) => Progress)) => void;

const SHOW_DELAY_MS = 150;
const TRICKLE_MS = 300;
const MAX_MS = 15000;
const DONE_MS = 400;

let setBar: Setter | null = null;
let timers: ReturnType<typeof setTimeout>[] = [];
let running = false;

function clearTimers() {
  timers.forEach(clearTimeout);
  timers = [];
}

const LOCALE_PREFIX = /^\/(en|ar|ru)(?=\/|$)/;

function isCurrentUrl(href: string): boolean {
  const url = new URL(href, window.location.href);
  if (url.origin !== window.location.origin) return false;
  const current = window.location.pathname;
  const prefix = current.match(LOCALE_PREFIX)?.[0] ?? "";
  const target = LOCALE_PREFIX.test(url.pathname)
    ? url.pathname
    : `${prefix}${url.pathname === "/" ? "" : url.pathname}` || "/";
  return target === current && url.search === window.location.search;
}

export function startNavigationProgress(href?: string) {
  if (running || !setBar) return;
  if (href && isCurrentUrl(href)) return;
  const set = setBar;
  running = true;
  clearTimers();
  timers.push(
    setTimeout(() => {
      set(0.08);
      const tick = () => {
        set((previous) => (previous === null ? previous : Math.min(0.9, previous + (0.9 - previous) * 0.12)));
        timers.push(setTimeout(tick, TRICKLE_MS));
      };
      timers.push(setTimeout(tick, TRICKLE_MS));
    }, SHOW_DELAY_MS),
  );
  timers.push(setTimeout(finishNavigationProgress, MAX_MS));
}

function finishNavigationProgress() {
  if (!running || !setBar) return;
  const set = setBar;
  running = false;
  clearTimers();
  timers.push(setTimeout(() => set((previous) => (previous === null ? null : 1)), 0));
  timers.push(setTimeout(() => set(null), DONE_MS));
}

function isInternalNavigation(event: MouseEvent): boolean {
  if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
    return false;
  }
  const target = event.target;
  if (!(target instanceof Element)) return false;
  const anchor = target.closest("a[href]");
  if (!(anchor instanceof HTMLAnchorElement)) return false;
  if (anchor.target && anchor.target !== "_self") return false;
  if (anchor.hasAttribute("download")) return false;
  const url = new URL(anchor.href, window.location.href);
  if (url.origin !== window.location.origin) return false;
  return url.pathname !== window.location.pathname || url.search !== window.location.search;
}

export default function NavigationProgress() {
  const pathname = usePathname();
  const search = useSearchParams().toString();
  const [progress, setProgress] = useState<Progress>(null);

  useEffect(() => {
    setBar = setProgress;
    const onClick = (event: MouseEvent) => {
      if (isInternalNavigation(event)) startNavigationProgress();
    };
    document.addEventListener("click", onClick, true);
    return () => {
      document.removeEventListener("click", onClick, true);
      setBar = null;
      running = false;
      clearTimers();
    };
  }, []);

  useEffect(() => {
    finishNavigationProgress();
  }, [pathname, search]);

  if (progress === null) return null;

  return (
    <div
      aria-hidden="true"
      className="nav-progress"
      data-done={progress === 1 ? "true" : undefined}
      style={{ width: `${progress * 100}%` }}
    />
  );
}

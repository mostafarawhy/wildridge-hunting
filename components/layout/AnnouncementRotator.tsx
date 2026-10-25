"use client";

import {
  useEffect,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";

const INTERVAL_MS = 5000;
const REDUCED_QUERY = "(prefers-reduced-motion: reduce)";

function subscribeReduced(onChange: () => void) {
  const mq = window.matchMedia(REDUCED_QUERY);
  mq.addEventListener("change", onChange);
  return () => mq.removeEventListener("change", onChange);
}

interface AnnouncementRotatorProps {
  items: ReactNode[];
}

export default function AnnouncementRotator({
  items,
}: AnnouncementRotatorProps) {
  const reduced = useSyncExternalStore(
    subscribeReduced,
    () => window.matchMedia(REDUCED_QUERY).matches,
    () => false,
  );
  const [active, setActive] = useState(0);
  const [pointerDown, setPointerDown] = useState(false);
  const [focusInside, setFocusInside] = useState(false);
  const [docHidden, setDocHidden] = useState(false);

  const count = items.length;
  const rotating = count > 1 && !reduced;
  const paused = pointerDown || focusInside || docHidden;

  useEffect(() => {
    function onVisibility() {
      setDocHidden(document.hidden);
    }
    onVisibility();
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, []);

  useEffect(() => {
    if (!pointerDown) return;
    function release() {
      setPointerDown(false);
    }
    window.addEventListener("pointerup", release);
    window.addEventListener("pointercancel", release);
    return () => {
      window.removeEventListener("pointerup", release);
      window.removeEventListener("pointercancel", release);
    };
  }, [pointerDown]);

  useEffect(() => {
    if (!rotating || paused) return;
    const id = window.setInterval(() => {
      setActive((prev) => (prev + 1) % count);
    }, INTERVAL_MS);
    return () => window.clearInterval(id);
  }, [rotating, paused, count]);

  if (reduced) {
    return (
      <div className="flex flex-col gap-1">
        {items.map((item, i) => (
          <div key={i}>{item}</div>
        ))}
      </div>
    );
  }

  const current = active % Math.max(count, 1);

  return (
    <div
      className="grid"
      onPointerDown={() => setPointerDown(true)}
      onFocus={() => setFocusInside(true)}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
          setFocusInside(false);
        }
      }}
    >
      {items.map((item, i) => {
        const isActive = i === current;
        return (
          <div
            key={i}
            aria-hidden={isActive ? undefined : true}
            style={{
              gridArea: "1 / 1",
              opacity: isActive ? 1 : 0,
              visibility: isActive ? "visible" : "hidden",
              transition: "opacity 300ms ease, visibility 300ms",
            }}
          >
            {item}
          </div>
        );
      })}
    </div>
  );
}

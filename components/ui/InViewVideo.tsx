"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";

const REDUCED_MOTION = "(prefers-reduced-motion: reduce)";

type InViewVideoProps = Omit<
  React.ComponentProps<"video">,
  "autoPlay" | "preload" | "ref"
> & {
  pauseLabel?: string;
  playLabel?: string;
  controlClassName?: string;
};

function subscribeReducedMotion(onChange: () => void) {
  const query = window.matchMedia(REDUCED_MOTION);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

function getReducedMotion() {
  return window.matchMedia(REDUCED_MOTION).matches;
}

function getServerReducedMotion() {
  return false;
}

export default function InViewVideo({
  pauseLabel,
  playLabel,
  controlClassName,
  poster,
  ...videoProps
}: InViewVideoProps) {
  const ref = useRef<HTMLVideoElement>(null);
  const inViewRef = useRef(false);
  const userPausedRef = useRef<boolean | null>(null);
  const hasControls = !!(pauseLabel && playLabel);
  const reducedMotion = useSyncExternalStore(
    subscribeReducedMotion,
    getReducedMotion,
    getServerReducedMotion,
  );
  const [userPaused, setUserPaused] = useState<boolean | null>(null);
  const [posterReady, setPosterReady] = useState(false);
  const paused = userPaused ?? reducedMotion;

  useEffect(() => {
    const video = ref.current;
    if (!video) return;
    if (!hasControls && getReducedMotion()) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        inViewRef.current = entry.isIntersecting;
        if (entry.isIntersecting) {
          const blocked = userPausedRef.current ?? getReducedMotion();
          if (!blocked) video.play().catch(() => {});
        } else video.pause();
      },
      { threshold: 0.25 },
    );
    observer.observe(video);
    return () => observer.disconnect();
  }, [hasControls]);

  useEffect(() => {
    const video = ref.current;
    if (!video) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setPosterReady(true);
          observer.disconnect();
        }
      },
      { rootMargin: "100% 0px" },
    );
    observer.observe(video);
    return () => observer.disconnect();
  }, []);

  function toggle() {
    const next = !paused;
    userPausedRef.current = next;
    setUserPaused(next);
    const video = ref.current;
    if (!video) return;
    if (next) video.pause();
    else if (inViewRef.current) video.play().catch(() => {});
  }

  const video = (
    <video {...videoProps} poster={posterReady ? poster : undefined} ref={ref} muted loop playsInline preload="none" />
  );
  if (!hasControls) return video;

  return (
    <>
      {video}
      <button
        type="button"
        onClick={toggle}
        aria-label={paused ? playLabel : pauseLabel}
        className={`absolute flex items-center justify-center rounded-full cursor-pointer ${controlClassName ?? ""}`}
        style={{
          zIndex: 4,
          width: "44px",
          height: "44px",
          backgroundColor: "rgba(0,0,0,0.55)",
          border: "1px solid rgba(255,255,255,0.35)",
          color: "var(--primitive-white)",
        }}
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="currentColor"
          aria-hidden="true"
        >
          {paused ? (
            <path d="M7 4.5v15a1 1 0 0 0 1.5.86l12-7.5a1 1 0 0 0 0-1.72l-12-7.5A1 1 0 0 0 7 4.5z" />
          ) : (
            <>
              <rect x="5" y="4" width="5" height="16" rx="1" />
              <rect x="14" y="4" width="5" height="16" rx="1" />
            </>
          )}
        </svg>
      </button>
    </>
  );
}

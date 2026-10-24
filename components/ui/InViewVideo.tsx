"use client";

import { useEffect, useRef } from "react";

type InViewVideoProps = Omit<
  React.ComponentProps<"video">,
  "autoPlay" | "preload" | "ref"
>;

export default function InViewVideo(props: InViewVideoProps) {
  const ref = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = ref.current;
    if (!video) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) video.play().catch(() => {});
        else video.pause();
      },
      { threshold: 0.25 },
    );
    observer.observe(video);
    return () => observer.disconnect();
  }, []);

  return <video {...props} ref={ref} muted loop playsInline preload="none" />;
}

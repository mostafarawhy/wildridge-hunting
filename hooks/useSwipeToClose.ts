"use client";

import { useRef, useCallback, type RefObject } from "react";

const CLOSE_DISTANCE = 80;
const CLOSE_VELOCITY = 0.5;
const STALE_MS = 100;

export function useSwipeToClose(
  panelRef: RefObject<HTMLDivElement | null>,
  onClose: () => void,
) {
  const startY = useRef<number | null>(null);
  const lastY = useRef(0);
  const lastTime = useRef(0);
  const velocity = useRef(0);

  const onPointerDown = useCallback((e: React.PointerEvent<HTMLElement>) => {
    if ((e.target as HTMLElement).closest("button, a")) return;
    startY.current = e.clientY;
    lastY.current = e.clientY;
    lastTime.current = e.timeStamp;
    velocity.current = 0;
    if (panelRef.current) panelRef.current.style.transition = "none";
    e.currentTarget.setPointerCapture(e.pointerId);
  }, [panelRef]);

  const onPointerMove = useCallback((e: React.PointerEvent<HTMLElement>) => {
    if (startY.current === null) return;
    const dt = e.timeStamp - lastTime.current;
    if (dt > 0) velocity.current = (e.clientY - lastY.current) / dt;
    lastY.current = e.clientY;
    lastTime.current = e.timeStamp;
    const dy = Math.max(0, e.clientY - startY.current);
    if (panelRef.current) {
      panelRef.current.style.transform = `translateY(${dy}px)`;
    }
  }, [panelRef]);

  const finish = useCallback(
    (e: React.PointerEvent<HTMLElement>) => {
      if (startY.current === null) return;
      const dy = Math.max(0, e.clientY - startY.current);
      const stale = e.timeStamp - lastTime.current > STALE_MS;
      const speed = stale ? 0 : velocity.current;
      startY.current = null;
      if (dy > CLOSE_DISTANCE || speed > CLOSE_VELOCITY) {
        onClose();
        return;
      }
      const el = panelRef.current;
      if (!el) return;
      const reduced = window.matchMedia(
        "(prefers-reduced-motion: reduce)",
      ).matches;
      el.style.transition = reduced ? "none" : "transform 200ms ease-out";
      el.style.transform = "translateY(0)";
    },
    [onClose, panelRef],
  );

  return {
    onPointerDown,
    onPointerMove,
    onPointerUp: finish,
    onPointerCancel: finish,
  };
}

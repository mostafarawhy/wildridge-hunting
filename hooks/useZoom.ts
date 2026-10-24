"use client";

import { useState, useRef, useCallback, useEffect } from "react";

const MIN_SCALE = 1;
const MAX_SCALE = 4;

interface UseZoomOptions {
  containerRef: React.RefObject<HTMLDivElement | null>;
}

export function useZoom({ containerRef }: UseZoomOptions) {
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [isDraggingState, setIsDraggingState] = useState(false);

  const isDragging = useRef(false);
  const dragStart = useRef({ x: 0, y: 0 });
  const offsetAtDragStart = useRef({ x: 0, y: 0 });
  const lastPinchDist = useRef<number | null>(null);

  const isZoomed = scale > 1;

  const clampOffset = useCallback(
    (newOffset: { x: number; y: number }, newScale: number) => {
      const el = containerRef.current;
      if (!el) return newOffset;
      const { width, height } = el.getBoundingClientRect();
      const maxX = (width * (newScale - 1)) / 2;
      const maxY = (height * (newScale - 1)) / 2;
      return {
        x: Math.max(-maxX, Math.min(maxX, newOffset.x)),
        y: Math.max(-maxY, Math.min(maxY, newOffset.y)),
      };
    },
    [containerRef],
  );

  const resetZoom = useCallback(() => {
    setScale(1);
    setOffset({ x: 0, y: 0 });
  }, []);

  const applyScaleDelta = useCallback(
    (delta: number) => {
      setScale((prev) => {
        const next = Math.min(MAX_SCALE, Math.max(MIN_SCALE, prev + delta));
        if (next === MIN_SCALE) setOffset({ x: 0, y: 0 });
        else setOffset((o) => clampOffset(o, next));
        return next;
      });
    },
    [clampOffset],
  );

  const handleWheel = useCallback(
    (e: WheelEvent) => {
      e.preventDefault();
      applyScaleDelta(-e.deltaY * 0.003);
    },
    [applyScaleDelta],
  );

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    el.addEventListener("wheel", handleWheel, { passive: false });
    return () => el.removeEventListener("wheel", handleWheel);
  }, [containerRef, handleWheel]);

  const onMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (scale <= 1) return;
      isDragging.current = true;
      setIsDraggingState(true);
      dragStart.current = { x: e.clientX, y: e.clientY };
      offsetAtDragStart.current = offset;
    },
    [scale, offset],
  );

  const onMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!isDragging.current) return;
      const dx = e.clientX - dragStart.current.x;
      const dy = e.clientY - dragStart.current.y;
      setOffset(
        clampOffset(
          {
            x: offsetAtDragStart.current.x + dx,
            y: offsetAtDragStart.current.y + dy,
          },
          scale,
        ),
      );
    },
    [clampOffset, scale],
  );

  const onMouseUp = useCallback(() => {
    isDragging.current = false;
    setIsDraggingState(false);
  }, []);

  const onTouchStart = useCallback(
    (e: React.TouchEvent) => {
      if (e.touches.length === 2) {
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        lastPinchDist.current = Math.hypot(dx, dy);
      } else if (e.touches.length === 1 && scale > 1) {
        isDragging.current = true;
        setIsDraggingState(true);
        dragStart.current = {
          x: e.touches[0].clientX,
          y: e.touches[0].clientY,
        };
        offsetAtDragStart.current = offset;
      }
    },
    [scale, offset],
  );

  const onTouchMove = useCallback(
    (e: React.TouchEvent) => {
      if (e.touches.length === 2 && lastPinchDist.current !== null) {
        e.preventDefault();
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        const dist = Math.hypot(dx, dy);
        const delta = (dist - lastPinchDist.current) * 0.01;
        lastPinchDist.current = dist;
        applyScaleDelta(delta);
      } else if (e.touches.length === 1 && isDragging.current) {
        const dx = e.touches[0].clientX - dragStart.current.x;
        const dy = e.touches[0].clientY - dragStart.current.y;
        setOffset(
          clampOffset(
            {
              x: offsetAtDragStart.current.x + dx,
              y: offsetAtDragStart.current.y + dy,
            },
            scale,
          ),
        );
      }
    },
    [applyScaleDelta, clampOffset, scale],
  );

  const onTouchEnd = useCallback((e: React.TouchEvent) => {
    if (e.touches.length < 2) lastPinchDist.current = null;
    if (e.touches.length === 0) {
      isDragging.current = false;
      setIsDraggingState(false);
    }
  }, []);

  return {
    scale,
    offset,
    isZoomed,
    isDragging: isDraggingState,
    resetZoom,
    handlers: {
      onMouseDown,
      onMouseMove,
      onMouseUp,
      onMouseLeave: onMouseUp,
      onTouchStart,
      onTouchMove,
      onTouchEnd,
    },
  };
}

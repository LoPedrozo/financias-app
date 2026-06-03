import { useRef } from "react";
import type { TouchEvent } from "react";

interface UseSwipeOptions {
  onSwipeLeft: () => void;
  onSwipeRight: () => void;
  threshold?: number;
}

export function useSwipe({
  onSwipeLeft,
  onSwipeRight,
  threshold = 50,
}: UseSwipeOptions) {
  const startX = useRef<number | null>(null);
  const startY = useRef<number | null>(null);

  function onTouchStart(e: TouchEvent<HTMLDivElement>) {
    const touch = e.touches[0];
    if (!touch) return;
    startX.current = touch.clientX;
    startY.current = touch.clientY;
  }

  function onTouchEnd(e: TouchEvent<HTMLDivElement>) {
    if (startX.current === null || startY.current === null) return;
    const touch = e.changedTouches[0];
    if (!touch) {
      startX.current = null;
      startY.current = null;
      return;
    }
    const deltaX = touch.clientX - startX.current;
    const deltaY = touch.clientY - startY.current;

    startX.current = null;
    startY.current = null;

    if (Math.abs(deltaY) > Math.abs(deltaX)) return;

    if (deltaX < -threshold) onSwipeLeft();
    else if (deltaX > threshold) onSwipeRight();
  }

  return { onTouchStart, onTouchEnd };
}

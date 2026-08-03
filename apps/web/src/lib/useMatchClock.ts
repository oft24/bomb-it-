import { useEffect, useRef, useState } from "react";

/** Ticks a high-frequency elapsed-time readout without re-rendering the whole tree at 60fps. */
export function useMatchClock(startedAt: number | null, running: boolean): number {
  const [elapsed, setElapsed] = useState(0);
  const frame = useRef<number | null>(null);

  useEffect(() => {
    if (!running || startedAt == null) return;
    const tick = () => {
      setElapsed(Date.now() - startedAt);
      frame.current = requestAnimationFrame(tick);
    };
    frame.current = requestAnimationFrame(tick);
    return () => {
      if (frame.current) cancelAnimationFrame(frame.current);
    };
  }, [startedAt, running]);

  return elapsed;
}

"use client";

import { useEffect, useState } from "react";

/**
 * Current unix time in seconds, re-rendering once a second.
 *
 * Returns null until the component has mounted. The clock would otherwise
 * differ between the server render and the first client render, which React
 * reports as a hydration mismatch — so callers render a placeholder until this
 * goes non-null.
 */
export function useNow(): number | null {
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    const tick = () => setNow(Math.floor(Date.now() / 1000));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  return now;
}

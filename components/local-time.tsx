"use client";

import { useEffect, useState } from "react";

/** Renders a time in the viewer's own timezone. Server render shows UTC until hydration. */
export function LocalTime({ iso, withDate = false }: { iso: string; withDate?: boolean }) {
  const [tz, setTz] = useState<string | undefined>("UTC");
  useEffect(() => {
    setTz(undefined);
  }, []);
  const d = new Date(iso);
  const label = new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    ...(withDate ? { month: "short", day: "numeric" } : {}),
    hour: "numeric",
    minute: "2-digit",
    timeZone: tz,
    timeZoneName: tz ? "short" : undefined,
  }).format(d);
  return (
    <time dateTime={iso} suppressHydrationWarning>
      {label}
    </time>
  );
}

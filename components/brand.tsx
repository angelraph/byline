/** BYLINE logo. Swaps to the ink version on light backgrounds. */
export function Logo({ variant = "full", className = "" }: { variant?: "full" | "mark" | "wordmark"; className?: string }) {
  const file = { full: "byline-logo", mark: "byline-mark", wordmark: "byline-wordmark" }[variant];
  const size = { full: { w: 1047, h: 293 }, mark: { w: 333, h: 293 }, wordmark: { w: 692, h: 127 } }[variant];
  return (
    <picture className={className}>
      <source srcSet={`/brand/${file}-ink.png`} media="(prefers-color-scheme: light)" />
      <img src={`/brand/${file}.png`} alt="BYLINE" width={size.w} height={size.h} className="h-full w-auto" />
    </picture>
  );
}

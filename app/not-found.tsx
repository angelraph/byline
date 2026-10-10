import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-lg py-20 text-center">
      <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-paper-mute">404</p>
      <h1 className="mt-2 font-display text-3xl font-semibold">Nothing on the record here</h1>
      <p className="mt-2 text-paper-dim">That market, byline, or page doesn&apos;t exist, or it was removed.</p>
      <Link href="/" className="mt-6 inline-block rounded-full bg-accent px-5 py-2.5 text-sm font-semibold text-accent-ink">
        Back home
      </Link>
    </div>
  );
}

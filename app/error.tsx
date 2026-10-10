"use client";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="mx-auto max-w-lg py-20 text-center">
      <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-no">Something broke</p>
      <h1 className="mt-2 font-serif text-3xl font-semibold">This page couldn&apos;t load</h1>
      <p className="mt-2 text-paper-dim">
        {error.message.includes("Panta") ? error.message : "A data source didn't respond. Try again in a moment."}
      </p>
      <button
        type="button"
        onClick={reset}
        className="mt-6 rounded-full bg-accent px-5 py-2.5 text-sm font-semibold text-accent-ink"
      >
        Try again
      </button>
    </div>
  );
}

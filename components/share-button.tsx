"use client";

import { useState } from "react";

/** Native share sheet on phones; X intent and copy-link elsewhere. */
export function ShareButton({ path, text }: { path: string; text: string }) {
  const [copied, setCopied] = useState(false);

  async function share() {
    const url = `${window.location.origin}${path}`;
    if (typeof navigator.share === "function") {
      try {
        await navigator.share({ title: "Byline", text, url });
        return;
      } catch {
        // User dismissed the sheet; fall through to copy.
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      window.open(`https://x.com/intent/post?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`, "_blank", "noopener");
    }
  }

  return (
    <div className="flex gap-2">
      <button type="button" onClick={() => void share()} className="rounded-full bg-accent px-4 py-2 text-sm font-semibold text-accent-ink hover:brightness-110">
        {copied ? "Link copied" : "Share"}
      </button>
      <a
        href={`https://x.com/intent/post?text=${encodeURIComponent(text)}`}
        onClick={(e) => {
          e.currentTarget.href = `https://x.com/intent/post?text=${encodeURIComponent(text)}&url=${encodeURIComponent(`${window.location.origin}${path}`)}`;
        }}
        target="_blank"
        rel="noreferrer"
        className="rounded-full border border-line-strong px-4 py-2 text-sm hover:border-paper-mute"
      >
        Post on X
      </a>
    </div>
  );
}

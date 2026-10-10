import type { ReactNode } from "react";

export function SectionHeader({
  kicker,
  title,
  action,
}: {
  kicker?: string;
  title: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-3 flex items-end justify-between gap-4 border-b border-line pb-2">
      <div>
        {kicker ? (
          <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-paper-mute">{kicker}</p>
        ) : null}
        <h2 className="font-display text-xl font-semibold leading-tight sm:text-2xl">{title}</h2>
      </div>
      {action}
    </div>
  );
}

export function Notice({ tone = "info", children }: { tone?: "info" | "warn" | "error"; children: ReactNode }) {
  const styles = {
    info: "border-line bg-ink-2 text-paper-dim",
    warn: "border-accent/40 bg-accent/10 text-paper",
    error: "border-no/40 bg-no-bg text-paper",
  }[tone];
  return <div className={`rounded-xl border px-4 py-3 text-sm ${styles}`}>{children}</div>;
}

export function EmptyState({ title, body, action }: { title: string; body?: string; action?: ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed border-line-strong px-6 py-10 text-center">
      <p className="font-display text-lg">{title}</p>
      {body ? <p className="mx-auto mt-1 max-w-md text-sm text-paper-dim">{body}</p> : null}
      {action ? <div className="mt-4 flex justify-center">{action}</div> : null}
    </div>
  );
}

export function LiveBadge() {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-live/15 px-2 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wider text-live">
      <span className="live-dot h-1.5 w-1.5 rounded-full bg-live" aria-hidden="true" />
      Live
    </span>
  );
}

export function PhaseBadge({ phase }: { phase: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    primary: { label: "Open", cls: "text-yes bg-yes-bg" },
    secondary: { label: "Graduated", cls: "text-accent bg-accent/10" },
    resolved: { label: "Resolved", cls: "text-paper-dim bg-ink-3" },
    cancelled: { label: "Cancelled", cls: "text-no bg-no-bg" },
  };
  const v = map[phase] ?? { label: phase, cls: "text-paper-dim bg-ink-3" };
  return (
    <span className={`rounded-full px-2 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wider ${v.cls}`}>
      {v.label}
    </span>
  );
}

import type { Division } from "@/lib/divisions";

export function DivisionBadge({ d, size = "sm" }: { d: Division; size?: "sm" | "md" }) {
  return (
    <span
      title={`${d.label} division: ${d.rule}`}
      className={`inline-flex items-center gap-1 rounded-full font-semibold ${d.className} ${size === "md" ? "px-3 py-1 text-xs" : "px-2 py-0.5 text-[10px]"}`}
    >
      <svg viewBox="0 0 24 24" className={size === "md" ? "h-3.5 w-3.5" : "h-3 w-3"} fill="currentColor" aria-hidden="true">
        <path d="M12 2l2.9 6.3 6.9.7-5.2 4.6 1.5 6.8L12 17l-6.1 3.4 1.5-6.8L2.2 9l6.9-.7z" />
      </svg>
      {d.label}
    </span>
  );
}

import type { SwitchState } from "@/lib/heartbeatState";

const STYLES: Record<SwitchState, { label: string; className: string }> = {
  alive: {
    label: "Alive",
    className: "bg-emerald-500/15 text-emerald-300 ring-emerald-500/30",
  },
  grace: {
    label: "Grace period",
    className: "bg-amber-500/15 text-amber-300 ring-amber-500/30",
  },
  expired: {
    label: "Expired",
    className: "bg-red-500/15 text-red-300 ring-red-500/30",
  },
  released: {
    label: "Released",
    className: "bg-violet-500/15 text-violet-300 ring-violet-500/30",
  },
};

export function StatusBadge({ state }: { state: SwitchState }) {
  const { label, className } = STYLES[state];
  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-sm font-bold ring-1 ring-inset ${className}`}
    >
      <span className="size-2 rounded-full bg-current" />
      {label}
    </span>
  );
}

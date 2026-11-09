import type { ReactNode } from "react";

export function Card({
  title,
  hint,
  children,
}: {
  title?: string;
  /** One short line explaining what this section is for. */
  hint?: string;
  children: ReactNode;
}) {
  return (
    <section className="w-full rounded-xl border border-white/10 bg-white/[0.02] p-6">
      {title && (
        <h2 className="mb-4 flex flex-wrap items-baseline gap-x-2">
          <span className="text-sm uppercase tracking-wider text-neutral-500">
            {title}
          </span>
          {hint && (
            <span className="text-xs normal-case text-neutral-600">
              ({hint})
            </span>
          )}
        </h2>
      )}
      {children}
    </section>
  );
}

export function Button({
  children,
  onClick,
  disabled,
  busy,
  variant = "default",
  type = "button",
}: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  busy?: boolean;
  variant?: "default" | "primary" | "danger";
  type?: "button" | "submit";
}) {
  const variants = {
    default: "border-white/20 text-neutral-200 hover:bg-white/10",
    primary:
      "border-emerald-500/40 bg-emerald-500/15 text-emerald-200 hover:bg-emerald-500/25",
    danger: "border-red-500/40 text-red-300 hover:bg-red-500/15",
  };
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || busy}
      className={`rounded-lg border px-4 py-2 text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent ${variants[variant]}`}
    >
      {busy ? "…" : children}
    </button>
  );
}

export function TextInput({
  value,
  onChange,
  placeholder,
  disabled,
  mono = true,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  disabled?: boolean;
  mono?: boolean;
}) {
  return (
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      disabled={disabled}
      className={`min-w-0 flex-1 rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-sm outline-none placeholder:text-neutral-600 focus:border-white/40 disabled:opacity-40 ${mono ? "font-mono" : ""}`}
    />
  );
}

/** Shows why an action is unavailable, or what went wrong. */
export function Note({
  children,
  tone = "muted",
}: {
  children: ReactNode;
  tone?: "muted" | "error";
}) {
  return (
    <p
      className={`mt-2 text-xs ${tone === "error" ? "text-red-300" : "text-neutral-500"}`}
    >
      {children}
    </p>
  );
}

/**
 * wagmi surfaces the raw node error, which buries the useful part. Contract
 * reverts in Heartbeat.sol are plain require strings, so pull those out.
 */
export function revertReason(error: Error | null): string | null {
  if (!error) return null;
  const message =
    "shortMessage" in error ? String(error.shortMessage) : error.message;
  const match = /execution reverted:?\s*([^"\n]+)/i.exec(error.message);
  if (match) return match[1].trim();
  if (/user rejected|denied/i.test(message))
    return "You rejected the transaction.";
  return message.split("\n")[0];
}

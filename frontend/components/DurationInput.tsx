"use client";

const UNITS = [
  { label: "minutes", seconds: 60 },
  { label: "hours", seconds: 3600 },
  { label: "days", seconds: 86400 },
  { label: "weeks", seconds: 604800 },
];

/** A number plus a unit, reported to the parent as plain seconds. */
export function DurationInput({
  amount,
  unitIndex,
  onChange,
}: {
  amount: string;
  unitIndex: number;
  onChange: (amount: string, unitIndex: number) => void;
}) {
  const seconds = Number(amount) * UNITS[unitIndex].seconds;

  return (
    <div className="flex items-center gap-2">
      <input
        type="text"
        inputMode="numeric"
        value={amount}
        // Digits only, so a text field behaves like a number field without
        // inheriting the browser's spinner arrows.
        onChange={(e) =>
          onChange(e.target.value.replace(/[^0-9]/g, ""), unitIndex)
        }
        className="w-14 rounded-lg border border-white/15 bg-black/40 px-2 py-1.5 font-mono text-sm outline-none focus:border-white/40"
      />
      <select
        value={unitIndex}
        onChange={(e) => onChange(amount, Number(e.target.value))}
        className="rounded-lg border border-white/15 bg-black/40 px-2 py-1.5 text-sm outline-none focus:border-white/40"
      >
        {UNITS.map((unit, i) => (
          <option key={unit.label} value={i} className="bg-neutral-900">
            {unit.label}
          </option>
        ))}
      </select>
      {Number.isFinite(seconds) && seconds > 0 && (
        <span className="text-xs whitespace-nowrap text-neutral-600">
          {seconds.toLocaleString()}s
        </span>
      )}
    </div>
  );
}

export function toSeconds(amount: string, unitIndex: number): number {
  return Math.floor(Number(amount) * UNITS[unitIndex].seconds);
}

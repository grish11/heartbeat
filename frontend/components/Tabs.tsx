"use client";

import { useState, type ReactNode } from "react";

export function Tabs({
  tabs,
}: {
  tabs: { id: string; label: string; content: ReactNode }[];
}) {
  const [active, setActive] = useState(tabs[0]?.id);
  const current = tabs.find((t) => t.id === active) ?? tabs[0];

  return (
    <div className="flex flex-col gap-6">
      <div role="tablist" className="flex border-b border-white/10">
        {tabs.map((tab) => {
          const selected = tab.id === current?.id;
          return (
            <button
              key={tab.id}
              role="tab"
              aria-selected={selected}
              onClick={() => setActive(tab.id)}
              // -mb-px pulls the active tab's border over the container's, so
              // the selected tab reads as connected to the panel below it.
              className={`-mb-px border-b-2 px-4 py-2 text-sm transition-colors ${
                selected
                  ? "border-emerald-400 text-neutral-100"
                  : "border-transparent text-neutral-500 hover:text-neutral-300"
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>
      <div role="tabpanel" className="flex flex-col gap-6">
        {current?.content}
      </div>
    </div>
  );
}

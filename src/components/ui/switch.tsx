'use client'

import { cn } from "@/lib/utils";

export interface SwitchProps {
  checked: boolean;
  onChange: (v: boolean) => void;
}

export function Switch({ checked, onChange }: SwitchProps) {
  return (
    <button
      onClick={() => onChange(!checked)}
      className={cn(
        "relative w-11 h-6 rounded-full transition-colors duration-200",
        checked ? "bg-[var(--color-primary)]" : "bg-[var(--color-surface-elevated)]"
      )}
    >
      <span
        className={cn(
          "absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform duration-200",
          checked ? "translate-x-5" : "translate-x-0"
        )}
      />
    </button>
  );
}

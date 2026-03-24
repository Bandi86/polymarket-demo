'use client'

import { cn } from "@/lib/utils";

export interface InputProps {
  type?: string;
  value: string | number;
  onChange: (v: string) => void;
  placeholder?: string;
  min?: number;
  max?: number;
  step?: number;
  className?: string;
}

export function Input({ type = "text", value, onChange, placeholder, min, max, step, className }: InputProps) {
  return (
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      min={min}
      max={max}
      step={step}
      className={cn(
        "w-full px-3 py-2 bg-[var(--color-surface-elevated)] border border-[var(--color-border)] rounded-lg",
        "text-[var(--color-text-primary)] placeholder-[var(--color-text-muted)]",
        "focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:border-transparent",
        "transition-all duration-200",
        className
      )}
    />
  );
}

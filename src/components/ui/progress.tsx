import { cn } from "../../lib/utils";

export interface ProgressProps {
  value: number;
  className?: string;
}

export function Progress({ value, className }: ProgressProps) {
  return (
    <div className={cn("h-1.5 bg-[var(--color-surface-elevated)] rounded-full overflow-hidden", className)}>
      <div
        className={cn(
          "h-full rounded-full transition-all duration-500",
          value > 80 ? "bg-[var(--color-success)]" : value > 40 ? "bg-[var(--color-warning)]" : "bg-[var(--color-danger)]"
        )}
        style={{ width: `${Math.max(0, Math.min(100, value))}%` }}
      />
    </div>
  );
}

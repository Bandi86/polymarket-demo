'use client'

import { cn } from "@/lib/utils";

export interface BadgeProps {
  children: React.ReactNode;
  variant?: "default" | "success" | "danger" | "warning" | "info";
  className?: string;
}

export function Badge({ children, variant = "default", className }: BadgeProps) {
  const variants = {
    default: "bg-[var(--color-surface-elevated)] text-[var(--color-text-secondary)]",
    success: "bg-[var(--color-success-muted)] text-[var(--color-success)]",
    danger: "bg-[var(--color-danger-muted)] text-[var(--color-danger)]",
    warning: "bg-[var(--color-warning-muted)] text-[var(--color-warning)]",
    info: "bg-[var(--color-primary-muted)] text-[var(--color-primary)]",
  };

  return (
    <span className={cn("inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium", variants[variant], className)}>
      {children}
    </span>
  );
}

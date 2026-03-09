import { cn } from "../../lib/utils";

export interface TabsProps {
  value: string;
  onValueChange: (v: string) => void;
  children: React.ReactNode;
  className?: string;
}

export function Tabs({ value, onValueChange, children, className }: TabsProps) {
  return <div className={cn("", className)}>{children}</div>;
}

export interface TabsListProps {
  children: React.ReactNode;
  className?: string;
}

export function TabsList({ children, className }: TabsListProps) {
  return <div className={cn("flex gap-1 p-1 bg-[var(--color-surface-elevated)] rounded-lg", className)}>{children}</div>;
}

export interface TabsTriggerProps {
  value: string;
  children: React.ReactNode;
  isActive: boolean;
  onClick: () => void;
}

export function TabsTrigger({ value, children, isActive, onClick }: TabsTriggerProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "px-3 py-1.5 text-sm font-medium rounded-md transition-all duration-200",
        isActive ? "bg-[var(--color-primary)] text-white shadow-sm" : "text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
      )}
    >
      {children}
    </button>
  );
}

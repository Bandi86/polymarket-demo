import { useState } from "react";
import { cn } from "../../lib/utils";

export interface TooltipProps {
  children: React.ReactNode;
  content: string;
}

export function Tooltip({ children, content }: TooltipProps) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative inline-block" onMouseEnter={() => setShow(true)} onMouseLeave={() => setShow(false)}>
      {children}
      {show && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-[var(--color-surface-elevated)] text-xs text-[var(--color-text-secondary)] rounded whitespace-nowrap z-50 border border-[var(--color-border)]">
          {content}
        </div>
      )}
    </div>
  );
}

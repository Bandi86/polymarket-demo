'use client'

import { cn, formatCurrency, formatPercentage } from "@/lib/utils";
import type { Portfolio } from "@/types";

interface FooterProps {
  btcPrice: number;
  portfolio: Portfolio | null;
}

export function Footer({ btcPrice, portfolio }: FooterProps) {
  return (
    <footer className="border-t border-[var(--color-border)] mt-8 py-4">
      <div className="max-w-[1600px] mx-auto px-4 flex items-center justify-between text-xs text-[var(--color-text-muted)]">
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-[var(--color-success)] animate-pulse" />
            Live
          </span>
          <span>BTC: ${btcPrice.toLocaleString()}</span>
          <span>Source: Binance API</span>
        </div>
        <div className="flex items-center gap-4">
          <span>Fee: 2%</span>
          <span>Starting: {formatCurrency(portfolio?.initialBalance || 10)}</span>
          <span className={cn((portfolio?.roi || 0) >= 0 ? "text-[var(--color-success)]" : "text-[var(--color-danger)]")}>
            ROI: {formatPercentage((portfolio?.roi || 0) / 100)}
          </span>
        </div>
      </div>
    </footer>
  );
}

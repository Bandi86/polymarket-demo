'use client'

import { RefreshCw, RotateCcw, Zap, Shuffle } from "lucide-react";
import { cn, formatCurrency, formatRunTime } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import type { Portfolio } from "@/types";

interface Bot {
  id: string;
  name: string;
  enabled: boolean;
}

interface HeaderProps {
  portfolio: Portfolio | null;
  activeBot: Bot | undefined;
  runTimer: number;
  simulationMode: "real" | "simulated";
  onRefresh: () => void;
  onReset: () => void;
  onToggleMode: () => void;
}

export function Header({
  portfolio,
  activeBot,
  runTimer,
  simulationMode,
  onRefresh,
  onReset,
  onToggleMode,
}: HeaderProps) {
  return (
    <header className="border-b border-[var(--color-border)] bg-[var(--color-surface)]/50 backdrop-blur-sm sticky top-0 z-40">
      <div className="max-w-[1600px] mx-auto px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[var(--color-btc)] flex items-center justify-center text-white font-bold text-lg">
              ₿
            </div>
            <div>
              <h1 className="font-bold text-lg leading-tight">BTC Predictor</h1>
              <p className="text-xs text-[var(--color-text-muted)]">Polymarket Trading Simulator</p>
            </div>
          </div>

          <div className="flex items-center gap-6">
            <div className="text-right">
              <p className="text-xs text-[var(--color-text-muted)]">Balance</p>
              <p className={cn("font-mono font-bold", (portfolio?.balance || 0) >= (portfolio?.initialBalance || 10) ? "text-[var(--color-success)]" : "text-[var(--color-danger)]")}>
                {formatCurrency(portfolio?.balance || 0)}
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs text-[var(--color-text-muted)]">P&L</p>
              <p className={cn("font-mono font-bold", (portfolio?.totalPnL || 0) >= 0 ? "text-[var(--color-success)]" : "text-[var(--color-danger)]")}>
                {formatCurrency(portfolio?.totalPnL || 0)}
              </p>
            </div>
            {activeBot && (
              <div className="text-right">
                <p className="text-xs text-[var(--color-text-muted)]">Runtime</p>
                <p className="font-mono font-bold text-[var(--color-primary)]">{formatRunTime(runTimer)}</p>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={onRefresh}>
              <RefreshCw className="w-4 h-4" />
              New Market
            </Button>
            <Button
              variant={simulationMode === "real" ? "primary" : "outline"}
              size="sm"
              onClick={onToggleMode}
            >
              {simulationMode === "real" ? <Zap className="w-4 h-4" /> : <Shuffle className="w-4 h-4" />}
              {simulationMode === "real" ? "Live" : "Sim"}
            </Button>
            <Button variant="ghost" size="sm" onClick={onReset}>
              <RotateCcw className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>
    </header>
  );
}

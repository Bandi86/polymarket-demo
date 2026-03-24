'use client'

import { Clock, TrendingUp, TrendingDown, Target, Percent } from "lucide-react";
import { cn, formatCurrency, formatPercentage, formatTime } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import type { Portfolio } from "@/types";

interface StatsGridProps {
  btcPrice: number;
  timeRemaining: number;
  marketDuration: number;
  yesPrice: number;
  noPrice: number;
  yesPayout: number;
  noPayout: number;
  portfolio: Portfolio | null;
  simulationMode: "real" | "simulated";
}

export function StatsGrid({
  btcPrice,
  timeRemaining,
  marketDuration,
  yesPrice,
  noPrice,
  yesPayout,
  noPayout,
  portfolio,
  simulationMode,
}: StatsGridProps) {
  const progress = marketDuration > 0 ? (timeRemaining / marketDuration) * 100 : 0;
  const timeProgress = 100 - progress;
  const isWarning = progress < 15;

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-4">
      <Card>
        <CardContent className="p-3">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-2 h-2 rounded-full bg-[var(--color-btc)] animate-pulse" />
            <span className="text-xs text-[var(--color-text-muted)]">BTC Price</span>
          </div>
          <p className="font-mono font-bold text-lg text-[var(--color-btc)]">
            ${btcPrice.toLocaleString()}
          </p>
          <p className="text-xs text-[var(--color-text-muted)]">
            {simulationMode === "real" ? "Binance Live" : "Simulated"}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-3">
          <div className="flex items-center gap-2 mb-1">
            <Clock className="w-3 h-3 text-[var(--color-text-muted)]" />
            <span className="text-xs text-[var(--color-text-muted)]">Time Left</span>
          </div>
          <p className={cn("font-mono font-bold text-lg", isWarning ? "text-[var(--color-danger)]" : "")}>
            {formatTime(timeRemaining)}
          </p>
          <Progress value={timeProgress} className="mt-1" />
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-3">
          <div className="flex items-center gap-2 mb-1">
            <TrendingUp className="w-3 h-3 text-[var(--color-success)]" />
            <span className="text-xs text-[var(--color-text-muted)]">YES Price</span>
          </div>
          <p className="font-mono font-bold text-lg text-[var(--color-success)]">
            {yesPrice.toFixed(3)}
          </p>
          <p className="text-xs text-[var(--color-text-muted)]">
            {formatCurrency(yesPayout)} payout
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-3">
          <div className="flex items-center gap-2 mb-1">
            <TrendingDown className="w-3 h-3 text-[var(--color-danger)]" />
            <span className="text-xs text-[var(--color-text-muted)]">NO Price</span>
          </div>
          <p className="font-mono font-bold text-lg text-[var(--color-danger)]">
            {noPrice.toFixed(3)}
          </p>
          <p className="text-xs text-[var(--color-text-muted)]">
            {formatCurrency(noPayout)} payout
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-3">
          <div className="flex items-center gap-2 mb-1">
            <Target className="w-3 h-3 text-[var(--color-text-muted)]" />
            <span className="text-xs text-[var(--color-text-muted)]">Win Rate</span>
          </div>
          <p className="font-mono font-bold text-lg">
            {formatPercentage(portfolio?.winRate || 0)}
          </p>
          <p className="text-xs text-[var(--color-text-muted)]">
            {portfolio?.totalTrades || 0} trades
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-3">
          <div className="flex items-center gap-2 mb-1">
            <Percent className="w-3 h-3 text-[var(--color-text-muted)]" />
            <span className="text-xs text-[var(--color-text-muted)]">ROI</span>
          </div>
          <p className={cn("font-mono font-bold text-lg", (portfolio?.roi || 0) >= 0 ? "text-[var(--color-success)]" : "text-[var(--color-danger)]")}>
            {formatPercentage((portfolio?.roi || 0) / 100)}
          </p>
          <p className="text-xs text-[var(--color-text-muted)]">
            Since start
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

import { PieChart } from "lucide-react";
import { cn, formatCurrency, formatPercentage } from "../lib/utils";
import { Card, CardHeader, CardTitle, CardContent } from "./ui/card";
import type { BotConfig } from "../types";

interface BotSummaryProps {
  bots: BotConfig[];
}

export function BotSummary({ bots }: BotSummaryProps) {
  const totalBotTrades = bots.reduce((s, b) => s + b.stats.trades, 0);
  const totalBotWins = bots.reduce((s, b) => s + b.stats.wins, 0);
  const totalBotPnl = bots.reduce((s, b) => s + b.stats.pnl, 0);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <PieChart className="w-4 h-4 text-[var(--color-primary)]" />
          <CardTitle className="text-sm">Bot Summary</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="p-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="p-3 bg-[var(--color-surface-elevated)] rounded-lg text-center">
            <p className="text-2xl font-bold">{totalBotTrades}</p>
            <p className="text-xs text-[var(--color-text-muted)]">Total Trades</p>
          </div>
          <div className="p-3 bg-[var(--color-surface-elevated)] rounded-lg text-center">
            <p className="text-2xl font-bold text-[var(--color-success)]">{totalBotWins}</p>
            <p className="text-xs text-[var(--color-text-muted)]">Wins</p>
          </div>
          <div className="p-3 bg-[var(--color-surface-elevated)] rounded-lg text-center">
            <p className="text-2xl font-bold">
              {totalBotTrades > 0 ? formatPercentage(totalBotWins / totalBotTrades) : "0%"}
            </p>
            <p className="text-xs text-[var(--color-text-muted)]">Win Rate</p>
          </div>
          <div className="p-3 bg-[var(--color-surface-elevated)] rounded-lg text-center">
            <p className={cn("text-2xl font-bold", totalBotPnl >= 0 ? "text-[var(--color-success)]" : "text-[var(--color-danger)]")}>
              {formatCurrency(totalBotPnl)}
            </p>
            <p className="text-xs text-[var(--color-text-muted)]">Total P&L</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

import { useState } from "react";
import { Bot, Play, Square, Settings, ChevronDown, ChevronUp, Clock, TrendingUp, TrendingDown, AlertCircle, CheckCircle, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { getStrategyColor, getStrategyName } from "@/lib/design-tokens";
import { AnimatedCounter } from "@/components/ui/AnimatedCounter";
import { ProgressRing } from "@/components/ui/ProgressRing";
import type { BotData } from "@/hooks/useTradingData";

interface BotStatusCardProps {
  bot: BotData;
  yesPrice: number;
  noPrice: number;
  positions: Array<{
    id: string;
    botId?: string;
    outcome: "YES" | "NO";
    amount: number;
    stake: number;
  }>;
  onToggle: (botId: string) => Promise<void>;
  onOpenConfig: (bot: BotData) => void;
}

function formatDuration(ms: number): string {
  if (!ms || ms <= 0) return "0s";
  if (ms < 60000) return `${Math.floor(ms / 1000)}s`;
  if (ms < 3600000) return `${Math.floor(ms / 60000)}m ${Math.floor((ms % 60000) / 1000)}s`;
  return `${Math.floor(ms / 3600000)}h ${Math.floor((ms % 3600000) / 60000)}m`;
}

export function BotStatusCard({ bot, yesPrice, noPrice, positions, onToggle, onOpenConfig }: BotStatusCardProps) {
  const [showDebug, setShowDebug] = useState(false);
  const [isToggling, setIsToggling] = useState(false);

  const strategyColor = getStrategyColor(bot.strategy);
  const strategyName = getStrategyName(bot.strategy);

  const botPositions = positions.filter(p => p.botId === bot.id);
  const unrealizedPnl = botPositions.reduce((sum, pos) => {
    if (pos.outcome === "YES") {
      return sum + (pos.amount * yesPrice - pos.stake);
    }
    return sum + (pos.amount * (1 - yesPrice) - pos.stake);
  }, 0);

  const initialBalance = 10;
  const pnlPercent = initialBalance > 0
    ? ((bot.portfolio.balance - initialBalance) / initialBalance) * 100
    : 0;

  // Calculate running time
  const runningTime = bot.enabled && bot.runTime ? Date.now() - bot.runTime : 0;

  // Determine bot health status
  const getHealthStatus = () => {
    if (!bot.enabled) return { status: "stopped", color: "text-muted-foreground", icon: XCircle };
    if (bot.stats.trades === 0 && runningTime > 60000) return { status: "idle", color: "text-warning", icon: AlertCircle };
    if (bot.stats.pnl < 0) return { status: "losing", color: "text-danger", icon: TrendingDown };
    return { status: "active", color: "text-success", icon: CheckCircle };
  };

  const health = getHealthStatus();
  const HealthIcon = health.icon;

  const handleToggle = async () => {
    if (isToggling) return;
    setIsToggling(true);
    try {
      await onToggle(bot.id);
    } finally {
      setIsToggling(false);
    }
  };

  return (
    <div
      className={cn(
        "glass-card p-4 rounded-xl flex flex-col gap-3 transition-all duration-300",
        bot.enabled ? "border-success/30" : "border-border"
      )}
      style={{ borderLeftColor: strategyColor, borderLeftWidth: "3px" }}
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div
            className={cn(
              "w-2 h-2 rounded-full",
              bot.enabled ? "bg-success animate-pulse" : "bg-muted-foreground"
            )}
          />
          <Bot className={cn("w-4 h-4", bot.enabled ? "text-success" : "text-muted-foreground")} />
          <span className="font-semibold text-sm">{bot.name}</span>
          <HealthIcon className={cn("w-3 h-3", health.color)} />
        </div>
        <div className="flex items-center gap-1">
          <span
            className={cn(
              "text-[10px] px-1.5 py-0.5 rounded font-medium",
              bot.enabled ? "bg-success/20 text-success" : "bg-muted/20 text-muted-foreground"
            )}
          >
            {strategyName}
          </span>
          <button
            onClick={() => onOpenConfig(bot)}
            className="p-1 bg-transparent border-none cursor-pointer text-muted-foreground hover:text-foreground transition-colors"
            title="Configure bot"
          >
            <Settings className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Timer & Market Info */}
      <div className="flex items-center justify-between p-2 bg-black/20 rounded-md text-xs">
        <div className="flex items-center gap-1">
          <Clock className="w-3 h-3 text-muted-foreground" />
          <span className={cn(
            "font-mono",
            bot.enabled ? "text-foreground" : "text-muted-foreground"
          )}>
            {bot.enabled ? formatDuration(runningTime) : "Stopped"}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="px-1.5 py-0.5 bg-success/20 rounded text-success font-mono text-[10px]">
            YES {yesPrice.toFixed(3)}
          </span>
          <span className="px-1.5 py-0.5 bg-danger/20 rounded text-danger font-mono text-[10px]">
            NO {noPrice.toFixed(3)}
          </span>
        </div>
      </div>

      {/* Stats Grid with ProgressRing */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <div className="text-[10px] text-muted-foreground mb-0.5">Balance</div>
          <div className="font-mono font-semibold">
            <AnimatedCounter
              value={bot.portfolio.balance}
              format="currency"
              decimals={2}
            />
          </div>
        </div>
        <div>
          <div className="text-[10px] text-muted-foreground mb-0.5">P&L</div>
          <div
            className={cn(
              "font-mono font-semibold",
              bot.stats.pnl >= 0 ? "text-success" : "text-danger"
            )}
          >
            <AnimatedCounter
              value={bot.stats.pnl}
              format="currency"
              decimals={2}
              previousValue={bot.stats.pnl - 0.5}
            />
            <span className="text-[10px] ml-1">
              ({pnlPercent >= 0 ? "+" : ""}{pnlPercent.toFixed(1)}%)
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <ProgressRing
            value={bot.stats.winRate * 100}
            size={28}
            strokeWidth={2.5}
          />
          <div>
            <div className="text-[10px] text-muted-foreground">Win Rate</div>
            <div className="font-mono text-sm">
              {bot.stats.winRate > 0 ? `${(bot.stats.winRate * 100).toFixed(0)}%` : "-"}
            </div>
          </div>
        </div>
        <div>
          <div className="text-[10px] text-muted-foreground">Trades</div>
          <div className="font-mono">{bot.stats.trades}</div>
        </div>
      </div>

      {/* Positions & Unrealized PnL */}
      {botPositions.length > 0 && (
        <div className="flex items-center justify-between p-2 bg-black/20 rounded-md text-xs">
          <div className="flex items-center gap-1">
            <TrendingUp className="w-3 h-3 text-primary" />
            <span>{botPositions.length} position{botPositions.length > 1 ? "s" : ""}</span>
          </div>
          <div
            className={cn(
              "font-mono",
              unrealizedPnl >= 0 ? "text-success" : "text-danger"
            )}
          >
            <AnimatedCounter
              value={unrealizedPnl}
              format="currency"
              decimals={2}
            />{" "}
            <span className="text-muted-foreground">unrealized</span>
          </div>
        </div>
      )}

      {/* Control Buttons */}
      <div className="flex gap-2">
        <button
          onClick={handleToggle}
          disabled={isToggling}
          className={cn(
            "flex-1 flex items-center justify-center gap-2 py-2 rounded-lg border-none text-sm font-semibold transition-all duration-200",
            bot.enabled
              ? "bg-gradient-to-br from-danger to-red-600 text-white"
              : "bg-gradient-to-br from-success to-green-600 text-white",
            isToggling && "opacity-70 cursor-not-allowed"
          )}
        >
          {isToggling ? (
            <span>...</span>
          ) : bot.enabled ? (
            <>
              <Square className="w-3 h-3" fill="currentColor" />
              Stop
            </>
          ) : (
            <>
              <Play className="w-3 h-3" fill="currentColor" />
              Start
            </>
          )}
        </button>
        <button
          onClick={() => setShowDebug(!showDebug)}
          className={cn(
            "px-3 py-2 rounded-lg border border-border text-sm cursor-pointer flex items-center gap-1 transition-colors",
            showDebug ? "bg-surface-elevated text-foreground" : "bg-transparent text-muted-foreground"
          )}
        >
          Debug
          {showDebug ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
        </button>
      </div>

      {/* Debug Panel */}
      {showDebug && (
        <div className="p-3 bg-black/30 rounded-lg text-xs flex flex-col gap-2 animate-slide-up">
          <div className="font-semibold text-muted-foreground">Debug Info</div>

          {/* Bot State */}
          <div className="grid grid-cols-2 gap-1">
            <div className="text-muted-foreground">Status:</div>
            <div className={bot.enabled ? "text-success" : "text-danger"}>
              {bot.enabled ? "Running" : "Stopped"}
            </div>

            <div className="text-muted-foreground">Interval:</div>
            <div className="font-mono">{bot.interval}s</div>

            <div className="text-muted-foreground">Bet Size:</div>
            <div className="font-mono">${bot.betSize.toFixed(2)}</div>

            <div className="text-muted-foreground">Session:</div>
            <div className="font-mono">
              {bot.enabled ? formatDuration(runningTime) : "N/A"}
            </div>
          </div>

          {/* Trading Activity Status */}
          <div className="mt-1 p-2 bg-black/20 rounded-md">
            <div className="text-muted-foreground mb-1">Trading Activity</div>
            {bot.stats.trades === 0 && runningTime > 30000 ? (
              <div className="text-warning">
                <AlertCircle className="w-3 h-3 inline mr-1" />
                No trades yet - {bot.strategy} strategy may be waiting for favorable conditions
              </div>
            ) : bot.stats.trades === 0 ? (
              <div className="text-muted-foreground">Waiting for first trade opportunity...</div>
            ) : (
              <div className="text-success">
                <CheckCircle className="w-3 h-3 inline mr-1" />
                Active trading - {bot.stats.trades} trade{bot.stats.trades > 1 ? "s" : ""} executed
              </div>
            )}
          </div>

          {/* Strategy Tips */}
          {bot.stats.trades === 0 && runningTime > 60000 && (
            <div className="mt-1 p-2 bg-primary/10 rounded-md border border-primary/20">
              <div className="text-primary font-medium mb-1">Suggestions</div>
              <ul className="m-0 pl-4 text-muted-foreground list-disc">
                <li>Try adjusting bet size or interval</li>
                <li>Check if market conditions suit the strategy</li>
                <li>Consider switching to a more active strategy</li>
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
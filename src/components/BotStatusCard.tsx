import { useState } from "react";
import { Bot, Play, Square, Settings, ChevronDown, ChevronUp, Clock, TrendingUp, TrendingDown, AlertCircle, CheckCircle, XCircle, Timer, Flame, Snowflake, BarChart2, DollarSign, Activity } from "lucide-react";
import { cn } from "@/lib/utils";
import { getStrategyColor, getStrategyName } from "@/lib/design-tokens";
import { AnimatedCounter } from "@/components/ui/AnimatedCounter";
import { ProgressRing } from "@/components/ui/ProgressRing";
import { MiniEquityCurve } from "./charts/MiniEquityCurve";
import type { BotData, MarketData } from "@/hooks/useTradingData";

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
  timeRemaining?: number;
  marketData?: MarketData | null;
}

function formatDuration(ms: number): string {
  if (!ms || ms <= 0) return "0s";
  if (ms < 60000) return `${Math.floor(ms / 1000)}s`;
  if (ms < 3600000) return `${Math.floor(ms / 60000)}m ${Math.floor((ms % 60000) / 1000)}s`;
  return `${Math.floor(ms / 3600000)}h ${Math.floor((ms % 3600000) / 60000)}m`;
}

export function BotStatusCard({ bot, yesPrice, noPrice, positions, onToggle, onOpenConfig, timeRemaining, marketData }: BotStatusCardProps) {
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

  // Extract recent trades and equity curve from closed positions
  const closedPositions = (bot.portfolio.closedPositions || []) as any[];
  
  // Recent 5 trades (assuming chronological order)
  const recentTrades = closedPositions.slice(-5).map((p: any) => p.pnl || 0);
  
  // Compute equity curve starting from initialBalance
  const equityCurvePlot = [initialBalance];
  let currentBalance = initialBalance;
  closedPositions.forEach((p: any) => {
    currentBalance += (p.pnl || 0);
    equityCurvePlot.push(currentBalance);
  });
  
  // Always aim for at least 2 points to draw the line
  if (equityCurvePlot.length === 1) {
    equityCurvePlot.push(initialBalance);
  }

  // Determine bot health status
  const getHealthStatus = () => {
    if (!bot.enabled) return { status: "stopped", color: "text-muted-foreground", icon: XCircle };
    if (bot.stats.trades === 0 && runningTime > 60000) return { status: "idle", color: "text-warning", icon: AlertCircle };
    if (bot.stats.pnl < 0) return { status: "losing", color: "text-danger", icon: TrendingDown };
    return { status: "active", color: "text-success", icon: CheckCircle };
  };

  const health = getHealthStatus();
  const HealthIcon = health.icon;

  // Calculate current streak from closed positions
  const getCurrentStreak = () => {
    if (closedPositions.length === 0) return { type: "none", count: 0 };
    let streak = 0;
    let streakType: "win" | "loss" = "win";
    for (let i = closedPositions.length - 1; i >= 0; i--) {
      const pnl = closedPositions[i].pnl || 0;
      if (i === closedPositions.length - 1) {
        streakType = pnl > 0 ? "win" : "loss";
        streak = 1;
      } else {
        const currentType = pnl > 0 ? "win" : "loss";
        if (currentType === streakType) {
          streak++;
        } else {
          break;
        }
      }
    }
    return { type: streakType, count: streak };
  };

  const currentStreak = getCurrentStreak();

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
          {/* Market Time Remaining */}
          {timeRemaining !== undefined && timeRemaining > 0 && (
            <span className={cn(
              "px-1.5 py-0.5 rounded font-mono text-[10px] flex items-center gap-1",
              timeRemaining < 60000
                ? "bg-red-500/20 text-red-400 animate-pulse"
                : timeRemaining < 180000
                  ? "bg-yellow-500/20 text-yellow-400"
                  : "bg-blue-500/20 text-blue-400"
            )}>
              <Timer className="w-3 h-3" />
              {formatDuration(timeRemaining)}
            </span>
          )}
          <span className="px-1.5 py-0.5 bg-success/20 rounded text-success font-mono text-[10px]">
            YES {yesPrice.toFixed(3)}
          </span>
          <span className="px-1.5 py-0.5 bg-danger/20 rounded text-danger font-mono text-[10px]">
            NO {noPrice.toFixed(3)}
          </span>
        </div>
      </div>

      {/* Stats Grid with ProgressRing and Equity Curve */}
      <div className="grid grid-cols-2 gap-3">
        {/* Left Col: Balance, PnL, Trades */}
        <div className="flex flex-col gap-2">
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
          <div className="flex items-center gap-1.5 mt-1">
            <span className="text-[10px] text-muted-foreground">Recent:</span>
            <div className="flex items-center gap-0.5" title="Last 5 trades">
              {recentTrades.map((pnl: number, i: number) => (
                <div
                  key={i}
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: "50%",
                    background: pnl > 0 ? "var(--success)" : pnl < 0 ? "var(--danger)" : "var(--muted-foreground)"
                  }}
                />
              ))}
              {recentTrades.length === 0 && (
                <span className="text-[10px] text-muted-foreground">-</span>
              )}
            </div>
          </div>
        </div>

        {/* Right Col: WinRate Ring, Equity Curve */}
        <div className="flex flex-col items-end justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="text-right">
              <div className="text-[10px] text-muted-foreground">Win Rate</div>
              <div className="font-mono text-sm leading-tight">
                {bot.stats.winRate > 0 ? `${(bot.stats.winRate * 100).toFixed(0)}%` : "-"}
              </div>
              <div className="text-[10px] text-muted-foreground mt-0.5">
                {bot.stats.trades} trades
              </div>
            </div>
            <ProgressRing
              value={bot.stats.winRate * 100}
              size={36}
              strokeWidth={3}
            />
          </div>
          
          <div className="mt-auto w-full flex justify-end">
            <MiniEquityCurve
              data={equityCurvePlot}
              color={strategyColor}
              size={32}
            />
          </div>
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

      {/* Win/Loss Breakdown & Streaks */}
      {bot.stats.trades > 0 && (
        <div className="grid grid-cols-3 gap-2 p-2 bg-black/20 rounded-md text-xs">
          {/* Wins */}
          <div className="flex flex-col items-center">
            <div className="text-[10px] text-muted-foreground mb-0.5">Wins</div>
            <div className="font-mono font-semibold text-success">{bot.stats.wins}</div>
            {bot.stats.avgWin > 0 && (
              <div className="text-[10px] text-success/70">+${bot.stats.avgWin.toFixed(2)} avg</div>
            )}
          </div>
          {/* Losses */}
          <div className="flex flex-col items-center">
            <div className="text-[10px] text-muted-foreground mb-0.5">Losses</div>
            <div className="font-mono font-semibold text-danger">{bot.stats.losses}</div>
            {bot.stats.avgLoss > 0 && (
              <div className="text-[10px] text-danger/70">-${bot.stats.avgLoss.toFixed(2)} avg</div>
            )}
          </div>
          {/* Streak */}
          <div className="flex flex-col items-center">
            <div className="text-[10px] text-muted-foreground mb-0.5">Streak</div>
            <div className="flex items-center gap-0.5">
              {currentStreak.type === "win" ? (
                <>
                  <Flame className="w-3 h-3 text-orange-400" />
                  <span className="font-mono font-semibold text-orange-400">{currentStreak.count}</span>
                </>
              ) : currentStreak.type === "loss" ? (
                <>
                  <Snowflake className="w-3 h-3 text-blue-400" />
                  <span className="font-mono font-semibold text-blue-400">{currentStreak.count}</span>
                </>
              ) : (
                <span className="text-muted-foreground">-</span>
              )}
            </div>
            {bot.stats.maxConsecutiveWins > 1 && (
              <div className="text-[10px] text-muted-foreground">Best: {bot.stats.maxConsecutiveWins}</div>
            )}
          </div>
        </div>
      )}

      {/* Profit Factor */}
      {bot.stats.trades >= 3 && (
        <div className="flex items-center justify-between p-2 bg-black/20 rounded-md text-xs">
          <div className="flex items-center gap-1">
            <BarChart2 className="w-3 h-3 text-muted-foreground" />
            <span className="text-muted-foreground">Profit Factor</span>
          </div>
          <div className={cn(
            "font-mono font-semibold",
            bot.stats.profitFactor >= 1.5 ? "text-success" :
            bot.stats.profitFactor >= 1 ? "text-warning" : "text-danger"
          )}>
            {bot.stats.profitFactor >= 999 ? "∞" : bot.stats.profitFactor.toFixed(2)}
          </div>
        </div>
      )}

      {/* Recent Trades Detail - NEW SECTION */}
      {closedPositions.length > 0 && (
        <div className="p-2 bg-black/20 rounded-md">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Activity className="w-3 h-3" />
              <span>Recent Trades</span>
            </div>
            <span className="text-[10px] text-muted-foreground">
              {closedPositions.length} total
            </span>
          </div>
          <div className="flex flex-col gap-1 max-h-32 overflow-y-auto">
            {closedPositions.slice(-10).reverse().map((trade: any, i: number) => {
              const isWin = (trade.pnl || 0) > 0;
              const outcome = trade.outcome || "YES";
              const entryPrice = trade.entryPrice || trade.avgEntry || trade.stake / trade.amount || 0;
              const stake = trade.stake || 0;

              return (
                <div
                  key={i}
                  className={cn(
                    "flex items-center justify-between p-1.5 rounded text-[10px]",
                    isWin ? "bg-success/10" : "bg-danger/10"
                  )}
                >
                  <div className="flex items-center gap-2">
                    {/* Outcome Badge */}
                    <span className={cn(
                      "px-1 py-0.5 rounded font-mono font-semibold",
                      outcome === "YES" ? "bg-success/20 text-success" : "bg-danger/20 text-danger"
                    )}>
                      {outcome}
                    </span>
                    {/* Entry Price */}
                    <div className="flex items-center gap-1">
                      <span className="text-muted-foreground">@</span>
                      <span className="font-mono">{(entryPrice * 100).toFixed(1)}¢</span>
                    </div>
                    {/* Stake */}
                    <div className="flex items-center gap-0.5">
                      <DollarSign className="w-2 h-2 text-muted-foreground" />
                      <span className="font-mono">{stake.toFixed(2)}</span>
                    </div>
                  </div>
                  {/* PnL */}
                  <div className={cn(
                    "font-mono font-semibold",
                    isWin ? "text-success" : "text-danger"
                  )}>
                    {isWin ? "+" : ""}{(trade.pnl || 0).toFixed(2)}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Trade Performance Summary - NEW SECTION */}
      {bot.stats.trades >= 3 && (
        <div className="grid grid-cols-4 gap-1 p-2 bg-black/20 rounded-md text-[10px]">
          <div className="flex flex-col items-center">
            <div className="text-muted-foreground">Avg Entry</div>
            <div className="font-mono">
              {closedPositions.length > 0
                ? `${(closedPositions.reduce((s: number, p: any) => s + (p.entryPrice || p.avgEntry || p.stake / p.amount || 0), 0) / closedPositions.length * 100).toFixed(1)}¢`
                : "-"}
            </div>
          </div>
          <div className="flex flex-col items-center">
            <div className="text-muted-foreground">Best Win</div>
            <div className="font-mono text-success">
              {closedPositions.length > 0
                ? `+${Math.max(...closedPositions.map((p: any) => p.pnl || 0)).toFixed(2)}`
                : "-"}
            </div>
          </div>
          <div className="flex flex-col items-center">
            <div className="text-muted-foreground">Worst Loss</div>
            <div className="font-mono text-danger">
              {closedPositions.length > 0
                ? `${Math.min(...closedPositions.map((p: any) => p.pnl || 0)).toFixed(2)}`
                : "-"}
            </div>
          </div>
          <div className="flex flex-col items-center">
            <div className="text-muted-foreground">Avg Trade</div>
            <div className={cn(
              "font-mono",
              bot.stats.pnl >= 0 ? "text-success" : "text-danger"
            )}>
              {bot.stats.trades > 0
                ? `${(bot.stats.pnl / bot.stats.trades).toFixed(2)}`
                : "-"}
            </div>
          </div>
        </div>
      )}

      {/* Max Drawdown & Sharpe Ratio */}
      {(bot.portfolio.maxDrawdown !== undefined || bot.portfolio.sharpeRatio !== undefined) && (
        <div className="grid grid-cols-2 gap-2">
          {bot.portfolio.maxDrawdown !== undefined && (
            <div className="flex items-center justify-between p-2 bg-black/20 rounded-md text-xs">
              <span className="text-muted-foreground">Max DD</span>
              <span className={cn(
                "font-mono font-semibold",
                bot.portfolio.maxDrawdown <= -0.1 ? "text-danger" :
                bot.portfolio.maxDrawdown <= -0.05 ? "text-warning" : "text-foreground"
              )}>
                {(bot.portfolio.maxDrawdown * 100).toFixed(1)}%
              </span>
            </div>
          )}
          {bot.portfolio.sharpeRatio !== undefined && bot.stats.trades >= 10 && (
            <div className="flex items-center justify-between p-2 bg-black/20 rounded-md text-xs">
              <span className="text-muted-foreground">Sharpe</span>
              <span className={cn(
                "font-mono font-semibold",
                bot.portfolio.sharpeRatio >= 1 ? "text-success" :
                bot.portfolio.sharpeRatio >= 0 ? "text-warning" : "text-danger"
              )}>
                {bot.portfolio.sharpeRatio.toFixed(2)}
              </span>
            </div>
          )}
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
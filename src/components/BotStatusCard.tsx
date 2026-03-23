import { useState } from "react";
import { Bot, Play, Square, Settings, Clock, TrendingDown, TrendingUp, AlertCircle, XCircle, Timer, Flame, Snowflake, Target, ArrowUpRight, ArrowDownRight } from "lucide-react";
import { getStrategyColor, getStrategyName } from "@/lib/design-tokens";
import { MiniEquityCurve } from "./charts/MiniEquityCurve";
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
  timeRemaining?: number;
}

function formatDuration(ms: number): string {
  if (!ms || ms <= 0) return "0s";
  if (ms < 60000) return `${Math.floor(ms / 1000)}s`;
  if (ms < 3600000) return `${Math.floor(ms / 60000)}m ${Math.floor((ms % 60000) / 1000)}s`;
  return `${Math.floor(ms / 3600000)}h ${Math.floor((ms % 3600000) / 60000)}m`;
}

export function BotStatusCard({ bot, yesPrice, noPrice, positions, onToggle, onOpenConfig, timeRemaining }: BotStatusCardProps) {
  const [showDetails, setShowDetails] = useState(false);
  const [isToggling, setIsToggling] = useState(false);

  const strategyColor = getStrategyColor(bot.strategy);
  const strategyName = getStrategyName(bot.strategy);

  const botPositions = positions.filter(p => p.botId === bot.id);
  const positionsValue = botPositions.reduce((sum, p) => sum + p.stake, 0);
  const unrealizedPnl = botPositions.reduce((sum, pos) => {
    if (pos.outcome === "YES") {
      return sum + (pos.amount * yesPrice - pos.stake);
    }
    return sum + (pos.amount * (1 - yesPrice) - pos.stake);
  }, 0);

  // Calculate running time
  const runningTime = bot.enabled && bot.runTime ? Date.now() - bot.runTime : 0;

  // Extract trades data
  const closedPositions = (bot.portfolio.closedPositions || []) as any[];

  // Recent trades dots
  const recentTrades = closedPositions.slice(-8).map((p: any) => p.pnl || 0);

  // Calculate initial balance and growth
  const totalClosedPnL = closedPositions.reduce((sum: number, p: any) => sum + (p.pnl || 0), 0);
  const initialBalance = bot.portfolio.balance - totalClosedPnL;
  const balanceGrowth = bot.portfolio.balance - initialBalance;
  const growthPercent = initialBalance > 0 ? (balanceGrowth / initialBalance) * 100 : 0;

  // Equity curve
  const equityCurvePlot = [initialBalance];
  let currentBalance = initialBalance;
  closedPositions.forEach((p: any) => {
    currentBalance += (p.pnl || 0);
    equityCurvePlot.push(currentBalance);
  });
  if (equityCurvePlot.length === 1) {
    equityCurvePlot.push(initialBalance);
  }

  // Health status
  const getHealthStatus = () => {
    if (!bot.enabled) return { status: "stopped", color: "#6b7280", icon: XCircle, label: "Stopped" };
    if (bot.stats.trades === 0 && runningTime > 60000) return { status: "idle", color: "#f59e0b", icon: AlertCircle, label: "Idle" };
    if (bot.stats.pnl < 0) return { status: "losing", color: "#ef4444", icon: TrendingDown, label: "Losing" };
    return { status: "winning", color: "#22c55e", icon: TrendingUp, label: "Winning" };
  };

  const health = getHealthStatus();
  const HealthIcon = health.icon;

  // Current streak
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

  // Win rate calculation
  const winRate = bot.stats.trades > 0 ? (bot.stats.wins / bot.stats.trades) * 100 : 0;

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
      className="glass-card rounded-xl transition-all duration-300"
      style={{
        borderLeftColor: strategyColor,
        borderLeftWidth: "4px",
        border: `1px solid ${bot.enabled ? 'rgba(34, 197, 94, 0.3)' : 'var(--border)'}`,
        padding: "1.5rem",
      }}
    >
      {/* Header with Running Time */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "1rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          {/* Bot Icon with Status */}
          <div style={{
            width: 44,
            height: 44,
            borderRadius: 12,
            background: bot.enabled ? `${strategyColor}20` : "var(--glass-bg)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            border: `2px solid ${bot.enabled ? strategyColor : "var(--border)"}`,
            position: "relative",
          }}>
            <Bot style={{ width: 22, height: 22, color: bot.enabled ? strategyColor : "var(--text-muted)" }} />
            {/* Running indicator dot */}
            {bot.enabled && (
              <div style={{
                position: "absolute",
                top: -2,
                right: -2,
                width: 10,
                height: 10,
                borderRadius: "50%",
                background: "#22c55e",
                border: "2px solid var(--bg)",
                animation: "pulse 2s infinite",
              }} />
            )}
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: "1.125rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
              {bot.name}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginTop: "0.25rem" }}>
              {/* Strategy Badge */}
              <span style={{
                padding: "0.15rem 0.5rem",
                borderRadius: 4,
                background: `${strategyColor}15`,
                color: strategyColor,
                fontWeight: 500,
                fontSize: "0.7rem",
              }}>
                {strategyName}
              </span>
              {/* Health Badge */}
              <span style={{
                padding: "0.15rem 0.5rem",
                borderRadius: 4,
                background: `${health.color}20`,
                color: health.color,
                display: "flex",
                alignItems: "center",
                gap: "0.2rem",
                fontWeight: 600,
                fontSize: "0.7rem",
              }}>
                <HealthIcon style={{ width: 10, height: 10 }} />
                {health.label}
              </span>
            </div>
          </div>
        </div>

        {/* Running Time - More Prominent */}
        <div style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-end",
          gap: "0.25rem",
        }}>
          <div style={{
            display: "flex",
            alignItems: "center",
            gap: "0.375rem",
            padding: "0.375rem 0.625rem",
            borderRadius: 8,
            background: bot.enabled ? "rgba(34, 197, 94, 0.15)" : "rgba(107, 114, 128, 0.15)",
          }}>
            <Clock style={{ width: 14, height: 14, color: bot.enabled ? "#22c55e" : "#6b7280" }} />
            <span style={{
              fontFamily: "ui-monospace, monospace",
              fontSize: "0.875rem",
              fontWeight: 600,
              color: bot.enabled ? "#22c55e" : "#6b7280",
            }}>
              {bot.enabled ? formatDuration(runningTime) : "STOPPED"}
            </span>
          </div>
          {/* Market Timer */}
          {timeRemaining !== undefined && timeRemaining > 0 && bot.enabled && (
            <div style={{
              display: "flex",
              alignItems: "center",
              gap: "0.25rem",
              padding: "0.25rem 0.5rem",
              borderRadius: 6,
              background: timeRemaining < 60000 ? "rgba(239, 68, 68, 0.2)" : timeRemaining < 180000 ? "rgba(245, 158, 11, 0.2)" : "rgba(59, 130, 246, 0.2)",
            }}>
              <Timer style={{ width: 12, height: 12, color: timeRemaining < 60000 ? "#ef4444" : timeRemaining < 180000 ? "#f59e0b" : "#3b82f6" }} />
              <span style={{
                fontFamily: "ui-monospace, monospace",
                fontSize: "0.7rem",
                fontWeight: 600,
                color: timeRemaining < 60000 ? "#ef4444" : timeRemaining < 180000 ? "#f59e0b" : "#3b82f6",
              }}>
                {formatDuration(timeRemaining)}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Portfolio Growth Card */}
      <div style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "1rem",
        background: balanceGrowth >= 0 ? "linear-gradient(135deg, rgba(34, 197, 94, 0.15), rgba(34, 197, 94, 0.05))" : "linear-gradient(135deg, rgba(239, 68, 68, 0.15), rgba(239, 68, 68, 0.05))",
        borderRadius: 12,
        marginBottom: "1rem",
        border: `1px solid ${balanceGrowth >= 0 ? "rgba(34, 197, 94, 0.3)" : "rgba(239, 68, 68, 0.3)"}`,
      }}>
        <div>
          <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginBottom: "0.25rem" }}>
            Bot Balance
          </div>
          <div style={{
            fontWeight: 700,
            fontFamily: "ui-monospace, monospace",
            fontSize: "1.5rem",
            color: "var(--text-primary)",
          }}>
            ${bot.portfolio.balance.toFixed(2)}
          </div>
          <div style={{ fontSize: "0.7rem", color: "var(--text-muted)", marginTop: "0.25rem" }}>
            Started: ${initialBalance.toFixed(2)}
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "flex-end",
            gap: "0.25rem",
            color: balanceGrowth >= 0 ? "#22c55e" : "#ef4444",
          }}>
            {balanceGrowth >= 0 ? (
              <ArrowUpRight style={{ width: 20, height: 20 }} />
            ) : (
              <ArrowDownRight style={{ width: 20, height: 20 }} />
            )}
            <span style={{ fontWeight: 700, fontSize: "1.125rem" }}>
              {balanceGrowth >= 0 ? "+" : ""}{balanceGrowth.toFixed(2)}
            </span>
          </div>
          <div style={{
            fontSize: "0.875rem",
            fontWeight: 600,
            color: balanceGrowth >= 0 ? "#22c55e" : "#ef4444",
          }}>
            ({growthPercent >= 0 ? "+" : ""}{growthPercent.toFixed(1)}%)
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(4, 1fr)",
        gap: "0.5rem",
        marginBottom: "1rem",
      }}>
        {/* Win Rate */}
        <div style={{
          padding: "0.625rem",
          background: "rgba(0,0,0,0.2)",
          borderRadius: 8,
          textAlign: "center",
        }}>
          <div style={{ fontSize: "0.625rem", color: "var(--text-muted)", marginBottom: "0.25rem" }}>Win Rate</div>
          <div style={{
            fontWeight: 700,
            fontFamily: "ui-monospace, monospace",
            fontSize: "0.875rem",
            color: winRate >= 50 ? "#22c55e" : winRate > 0 ? "#f59e0b" : "var(--text-muted)",
          }}>
            {winRate.toFixed(0)}%
          </div>
        </div>

        {/* Trades */}
        <div style={{
          padding: "0.625rem",
          background: "rgba(0,0,0,0.2)",
          borderRadius: 8,
          textAlign: "center",
        }}>
          <div style={{ fontSize: "0.625rem", color: "var(--text-muted)", marginBottom: "0.25rem" }}>Trades</div>
          <div style={{ fontWeight: 700, fontFamily: "ui-monospace, monospace", fontSize: "0.875rem" }}>
            {bot.stats.trades}
          </div>
          <div style={{ fontSize: "0.625rem", fontWeight: 500 }}>
            <span style={{ color: "#22c55e" }}>{bot.stats.wins}W</span>
            <span style={{ color: "var(--text-muted)" }}>/</span>
            <span style={{ color: "#ef4444" }}>{bot.stats.losses}L</span>
          </div>
        </div>

        {/* Streak */}
        <div style={{
          padding: "0.625rem",
          background: "rgba(0,0,0,0.2)",
          borderRadius: 8,
          textAlign: "center",
        }}>
          <div style={{ fontSize: "0.625rem", color: "var(--text-muted)", marginBottom: "0.25rem" }}>Streak</div>
          <div style={{
            fontWeight: 700,
            fontFamily: "ui-monospace, monospace",
            fontSize: "0.875rem",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "0.2rem",
            color: currentStreak.type === "win" ? "#f59e0b" : currentStreak.type === "loss" ? "#3b82f6" : "var(--text-muted)",
          }}>
            {currentStreak.type === "win" && <Flame style={{ width: 14, height: 14 }} />}
            {currentStreak.type === "loss" && <Snowflake style={{ width: 14, height: 14 }} />}
            {currentStreak.count > 0 ? currentStreak.count : "-"}
          </div>
        </div>

        {/* Avg Trade */}
        <div style={{
          padding: "0.625rem",
          background: "rgba(0,0,0,0.2)",
          borderRadius: 8,
          textAlign: "center",
        }}>
          <div style={{ fontSize: "0.625rem", color: "var(--text-muted)", marginBottom: "0.25rem" }}>Avg Trade</div>
          <div style={{
            fontWeight: 700,
            fontFamily: "ui-monospace, monospace",
            fontSize: "0.875rem",
            color: bot.stats.trades > 0 ? (bot.stats.pnl / bot.stats.trades >= 0 ? "#22c55e" : "#ef4444") : "var(--text-muted)",
          }}>
            {bot.stats.trades > 0 ? `$${(bot.stats.pnl / bot.stats.trades).toFixed(2)}` : "-"}
          </div>
        </div>
      </div>

      {/* Prices */}
      <div style={{
        display: "flex",
        gap: "0.5rem",
        marginBottom: "1rem",
      }}>
        <div style={{
          flex: 1,
          padding: "0.5rem 0.75rem",
          borderRadius: 8,
          background: "rgba(34, 197, 94, 0.1)",
          border: "1px solid rgba(34, 197, 94, 0.2)",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}>
          <span style={{ color: "#22c55e", fontWeight: 600, fontSize: "0.75rem" }}>YES</span>
          <span style={{ color: "#22c55e", fontFamily: "ui-monospace, monospace", fontWeight: 700, fontSize: "0.875rem" }}>
            {(yesPrice * 100).toFixed(1)}¢
          </span>
        </div>
        <div style={{
          flex: 1,
          padding: "0.5rem 0.75rem",
          borderRadius: 8,
          background: "rgba(239, 68, 68, 0.1)",
          border: "1px solid rgba(239, 68, 68, 0.2)",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}>
          <span style={{ color: "#ef4444", fontWeight: 600, fontSize: "0.75rem" }}>NO</span>
          <span style={{ color: "#ef4444", fontFamily: "ui-monospace, monospace", fontWeight: 700, fontSize: "0.875rem" }}>
            {(noPrice * 100).toFixed(1)}¢
          </span>
        </div>
      </div>

      {/* Open Positions */}
      {botPositions.length > 0 && (
        <div style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0.75rem",
          background: "rgba(59, 130, 246, 0.1)",
          borderRadius: 10,
          border: "1px solid rgba(59, 130, 246, 0.2)",
          marginBottom: "1rem",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <Target style={{ width: 16, height: 16, color: "#3b82f6" }} />
            <span style={{ fontSize: "0.875rem", fontWeight: 600 }}>
              {botPositions.length} Position{botPositions.length > 1 ? "s" : ""}
            </span>
            <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
              ${positionsValue.toFixed(2)} at risk
            </span>
          </div>
          <div style={{
            fontSize: "0.875rem",
            fontFamily: "ui-monospace, monospace",
            fontWeight: 700,
            color: unrealizedPnl >= 0 ? "#22c55e" : "#ef4444",
          }}>
            {unrealizedPnl >= 0 ? "+" : ""}${unrealizedPnl.toFixed(2)} unrealized
          </div>
        </div>
      )}

      {/* Equity Curve & Recent Trades */}
      <div style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        marginBottom: "1rem",
        padding: "0.75rem",
        background: "rgba(0,0,0,0.2)",
        borderRadius: 10,
      }}>
        <div>
          <div style={{ fontSize: "0.625rem", color: "var(--text-muted)", marginBottom: "0.375rem" }}>Last 8 trades</div>
          <div style={{ display: "flex", gap: "0.375rem" }}>
            {recentTrades.length > 0 ? recentTrades.map((pnl: number, i: number) => (
              <div
                key={i}
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: "50%",
                  background: pnl > 0 ? "#22c55e" : pnl < 0 ? "#ef4444" : "var(--text-muted)",
                  boxShadow: pnl > 0 ? "0 0 6px rgba(34, 197, 94, 0.5)" : pnl < 0 ? "0 0 6px rgba(239, 68, 68, 0.5)" : "none",
                }}
                title={pnl > 0 ? `+$${pnl.toFixed(2)}` : `$${pnl.toFixed(2)}`}
              />
            )) : (
              <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>No trades yet</span>
            )}
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: "0.625rem", color: "var(--text-muted)", marginBottom: "0.25rem" }}>Equity curve</div>
          <MiniEquityCurve
            data={equityCurvePlot}
            color={strategyColor}
            size={32}
          />
        </div>
      </div>

      {/* Control Buttons */}
      <div style={{ display: "flex", gap: "0.5rem" }}>
        <button
          onClick={handleToggle}
          disabled={isToggling}
          style={{
            flex: 1,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "0.5rem",
            padding: "0.75rem",
            borderRadius: 10,
            border: "none",
            background: bot.enabled
              ? "linear-gradient(135deg, #ef4444, #dc2626)"
              : "linear-gradient(135deg, #22c55e, #16a34a)",
            color: "white",
            fontWeight: 700,
            fontSize: "0.875rem",
            cursor: isToggling ? "not-allowed" : "pointer",
            opacity: isToggling ? 0.7 : 1,
            boxShadow: bot.enabled
              ? "0 4px 12px rgba(239, 68, 68, 0.3)"
              : "0 4px 12px rgba(34, 197, 94, 0.3)",
          }}
        >
          {bot.enabled ? (
            <>
              <Square style={{ width: 16, height: 16 }} />
              STOP BOT
            </>
          ) : (
            <>
              <Play style={{ width: 16, height: 16 }} />
              START BOT
            </>
          )}
        </button>
        <button
          onClick={() => onOpenConfig(bot)}
          style={{
            padding: "0.75rem",
            borderRadius: 10,
            border: "1px solid var(--border)",
            background: "var(--glass-bg)",
            color: "var(--text-muted)",
            cursor: "pointer",
          }}
          title="Configure"
        >
          <Settings style={{ width: 18, height: 18 }} />
        </button>
        <button
          onClick={() => setShowDetails(!showDetails)}
          style={{
            padding: "0.75rem 1rem",
            borderRadius: 10,
            border: "1px solid var(--border)",
            background: showDetails ? "var(--glass-bg)" : "transparent",
            color: "var(--text-muted)",
            fontSize: "0.875rem",
            fontWeight: 500,
            cursor: "pointer",
          }}
        >
          {showDetails ? "Less" : "More"}
        </button>
      </div>

      {/* Details Panel */}
      {showDetails && (
        <div style={{
          marginTop: "1rem",
          padding: "1rem",
          background: "rgba(0,0,0,0.3)",
          borderRadius: 10,
          border: "1px solid var(--border)",
        }}>
          {/* Bot Config */}
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(2, 1fr)",
            gap: "0.5rem",
            fontSize: "0.75rem",
            marginBottom: "0.75rem",
          }}>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ color: "var(--text-muted)" }}>Interval:</span>
              <span style={{ fontFamily: "ui-monospace, monospace", fontWeight: 500 }}>{bot.interval}s</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ color: "var(--text-muted)" }}>Bet Size:</span>
              <span style={{ fontFamily: "ui-monospace, monospace", fontWeight: 500 }}>${bot.betSize.toFixed(2)}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ color: "var(--text-muted)" }}>Avg Win:</span>
              <span style={{ fontFamily: "ui-monospace, monospace", color: "#22c55e", fontWeight: 500 }}>
                {bot.stats.avgWin > 0 ? `+$${bot.stats.avgWin.toFixed(2)}` : "-"}
              </span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ color: "var(--text-muted)" }}>Avg Loss:</span>
              <span style={{ fontFamily: "ui-monospace, monospace", color: "#ef4444", fontWeight: 500 }}>
                {bot.stats.avgLoss > 0 ? `-$${bot.stats.avgLoss.toFixed(2)}` : "-"}
              </span>
            </div>
            {bot.stats.trades >= 3 && (
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "var(--text-muted)" }}>Profit Factor:</span>
                <span style={{
                  fontFamily: "ui-monospace, monospace",
                  fontWeight: 500,
                  color: bot.stats.profitFactor >= 1.5 ? "#22c55e" : bot.stats.profitFactor >= 1 ? "#f59e0b" : "#ef4444",
                }}>
                  {bot.stats.profitFactor >= 999 ? "∞" : bot.stats.profitFactor.toFixed(2)}
                </span>
              </div>
            )}
            {bot.portfolio.maxDrawdown !== undefined && (
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "var(--text-muted)" }}>Max DD:</span>
                <span style={{
                  fontFamily: "ui-monospace, monospace",
                  fontWeight: 500,
                  color: bot.portfolio.maxDrawdown <= -0.1 ? "#ef4444" : bot.portfolio.maxDrawdown <= -0.05 ? "#f59e0b" : "var(--text-primary)",
                }}>
                  {(bot.portfolio.maxDrawdown * 100).toFixed(1)}%
                </span>
              </div>
            )}
          </div>

          {/* Recent Trades List */}
          {closedPositions.length > 0 && (
            <div>
              <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginBottom: "0.5rem", fontWeight: 500 }}>
                Recent Trades ({closedPositions.length} total)
              </div>
              <div style={{
                maxHeight: 120,
                overflowY: "auto",
                display: "flex",
                flexDirection: "column",
                gap: "0.25rem",
              }}>
                {closedPositions.slice(-6).reverse().map((trade: any, i: number) => {
                  const isWin = (trade.pnl || 0) > 0;
                  return (
                    <div
                      key={i}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        padding: "0.375rem 0.5rem",
                        borderRadius: 6,
                        background: isWin ? "rgba(34, 197, 94, 0.1)" : "rgba(239, 68, 68, 0.1)",
                        fontSize: "0.75rem",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                        <span style={{
                          padding: "0.125rem 0.375rem",
                          borderRadius: 4,
                          background: trade.outcome === "YES" ? "rgba(34, 197, 94, 0.2)" : "rgba(239, 68, 68, 0.2)",
                          color: trade.outcome === "YES" ? "#22c55e" : "#ef4444",
                          fontWeight: 600,
                          fontSize: "0.625rem",
                        }}>
                          {trade.outcome}
                        </span>
                        <span style={{ color: "var(--text-muted)", fontSize: "0.625rem" }}>
                          @ {((trade.odds || 0) * 100).toFixed(1)}¢
                        </span>
                      </div>
                      <span style={{ fontWeight: 600, color: isWin ? "#22c55e" : "#ef4444" }}>
                        {isWin ? "+" : ""}${(trade.pnl || 0).toFixed(2)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
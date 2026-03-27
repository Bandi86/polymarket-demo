'use client'

import { useState } from "react";
import { Play, Square, Settings, Timer, TrendingDown, TrendingUp, Target } from "lucide-react";
import { MiniEquityCurve } from "@/components/charts/MiniEquityCurve";
import { formatDuration } from "@/lib/utils";
import { useBotStatusState, BotCardHeader, BotBalanceCard, BotStatsGrid } from "./bot-card";
import type { BotData } from "@/hooks/useTradingData";

interface BotStatusCardProps {
  bot: BotData;
  yesPrice: number;
  positions: Array<{
    id: string;
    botId?: string;
    outcome: "YES" | "NO";
    amount: number;
    stake: number;
    odds: number;
    fee?: number;
  }>;
  onToggle: (botId: string) => Promise<void>;
  onOpenConfig: (bot: BotData) => void;
  timeRemaining?: number;
}

export function BotStatusCard({ bot, yesPrice, positions, onToggle, onOpenConfig, timeRemaining }: BotStatusCardProps) {
  const [showDetails, setShowDetails] = useState(false);
  const [isToggling, setIsToggling] = useState(false);

  // Use custom hook for state management
  const state = useBotStatusState({ bot, yesPrice, positions });

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
        borderLeftColor: state.strategyColor,
        borderLeftWidth: "4px",
        border: `1px solid ${bot.enabled ? 'rgba(34, 197, 94, 0.3)' : 'var(--border)'}`,
        padding: "1.5rem",
      }}
    >
      {/* Header */}
      <BotCardHeader
        bot={bot}
        strategyColor={state.strategyColor}
        health={state.health}
        HealthIcon={state.HealthIcon}
        runningTime={state.runningTime}
        timeRemaining={timeRemaining}
      />

      {/* Balance Card */}
      <BotBalanceCard
        balance={bot.portfolio.balance}
        initialBalance={state.initialBalance}
        balanceGrowth={state.balanceGrowth}
        growthPercent={state.growthPercent}
      />

      {/* Stats Grid */}
      <BotStatsGrid
        winRate={state.winRate}
        trades={bot.stats.trades}
        wins={bot.stats.wins}
        losses={bot.stats.losses}
        currentStreak={state.currentStreak}
        avgTrade={bot.stats.pnl / Math.max(1, bot.stats.trades)}
        pnl={bot.stats.pnl}
      />

      {/* Open Positions */}
      {state.botPositions.length > 0 && (
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
              {state.botPositions.length} Position{state.botPositions.length > 1 ? "s" : ""}
            </span>
            <span style={{
              padding: "0.125rem 0.375rem",
              borderRadius: 4,
              background: state.botPositions[0].outcome === "YES" ? "rgba(34, 197, 94, 0.2)" : "rgba(239, 68, 68, 0.2)",
              color: state.botPositions[0].outcome === "YES" ? "#22c55e" : "#ef4444",
              fontSize: "0.625rem",
              fontWeight: 700,
            }}>
              {state.botPositions[0].outcome}
            </span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
            <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
              ${state.positionsValue.toFixed(2)} at risk
            </span>
            <div style={{
              fontSize: "0.875rem",
              fontFamily: "ui-monospace, monospace",
              fontWeight: 700,
              color: state.unrealizedPnl >= 0 ? "#22c55e" : "#ef4444",
            }}>
              {state.unrealizedPnl >= 0 ? "+" : ""}${state.unrealizedPnl.toFixed(2)}
            </div>
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
            {state.recentTrades.length > 0 ? state.recentTrades.map((pnl: number, i: number) => (
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
          <MiniEquityCurve data={state.equityCurvePlot} color={state.strategyColor} size={32} />
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
          {state.closedPositions.length > 0 && (
            <div>
              <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginBottom: "0.5rem", fontWeight: 500 }}>
                Recent Trades ({state.closedPositions.length} total)
              </div>
              <div style={{
                maxHeight: 120,
                overflowY: "auto",
                display: "flex",
                flexDirection: "column",
                gap: "0.25rem",
              }}>
                {state.closedPositions.slice(-6).reverse().map((trade: any, i: number) => {
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
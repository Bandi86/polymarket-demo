import { useState } from "react";
import { Bot, Play, Square, Settings, ChevronDown, ChevronUp, Clock, TrendingUp, TrendingDown, AlertCircle, CheckCircle, XCircle } from "lucide-react";
import { formatCurrency } from "../lib/utils";
import type { BotData } from "../hooks/useTradingData";

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
    if (!bot.enabled) return { status: "stopped", color: "#6b7280", icon: XCircle };
    if (bot.stats.trades === 0 && runningTime > 60000) return { status: "idle", color: "#f59e0b", icon: AlertCircle };
    if (bot.stats.pnl < 0) return { status: "losing", color: "#ef4444", icon: TrendingDown };
    return { status: "active", color: "#22c55e", icon: CheckCircle };
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
      className="glass-card"
      style={{
        padding: "1rem",
        display: "flex",
        flexDirection: "column",
        gap: "0.75rem",
        border: bot.enabled ? "1px solid rgba(34, 197, 94, 0.3)" : "1px solid var(--border)",
        transition: "border-color 0.3s"
      }}
    >
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <div
            style={{
              width: 8,
              height: 8,
              borderRadius: "50%",
              background: health.color,
              animation: bot.enabled ? "pulse 2s infinite" : undefined
            }}
          />
          <Bot className="w-4 h-4" style={{ color: bot.enabled ? "#22c55e" : "var(--text-muted)" }} />
          <span style={{ fontWeight: 600, fontSize: "0.875rem" }}>{bot.name}</span>
          <HealthIcon className="w-3 h-3" style={{ color: health.color }} />
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "0.25rem" }}>
          <span
            style={{
              fontSize: "0.625rem",
              padding: "0.125rem 0.375rem",
              borderRadius: 4,
              background: bot.enabled ? "rgba(34, 197, 94, 0.2)" : "rgba(107, 114, 128, 0.2)",
              color: bot.enabled ? "#22c55e" : "#6b7280"
            }}
          >
            {bot.strategy}
          </span>
          <button
            onClick={() => onOpenConfig(bot)}
            style={{
              padding: "0.25rem",
              background: "transparent",
              border: "none",
              cursor: "pointer",
              color: "var(--text-muted)"
            }}
            title="Configure bot"
          >
            <Settings className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Timer & Market Info */}
      <div style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "0.5rem",
        background: "rgba(0,0,0,0.2)",
        borderRadius: 6,
        fontSize: "0.75rem"
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.25rem" }}>
          <Clock className="w-3 h-3" style={{ color: "var(--text-muted)" }} />
          <span style={{ fontFamily: "ui-monospace, monospace", color: bot.enabled ? "var(--text-primary)" : "var(--text-muted)" }}>
            {bot.enabled ? formatDuration(runningTime) : "Stopped"}
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <span style={{
            padding: "0.125rem 0.375rem",
            background: "rgba(34, 197, 94, 0.2)",
            borderRadius: 4,
            color: "#22c55e",
            fontFamily: "ui-monospace, monospace",
            fontSize: "0.625rem"
          }}>
            YES {yesPrice.toFixed(3)}
          </span>
          <span style={{
            padding: "0.125rem 0.375rem",
            background: "rgba(239, 68, 68, 0.2)",
            borderRadius: 4,
            color: "#ef4444",
            fontFamily: "ui-monospace, monospace",
            fontSize: "0.625rem"
          }}>
            NO {noPrice.toFixed(3)}
          </span>
        </div>
      </div>

      {/* Stats Grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "0.5rem" }}>
        <div>
          <div style={{ fontSize: "0.625rem", color: "var(--text-muted)" }}>Balance</div>
          <div style={{ fontFamily: "ui-monospace, monospace", fontWeight: 600 }}>
            {formatCurrency(bot.portfolio.balance)}
          </div>
        </div>
        <div>
          <div style={{ fontSize: "0.625rem", color: "var(--text-muted)" }}>P&L</div>
          <div
            style={{
              fontFamily: "ui-monospace, monospace",
              fontWeight: 600,
              color: bot.stats.pnl >= 0 ? "#22c55e" : "#ef4444"
            }}
          >
            {bot.stats.pnl >= 0 ? "+" : ""}{formatCurrency(bot.stats.pnl)}
            <span style={{ fontSize: "0.625rem", marginLeft: 4 }}>
              ({pnlPercent >= 0 ? "+" : ""}{pnlPercent.toFixed(1)}%)
            </span>
          </div>
        </div>
        <div>
          <div style={{ fontSize: "0.625rem", color: "var(--text-muted)" }}>Trades</div>
          <div style={{ fontFamily: "ui-monospace, monospace" }}>{bot.stats.trades}</div>
        </div>
        <div>
          <div style={{ fontSize: "0.625rem", color: "var(--text-muted)" }}>Win Rate</div>
          <div style={{ fontFamily: "ui-monospace, monospace" }}>
            {bot.stats.winRate > 0 ? `${(bot.stats.winRate * 100).toFixed(0)}%` : "-"}
          </div>
        </div>
      </div>

      {/* Positions & Unrealized PnL */}
      {botPositions.length > 0 && (
        <div style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0.5rem",
          background: "rgba(0,0,0,0.2)",
          borderRadius: 6,
          fontSize: "0.75rem"
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.25rem" }}>
            <TrendingUp className="w-3 h-3" style={{ color: "#3b82f6" }} />
            <span>{botPositions.length} position{botPositions.length > 1 ? "s" : ""}</span>
          </div>
          <div style={{
            fontFamily: "ui-monospace, monospace",
            color: unrealizedPnl >= 0 ? "#22c55e" : "#ef4444"
          }}>
            {unrealizedPnl >= 0 ? "+" : ""}{formatCurrency(unrealizedPnl)} unrealized
          </div>
        </div>
      )}

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
            padding: "0.5rem",
            borderRadius: 8,
            border: "none",
            fontSize: "0.75rem",
            fontWeight: 600,
            cursor: isToggling ? "not-allowed" : "pointer",
            background: bot.enabled
              ? "linear-gradient(135deg, #ef4444, #dc2626)"
              : "linear-gradient(135deg, #22c55e, #16a34a)",
            color: "white",
            opacity: isToggling ? 0.7 : 1,
            transition: "all 0.2s"
          }}
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
          style={{
            padding: "0.5rem 0.75rem",
            borderRadius: 8,
            border: "1px solid var(--border)",
            background: showDebug ? "var(--glass-bg)" : "transparent",
            color: "var(--text-secondary)",
            fontSize: "0.75rem",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: "0.25rem"
          }}
        >
          Debug
          {showDebug ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
        </button>
      </div>

      {/* Debug Panel */}
      {showDebug && (
        <div style={{
          padding: "0.75rem",
          background: "rgba(0,0,0,0.3)",
          borderRadius: 8,
          fontSize: "0.75rem",
          display: "flex",
          flexDirection: "column",
          gap: "0.5rem"
        }}>
          <div style={{ fontWeight: 600, color: "var(--text-secondary)", marginBottom: "0.25rem" }}>
            Debug Info
          </div>

          {/* Bot State */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.25rem" }}>
            <div style={{ color: "var(--text-muted)" }}>Status:</div>
            <div style={{ color: bot.enabled ? "#22c55e" : "#ef4444" }}>
              {bot.enabled ? "Running" : "Stopped"}
            </div>

            <div style={{ color: "var(--text-muted)" }}>Interval:</div>
            <div style={{ fontFamily: "ui-monospace, monospace" }}>{bot.interval}s</div>

            <div style={{ color: "var(--text-muted)" }}>Bet Size:</div>
            <div style={{ fontFamily: "ui-monospace, monospace" }}>${bot.betSize.toFixed(2)}</div>

            <div style={{ color: "var(--text-muted)" }}>Session:</div>
            <div style={{ fontFamily: "ui-monospace, monospace" }}>
              {bot.enabled ? formatDuration(runningTime) : "N/A"}
            </div>
          </div>

          {/* Trading Activity Status */}
          <div style={{
            marginTop: "0.5rem",
            padding: "0.5rem",
            background: "rgba(0,0,0,0.2)",
            borderRadius: 6
          }}>
            <div style={{ color: "var(--text-muted)", marginBottom: "0.25rem" }}>Trading Activity</div>
            {bot.stats.trades === 0 && runningTime > 30000 ? (
              <div style={{ color: "#f59e0b" }}>
                <AlertCircle className="w-3 h-3" style={{ display: "inline", marginRight: "0.25rem" }} />
                No trades yet - {bot.strategy} strategy may be waiting for favorable conditions
              </div>
            ) : bot.stats.trades === 0 ? (
              <div style={{ color: "var(--text-muted)" }}>Waiting for first trade opportunity...</div>
            ) : (
              <div style={{ color: "#22c55e" }}>
                <CheckCircle className="w-3 h-3" style={{ display: "inline", marginRight: "0.25rem" }} />
                Active trading - {bot.stats.trades} trade{bot.stats.trades > 1 ? "s" : ""} executed
              </div>
            )}
          </div>

          {/* Strategy Tips */}
          {bot.stats.trades === 0 && runningTime > 60000 && (
            <div style={{
              marginTop: "0.25rem",
              padding: "0.5rem",
              background: "rgba(59, 130, 246, 0.1)",
              borderRadius: 6,
              border: "1px solid rgba(59, 130, 246, 0.2)"
            }}>
              <div style={{ color: "#3b82f6", fontWeight: 500, marginBottom: "0.25rem" }}>Suggestions</div>
              <ul style={{ margin: 0, paddingLeft: "1rem", color: "var(--text-secondary)" }}>
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
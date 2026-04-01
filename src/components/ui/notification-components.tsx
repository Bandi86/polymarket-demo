'use client'

import { TrendingUp, TrendingDown, Trophy, XCircle, Clock, DollarSign } from "lucide-react";

// Trade Notification - Shows when a bot places a trade
export function TradeNotification({
  botName,
  outcome,
  amount,
  price,
  balance,
  strategy,
}: {
  botName: string;
  outcome: "YES" | "NO";
  amount: number;
  price: number;
  balance?: number;
  strategy?: string;
}) {
  const isYes = outcome === "YES";

  return (
    <div style={{
      display: "flex",
      alignItems: "flex-start",
      gap: "0.75rem",
      padding: "0.25rem 0",
    }}>
      <div style={{
        width: 36,
        height: 36,
        borderRadius: 10,
        background: isYes ? "rgba(34, 197, 94, 0.15)" : "rgba(239, 68, 68, 0.15)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
      }}>
        {isYes ? (
          <TrendingUp style={{ width: 18, height: 18, color: "#22c55e" }} />
        ) : (
          <TrendingDown style={{ width: 18, height: 18, color: "#ef4444" }} />
        )}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.25rem" }}>
          <span style={{ fontWeight: 700, fontSize: "0.875rem", color: "var(--text-primary)" }}>
            {botName}
          </span>
          {strategy && (
            <span style={{
              fontSize: "0.65rem",
              color: "var(--text-muted)",
              background: "rgba(255,255,255,0.05)",
              padding: "0.125rem 0.375rem",
              borderRadius: 4,
            }}>
              {strategy}
            </span>
          )}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <span style={{
            fontWeight: 600,
            fontSize: "0.8rem",
            color: isYes ? "#22c55e" : "#ef4444",
          }}>
            {isYes ? "📈 UP" : "📉 DOWN"}
          </span>
          <span style={{ fontSize: "0.8rem", color: "var(--text-secondary)" }}>
            ${amount.toFixed(2)} @ {(price * 100).toFixed(1)}¢
          </span>
        </div>
        {balance !== undefined && (
          <div style={{ fontSize: "0.7rem", color: "var(--text-muted)", marginTop: "0.25rem" }}>
            Balance: ${balance.toFixed(2)}
          </div>
        )}
      </div>
    </div>
  );
}

// Settlement Notification - Shows when a position is settled
export function SettlementNotification({
  botName,
  won,
  pnl,
  outcome,
  trades,
  winRate,
  strategy,
}: {
  botName: string;
  won: boolean;
  pnl: number;
  outcome: string;
  trades?: number;
  winRate?: number;
  strategy?: string;
}) {
  return (
    <div style={{
      display: "flex",
      alignItems: "flex-start",
      gap: "0.75rem",
      padding: "0.25rem 0",
    }}>
      <div style={{
        width: 36,
        height: 36,
        borderRadius: 10,
        background: won ? "rgba(34, 197, 94, 0.2)" : "rgba(239, 68, 68, 0.2)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
      }}>
        {won ? (
          <Trophy style={{ width: 18, height: 18, color: "#22c55e" }} />
        ) : (
          <XCircle style={{ width: 18, height: 18, color: "#ef4444" }} />
        )}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.25rem" }}>
          <span style={{ fontWeight: 700, fontSize: "0.875rem", color: "var(--text-primary)" }}>
            {botName}
          </span>
          <span style={{
            fontWeight: 800,
            fontSize: "1rem",
            color: won ? "#22c55e" : "#ef4444",
            fontFamily: "ui-monospace, monospace",
          }}>
            {won ? "+" : ""}{pnl.toFixed(2)}
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
          <span style={{
            fontSize: "0.75rem",
            fontWeight: 600,
            padding: "0.125rem 0.5rem",
            borderRadius: 4,
            background: won ? "rgba(34, 197, 94, 0.15)" : "rgba(239, 68, 68, 0.15)",
            color: won ? "#22c55e" : "#ef4444",
          }}>
            {won ? "✓ WON" : "✗ LOST"}
          </span>
          <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
            {outcome}
          </span>
          {trades !== undefined && winRate !== undefined && (
            <span style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>
              ({trades}T · {(winRate * 100).toFixed(0)}%)
            </span>
          )}
        </div>
        {strategy && (
          <div style={{ fontSize: "0.65rem", color: "var(--text-muted)", marginTop: "0.25rem" }}>
            {strategy}
          </div>
        )}
      </div>
    </div>
  );
}

// Session Complete Notification - Shows when run time ends
export function SessionCompleteNotification({
  totalPnl,
  totalTrades,
  totalWins,
  totalLosses,
  winRate,
  duration,
  bestBot,
  worstBot,
}: {
  totalPnl: number;
  totalTrades: number;
  totalWins: number;
  totalLosses: number;
  winRate: number;
  duration: number;
  bestBot?: { name: string; pnl: number };
  worstBot?: { name: string; pnl: number };
}) {
  const isProfit = totalPnl >= 0;
  const durationMinutes = Math.floor(duration / 60000);

  return (
    <div style={{
      background: isProfit
        ? "linear-gradient(135deg, rgba(34, 197, 94, 0.1), rgba(34, 197, 94, 0.05))"
        : "linear-gradient(135deg, rgba(239, 68, 68, 0.1), rgba(239, 68, 68, 0.05))",
      border: `1px solid ${isProfit ? "rgba(34, 197, 94, 0.3)" : "rgba(239, 68, 68, 0.3)"}`,
      borderRadius: 12,
      padding: "1rem",
      minWidth: "320px",
      maxWidth: "380px",
    }}>
      {/* Header */}
      <div style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        marginBottom: "0.75rem",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          {isProfit ? (
            <Trophy style={{ width: 20, height: 20, color: "#22c55e" }} />
          ) : (
            <XCircle style={{ width: 20, height: 20, color: "#ef4444" }} />
          )}
          <span style={{ fontWeight: 700, fontSize: "0.9rem" }}>
            {isProfit ? "Session Profit!" : "Session Ended"}
          </span>
        </div>
        <div style={{
          display: "flex",
          alignItems: "center",
          gap: "0.25rem",
          fontSize: "0.7rem",
          color: "var(--text-muted)",
        }}>
          <Clock style={{ width: 12, height: 12 }} />
          {durationMinutes}m
        </div>
      </div>

      {/* P&L Display */}
      <div style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: "0.5rem",
        padding: "0.75rem",
        borderRadius: 8,
        background: isProfit ? "rgba(34, 197, 94, 0.1)" : "rgba(239, 68, 68, 0.1)",
        marginBottom: "0.75rem",
      }}>
        <DollarSign style={{ width: 20, height: 20, color: isProfit ? "#22c55e" : "#ef4444" }} />
        <span style={{
          fontSize: "1.5rem",
          fontWeight: 800,
          fontFamily: "ui-monospace, monospace",
          color: isProfit ? "#22c55e" : "#ef4444",
        }}>
          {isProfit ? "+" : ""}{totalPnl.toFixed(2)}
        </span>
      </div>

      {/* Stats Row */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(4, 1fr)",
        gap: "0.5rem",
        marginBottom: "0.75rem",
      }}>
        <StatBox label="Trades" value={totalTrades} />
        <StatBox label="Win Rate" value={`${(winRate * 100).toFixed(0)}%`} color={winRate >= 0.5 ? "#22c55e" : "#ef4444"} />
        <StatBox label="Wins" value={totalWins} color="#22c55e" />
        <StatBox label="Losses" value={totalLosses} color="#ef4444" />
      </div>

      {/* Win/Loss Bar */}
      <div style={{ marginBottom: "0.75rem" }}>
        <div style={{
          height: 8,
          borderRadius: 4,
          background: "rgba(239, 68, 68, 0.3)",
          overflow: "hidden",
        }}>
          <div style={{
            height: "100%",
            width: `${winRate * 100}%`,
            background: "linear-gradient(90deg, #22c55e, #4ade80)",
            borderRadius: 4,
          }} />
        </div>
        <div style={{
          display: "flex",
          justifyContent: "space-between",
          marginTop: "0.25rem",
          fontSize: "0.65rem",
          color: "var(--text-muted)",
        }}>
          <span>W: {totalWins}</span>
          <span>L: {totalLosses}</span>
        </div>
      </div>

      {/* Best/Worst Bot */}
      {(bestBot || worstBot) && (
        <div style={{
          display: "flex",
          gap: "0.5rem",
          paddingTop: "0.5rem",
          borderTop: "1px solid rgba(255,255,255,0.05)",
        }}>
          {bestBot && (
            <div style={{
              flex: 1,
              padding: "0.5rem",
              borderRadius: 6,
              background: "rgba(34, 197, 94, 0.08)",
            }}>
              <div style={{ fontSize: "0.6rem", color: "var(--text-muted)", textTransform: "uppercase" }}>
                Best
              </div>
              <div style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--text-primary)" }}>
                {bestBot.name}
              </div>
              <div style={{ fontSize: "0.75rem", fontWeight: 700, color: "#22c55e" }}>
                +${bestBot.pnl.toFixed(2)}
              </div>
            </div>
          )}
          {worstBot && worstBot.pnl < 0 && (
            <div style={{
              flex: 1,
              padding: "0.5rem",
              borderRadius: 6,
              background: "rgba(239, 68, 68, 0.08)",
            }}>
              <div style={{ fontSize: "0.6rem", color: "var(--text-muted)", textTransform: "uppercase" }}>
                Worst
              </div>
              <div style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--text-primary)" }}>
                {worstBot.name}
              </div>
              <div style={{ fontSize: "0.75rem", fontWeight: 700, color: "#ef4444" }}>
                ${worstBot.pnl.toFixed(2)}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function StatBox({ label, value, color = "var(--text-primary)" }: { label: string; value: string | number; color?: string }) {
  return (
    <div style={{ textAlign: "center" }}>
      <div style={{ fontSize: "0.6rem", color: "var(--text-muted)", textTransform: "uppercase" }}>
        {label}
      </div>
      <div style={{ fontSize: "0.875rem", fontWeight: 700, fontFamily: "ui-monospace, monospace", color }}>
        {value}
      </div>
    </div>
  );
}
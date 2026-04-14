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
                +${(bestBot.pnl ?? 0).toFixed(2)}
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
                ${(worstBot.pnl ?? 0).toFixed(2)}
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

// Market Period Summary - Shows when a 5-minute market ends
export function MarketPeriodSummary({
  periodPnl,
  periodTrades,
  periodWins,
  periodLosses,
  periodDuration,
  topBot,
  bottomBot,
}: {
  periodPnl: number;
  periodTrades: number;
  periodWins: number;
  periodLosses: number;
  periodDuration: number;
  topBot?: { name: string; pnl: number };
  bottomBot?: { name: string; pnl: number };
}) {
  const isProfit = periodPnl >= 0;
  const periodMinutes = Math.floor(periodDuration / 60000);
  const periodSeconds = Math.floor((periodDuration % 60000) / 1000);

  return (
    <div style={{
      background: isProfit
        ? "linear-gradient(135deg, rgba(59, 130, 246, 0.1), rgba(59, 130, 246, 0.05))"
        : "linear-gradient(135deg, rgba(245, 158, 11, 0.1), rgba(245, 158, 11, 0.05))",
      border: `1px solid ${isProfit ? "rgba(59, 130, 246, 0.3)" : "rgba(245, 158, 11, 0.3)"}`,
      borderRadius: 12,
      padding: "1rem",
      minWidth: "300px",
      maxWidth: "360px",
    }}>
      {/* Header */}
      <div style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        marginBottom: "0.75rem",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <Clock style={{ width: 16, height: 16, color: isProfit ? "#3b82f6" : "#f59e0b" }} />
          <span style={{ fontWeight: 600, fontSize: "0.8rem" }}>
            Market Period Summary
          </span>
        </div>
        <div style={{
          fontSize: "0.65rem",
          color: "var(--text-muted)",
        }}>
          {periodMinutes}:{periodSeconds.toString().padStart(2, '0')}
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
        background: isProfit ? "rgba(59, 130, 246, 0.1)" : "rgba(245, 158, 11, 0.1)",
        marginBottom: "0.75rem",
      }}>
        <DollarSign style={{ width: 18, height: 18, color: isProfit ? "#3b82f6" : "#f59e0b" }} />
        <span style={{
          fontSize: "1.25rem",
          fontWeight: 800,
          fontFamily: "ui-monospace, monospace",
          color: isProfit ? "#3b82f6" : "#f59e0b",
        }}>
          {isProfit ? "+" : ""}{periodPnl.toFixed(2)}
        </span>
      </div>

      {/* Stats Row */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(4, 1fr)",
        gap: "0.5rem",
        marginBottom: "0.5rem",
      }}>
        <StatBox label="Trades" value={periodTrades} />
        <StatBox label="Wins" value={periodWins} color="#22c55e" />
        <StatBox label="Losses" value={periodLosses} color="#ef4444" />
        <StatBox label="Win%" value={periodTrades > 0 ? `${Math.round((periodWins / periodTrades) * 100)}%` : '0%'} color={periodWins >= periodLosses ? "#22c55e" : "#ef4444"} />
      </div>

      {/* Top/Bottom Bots */}
      {(topBot || bottomBot) && (
        <div style={{
          display: "flex",
          gap: "0.5rem",
          paddingTop: "0.5rem",
          borderTop: "1px solid rgba(255,255,255,0.05)",
        }}>
          {topBot && (
            <div style={{
              flex: 1,
              padding: "0.4rem",
              borderRadius: 6,
              background: "rgba(34, 197, 94, 0.08)",
            }}>
              <div style={{ fontSize: "0.55rem", color: "var(--text-muted)", textTransform: "uppercase" }}>
                Top Performer
              </div>
              <div style={{ fontSize: "0.7rem", fontWeight: 600, color: "var(--text-primary)" }}>
                {topBot.name}
              </div>
              <div style={{ fontSize: "0.7rem", fontWeight: 700, color: "#22c55e" }}>
                +${(topBot.pnl ?? 0).toFixed(2)}
              </div>
            </div>
          )}
          {bottomBot && bottomBot.pnl < 0 && (
            <div style={{
              flex: 1,
              padding: "0.4rem",
              borderRadius: 6,
              background: "rgba(239, 68, 68, 0.08)",
            }}>
              <div style={{ fontSize: "0.55rem", color: "var(--text-muted)", textTransform: "uppercase" }}>
                Needs Work
              </div>
              <div style={{ fontSize: "0.7rem", fontWeight: 600, color: "var(--text-primary)" }}>
                {bottomBot.name}
              </div>
              <div style={{ fontSize: "0.7rem", fontWeight: 700, color: "#ef4444" }}>
                ${(bottomBot.pnl ?? 0).toFixed(2)}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Hourly Summary - Shows portfolio progress every hour
export function HourlySummary({
  hourPnl,
  hourTrades,
  hourWins,
  hourLosses,
  totalPortfolio,
  startPortfolio,
  bestBot,
  hourlyGrowth,
}: {
  hourPnl: number;
  hourTrades: number;
  hourWins: number;
  hourLosses: number;
  totalPortfolio: number;
  startPortfolio: number;
  bestBot?: { name: string; pnl: number };
  hourlyGrowth?: number;
}) {
  const isProfit = hourPnl >= 0;
  const growthPercent = startPortfolio > 0 ? ((totalPortfolio - startPortfolio) / startPortfolio) * 100 : 0;

  return (
    <div style={{
      background: isProfit
        ? "linear-gradient(135deg, rgba(168, 85, 247, 0.1), rgba(168, 85, 247, 0.05))"
        : "linear-gradient(135deg, rgba(107, 114, 128, 0.1), rgba(107, 114, 128, 0.05))",
      border: `1px solid ${isProfit ? "rgba(168, 85, 247, 0.3)" : "rgba(107, 114, 128, 0.3)"}`,
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
          <Clock style={{ width: 16, height: 16, color: isProfit ? "#a855f7" : "#6b7280" }} />
          <span style={{ fontWeight: 600, fontSize: "0.8rem" }}>
            Hourly Report
          </span>
        </div>
        <div style={{
          fontSize: "0.65rem",
          color: "var(--text-muted)",
        }}>
          Last 60 minutes
        </div>
      </div>

      {/* Portfolio Value */}
      <div style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: "0.5rem",
        padding: "0.75rem",
        borderRadius: 8,
        background: "rgba(168, 85, 247, 0.1)",
        marginBottom: "0.5rem",
      }}>
        <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>Portfolio:</span>
        <span style={{
          fontSize: "1.25rem",
          fontWeight: 800,
          fontFamily: "ui-monospace, monospace",
          color: "#a855f7",
        }}>
          ${totalPortfolio.toFixed(2)}
        </span>
        <span style={{
          fontSize: "0.7rem",
          fontWeight: 600,
          color: growthPercent >= 0 ? "#22c55e" : "#ef4444",
        }}>
          ({growthPercent >= 0 ? "+" : ""}{growthPercent.toFixed(1)}%)
        </span>
      </div>

      {/* P&L and Growth */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        gap: "0.5rem",
        marginBottom: "0.75rem",
      }}>
        <div style={{
          padding: "0.5rem",
          borderRadius: 6,
          background: isProfit ? "rgba(34, 197, 94, 0.1)" : "rgba(239, 68, 68, 0.1)",
          textAlign: "center",
        }}>
          <div style={{ fontSize: "0.6rem", color: "var(--text-muted)", textTransform: "uppercase" }}>
            This Hour
          </div>
          <div style={{
            fontSize: "0.9rem",
            fontWeight: 800,
            fontFamily: "ui-monospace, monospace",
            color: isProfit ? "#22c55e" : "#ef4444",
          }}>
            {isProfit ? "+" : ""}{hourPnl.toFixed(2)}
          </div>
        </div>
        <div style={{
          padding: "0.5rem",
          borderRadius: 6,
          background: "rgba(59, 130, 246, 0.1)",
          textAlign: "center",
        }}>
          <div style={{ fontSize: "0.6rem", color: "var(--text-muted)", textTransform: "uppercase" }}>
            Total P&L
          </div>
          <div style={{
            fontSize: "0.9rem",
            fontWeight: 800,
            fontFamily: "ui-monospace, monospace",
            color: totalPortfolio > startPortfolio ? "#22c55e" : "#ef4444",
          }}>
            {totalPortfolio > startPortfolio ? "+" : ""}${(totalPortfolio - startPortfolio).toFixed(2)}
          </div>
        </div>
      </div>

      {/* Stats Row */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(4, 1fr)",
        gap: "0.5rem",
        marginBottom: "0.5rem",
      }}>
        <StatBox label="Trades" value={hourTrades} />
        <StatBox label="Wins" value={hourWins} color="#22c55e" />
        <StatBox label="Losses" value={hourLosses} color="#ef4444" />
        <StatBox label="Win%" value={hourTrades > 0 ? `${Math.round((hourWins / hourTrades) * 100)}%` : '0%'} color={hourWins >= hourLosses ? "#22c55e" : "#ef4444"} />
      </div>

      {/* Best Bot */}
      {bestBot && (
        <div style={{
          padding: "0.4rem",
          borderRadius: 6,
          background: "rgba(34, 197, 94, 0.08)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <TrendingUp style={{ width: 14, height: 14, color: "#22c55e" }} />
            <span style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>Best this hour:</span>
            <span style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--text-primary)" }}>
              {bestBot.name}
            </span>
          </div>
          <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "#22c55e" }}>
            +${(bestBot.pnl ?? 0).toFixed(2)}
          </span>
        </div>
      )}
    </div>
  );
}
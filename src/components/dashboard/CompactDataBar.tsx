import { motion } from "framer-motion";
import {
  Zap,
  TrendingUp,
  TrendingDown,
  Activity,
  Target,
  Clock,
  Play,
  Square,
  Crosshair,
  Trophy,
  Wallet,
  Flame
} from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { QUICK_RUN_OPTIONS } from "@/components/dashboard";
import { formatTimeRemaining } from "./useTopDashboardState";
import type { CompetitionState, LiveBalance } from "@/hooks/useTradingData";

function formatBTCPrice(price: number): string {
  if (price >= 1000) {
    return price.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  }
  return price.toFixed(2);
}

interface CompactDataBarProps {
  // Market
  yesPrice: number;
  noPrice: number;
  timeRemaining: number;
  btcPrice?: number;
  priceToBeat?: number;

  // Balances
  totalBotsBalance: number;
  liveBalance?: LiveBalance;

  // Performance
  totalPnl: number;
  totalTrades: number;
  totalWinRate: number;
  totalWins?: number;
  totalLosses?: number;

  // Exposure & Bots
  totalExposure: number;
  exposureRatio: number;
  activeBots: number;
  totalBots: number;

  // Competition
  competition: CompetitionState | null;
  runTimeRemaining: number;
  isBotRunning: boolean;

  // New stats
  maxStreak?: number;
  yesBots?: number;
  noBots?: number;
  yesStake?: number;
  noStake?: number;
  netIfYesWins?: number;
  netIfNoWins?: number;

  // Controls
  onRunAll: () => Promise<void>;
  onStopAll: () => Promise<void>;
  onQuickRun: (durationMinutes: number) => Promise<void>;
}

export function CompactDataBar({
  yesPrice,
  noPrice,
  timeRemaining,
  btcPrice,
  priceToBeat,
  totalBotsBalance,
  liveBalance,
  totalPnl,
  totalTrades,
  totalWinRate,
  totalWins = 0,
  totalLosses = 0,
  totalExposure,
  exposureRatio,
  activeBots,
  totalBots,
  runTimeRemaining,
  isBotRunning,
  maxStreak = 0,
  yesBots = 0,
  noBots = 0,
  yesStake = 0,
  noStake = 0,
  netIfYesWins = 0,
  netIfNoWins = 0,
  onRunAll,
  onStopAll,
  onQuickRun,
}: CompactDataBarProps) {
  // Target price calculation
  const isAboveTarget = btcPrice && priceToBeat ? btcPrice >= priceToBeat : false;
  const priceDiffPercent = btcPrice && priceToBeat ? ((btcPrice - priceToBeat) / priceToBeat) * 100 : 0;

  // Progress bar for price target (0-100% range centered at 50%)
  const progressPercent = btcPrice && priceToBeat
    ? Math.min(100, Math.max(0, 50 + (priceDiffPercent * 10)))
    : 50;

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      style={{
        background: "rgba(10, 15, 25, 0.7)",
        backdropFilter: "blur(20px)",
        border: "1px solid rgba(255, 255, 255, 0.06)",
        borderRadius: "16px",
        overflow: "hidden",
        boxShadow: "0 8px 32px rgba(0, 0, 0, 0.3)"
      }}
    >
      {/* ROW 1: Market + Price Target + Controls */}
      <div style={{
        display: "flex",
        alignItems: "center",
        gap: "2rem",
        padding: "1rem 1.5rem",
        borderBottom: "1px solid rgba(255,255,255,0.05)",
      }}>
        {/* Timer Section */}
        <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
          <div style={{
            width: 48, height: 48, borderRadius: 12,
            background: timeRemaining < 60000 ? "rgba(239, 68, 68, 0.15)" : timeRemaining < 180000 ? "rgba(245, 158, 11, 0.15)" : "rgba(34, 197, 94, 0.15)",
            display: "flex", alignItems: "center", justifyContent: "center",
            border: `1px solid ${timeRemaining < 60000 ? "rgba(239, 68, 68, 0.3)" : timeRemaining < 180000 ? "rgba(245, 158, 11, 0.3)" : "rgba(34, 197, 94, 0.3)"}`
          }}>
            <Clock style={{ width: 24, height: 24, color: timeRemaining < 60000 ? "#ef4444" : timeRemaining < 180000 ? "#f59e0b" : "#22c55e" }} />
          </div>
          <div>
            <div style={{ fontSize: "0.7rem", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 600 }}>Time Left</div>
            <span style={{ fontSize: "1.5rem", fontWeight: 800, fontFamily: "ui-monospace, monospace", color: "var(--text-primary)" }}>
              {Math.floor(timeRemaining / 60000)}:{String(Math.floor((timeRemaining % 60000) / 1000)).padStart(2, '0')}
            </span>
          </div>
        </div>

        <div style={{ width: 1, height: 48, background: "rgba(255,255,255,0.08)" }} />

        {/* YES/NO Odds - Large */}
        <div style={{ display: "flex", gap: "1rem" }}>
          <div style={{
            padding: "0.75rem 1.25rem",
            borderRadius: 12,
            background: "rgba(34, 197, 94, 0.08)",
            border: "1px solid rgba(34, 197, 94, 0.2)",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.625rem" }}>
              <TrendingUp style={{ width: 18, height: 18, color: "#22c55e" }} />
              <span style={{ fontSize: "0.8rem", fontWeight: 700, color: "#22c55e" }}>UP</span>
            </div>
            <span style={{ fontSize: "1.75rem", fontWeight: 800, color: "#22c55e", fontFamily: "ui-monospace, monospace" }}>
              {yesPrice > 0 && yesPrice < 1 ? `${(yesPrice * 100).toFixed(1)}¢` : "—"}
            </span>
          </div>
          <div style={{
            padding: "0.75rem 1.25rem",
            borderRadius: 12,
            background: "rgba(239, 68, 68, 0.08)",
            border: "1px solid rgba(239, 68, 68, 0.2)",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.625rem" }}>
              <TrendingDown style={{ width: 18, height: 18, color: "#ef4444" }} />
              <span style={{ fontSize: "0.8rem", fontWeight: 700, color: "#ef4444" }}>DOWN</span>
            </div>
            <span style={{ fontSize: "1.75rem", fontWeight: 800, color: "#ef4444", fontFamily: "ui-monospace, monospace" }}>
              {noPrice > 0 && noPrice < 1 ? `${(noPrice * 100).toFixed(1)}¢` : "—"}
            </span>
          </div>
        </div>

        <div style={{ width: 1, height: 48, background: "rgba(255,255,255,0.08)" }} />

        {/* Price Target Tracker */}
        <div style={{ flex: 1, maxWidth: 400, minWidth: 280, display: "flex", flexDirection: "column", justifyContent: "center" }}>
          {btcPrice && priceToBeat ? (
            <>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.5rem" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <Crosshair style={{ width: 16, height: 16, color: "var(--text-muted)" }} />
                <span style={{ fontSize: "0.7rem", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 600 }}>
                  Target: ${formatBTCPrice(priceToBeat)}
                </span>
              </div>
              <span style={{
                fontSize: "0.8rem",
                fontWeight: 700,
                padding: "0.25rem 0.625rem",
                borderRadius: 6,
                background: isAboveTarget ? "rgba(34, 197, 94, 0.15)" : "rgba(239, 68, 68, 0.15)",
                color: isAboveTarget ? "#22c55e" : "#ef4444",
              }}>
                {isAboveTarget ? "▲ UP" : "▼ DOWN"}
              </span>
            </div>

            {/* Price Bar */}
            <div style={{ position: "relative" }}>
              <div style={{
                height: 8,
                borderRadius: 4,
                background: "rgba(255,255,255,0.08)",
                overflow: "hidden",
              }}>
                <motion.div
                  initial={false}
                  animate={{ width: `${progressPercent}%` }}
                  transition={{ duration: 0.5, ease: "easeOut" }}
                  style={{
                    height: "100%",
                    borderRadius: 4,
                    background: isAboveTarget
                      ? "linear-gradient(90deg, rgba(34,197,94,0.3), rgba(34,197,94,0.8))"
                      : "linear-gradient(90deg, rgba(239,68,68,0.3), rgba(239,68,68,0.8))",
                  }}
                />
              </div>
              {/* Target marker */}
              <div style={{
                position: "absolute", top: -2, left: "50%", width: 2, height: 12,
                background: "var(--text-muted)", borderRadius: 1,
              }} />
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", marginTop: "0.375rem" }}>
              <span style={{ fontSize: "0.75rem", color: "#ef4444", fontWeight: 600 }}>DOWN</span>
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <span style={{ fontSize: "1.1rem", fontWeight: 800, fontFamily: "ui-monospace, monospace", color: "var(--text-primary)" }}>
                  ${formatBTCPrice(btcPrice)}
                </span>
                <span style={{
                  fontSize: "0.75rem",
                  fontWeight: 700,
                  color: isAboveTarget ? "#22c55e" : "#ef4444",
                }}>
                  ({priceDiffPercent >= 0 ? "+" : ""}{priceDiffPercent.toFixed(3)}%)
                </span>
              </div>
              <span style={{ fontSize: "0.75rem", color: "#22c55e", fontWeight: 600 }}>UP</span>
            </div>
          </>
          ) : (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", opacity: 0.5, height: 40 }}>
              <span style={{ fontSize: "0.8rem", color: "var(--text-muted)", fontFamily: "ui-monospace, monospace" }}>
                Waiting for target...
              </span>
            </div>
          )}
        </div>

        {/* Controls */}
        <div style={{ display: "flex", alignItems: "center", gap: "1rem", marginLeft: "auto" }}>
          {!isBotRunning && (
            <div style={{ display: "flex", background: "rgba(255,255,255,0.04)", borderRadius: 10, border: "1px solid rgba(255,255,255,0.08)", padding: "0.25rem" }}>
              {QUICK_RUN_OPTIONS.map(opt => (
                <button
                  key={opt.minutes}
                  onClick={() => onQuickRun(opt.minutes)}
                  style={{
                    padding: "0.5rem 0.75rem",
                    borderRadius: 8,
                    fontSize: "0.8rem",
                    fontWeight: 600,
                    background: "transparent",
                    color: "var(--text-muted)",
                    border: "none",
                    cursor: "pointer",
                  }}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          )}

          <motion.button
            whileHover={{ scale: isBotRunning ? 1 : 1.03 }}
            whileTap={{ scale: isBotRunning ? 1 : 0.97 }}
            onClick={onRunAll}
            disabled={isBotRunning}
            style={{
              display: "flex", alignItems: "center", gap: "0.5rem", padding: "0.625rem 1.25rem",
              borderRadius: 10, border: "none",
              background: isBotRunning ? "rgba(34, 197, 94, 0.1)" : "linear-gradient(135deg, #22c55e, #16a34a)",
              color: isBotRunning ? "#22c55e" : "white",
              fontWeight: 700, cursor: isBotRunning ? "not-allowed" : "pointer", fontSize: "0.9rem",
              boxShadow: isBotRunning ? "none" : "0 4px 16px rgba(34, 197, 94, 0.3)"
            }}
          >
            <Play style={{ width: 16, height: 16 }} fill={!isBotRunning ? "currentColor" : "none"} />
            RUN
          </motion.button>

          <motion.button
            whileHover={{ scale: !isBotRunning ? 1 : 1.03 }}
            whileTap={{ scale: !isBotRunning ? 1 : 0.97 }}
            onClick={onStopAll}
            disabled={!isBotRunning}
            style={{
              display: "flex", alignItems: "center", gap: "0.5rem", padding: "0.625rem 1.25rem",
              borderRadius: 10, border: isBotRunning ? "1px solid rgba(239, 68, 68, 0.4)" : "1px solid rgba(255,255,255,0.1)",
              background: isBotRunning ? "rgba(239, 68, 68, 0.1)" : "transparent",
              color: isBotRunning ? "#ef4444" : "var(--text-muted)",
              fontWeight: 700, cursor: !isBotRunning ? "not-allowed" : "pointer", fontSize: "0.9rem",
            }}
          >
            <Square style={{ width: 16, height: 16 }} />
            STOP
          </motion.button>
        </div>
      </div>

      {/* ROW 2: Stats */}
      <div style={{
        display: "flex",
        alignItems: "center",
        gap: "2rem",
        padding: "0.875rem 1.5rem",
        background: "rgba(0,0,0,0.2)",
      }}>
        {/* Balances */}
        <div style={{ display: "flex", alignItems: "center", gap: "1.5rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: "rgba(96, 165, 250, 0.12)", display: "flex", alignItems: "center", justifyContent: "center", border: "1px solid rgba(96, 165, 250, 0.2)" }}>
              <Wallet style={{ width: 18, height: 18, color: "#60a5fa" }} />
            </div>
            <div>
              <div style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>Demo</div>
              <span style={{ fontSize: "1.1rem", fontWeight: 700, fontFamily: "ui-monospace, monospace" }}>
                {formatCurrency(totalBotsBalance)}
              </span>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: "rgba(168, 85, 247, 0.12)", display: "flex", alignItems: "center", justifyContent: "center", border: "1px solid rgba(168, 85, 247, 0.2)" }}>
              <Zap style={{ width: 18, height: 18, color: "var(--primary)" }} />
            </div>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <span style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>Live</span>
                {liveBalance?.isLive && <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#22c55e", boxShadow: "0 0 8px #22c55e" }} />}
              </div>
              <span style={{ fontSize: "1.1rem", fontWeight: 700, fontFamily: "ui-monospace, monospace", color: liveBalance?.isLive ? "var(--text-primary)" : "var(--text-muted)" }}>
                ${(liveBalance?.balance || 0).toFixed(2)}
              </span>
            </div>
          </div>
        </div>

        <div style={{ width: 1, height: 36, background: "rgba(255,255,255,0.08)" }} />

        {/* P&L + Performance */}
        <div style={{ display: "flex", alignItems: "center", gap: "1.5rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
            <div style={{
              width: 36, height: 36, borderRadius: 10,
              background: totalPnl >= 0 ? "rgba(34, 197, 94, 0.12)" : "rgba(239, 68, 68, 0.12)",
              display: "flex", alignItems: "center", justifyContent: "center",
              border: totalPnl >= 0 ? "1px solid rgba(34, 197, 94, 0.2)" : "1px solid rgba(239, 68, 68, 0.2)"
            }}>
              <Trophy style={{ width: 18, height: 18, color: totalPnl >= 0 ? "#22c55e" : "#ef4444" }} />
            </div>
            <div>
              <div style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>P&L</div>
              <span style={{ fontSize: "1.1rem", fontWeight: 700, fontFamily: "ui-monospace, monospace", color: totalPnl >= 0 ? "#22c55e" : "#ef4444" }}>
                {totalPnl >= 0 ? "+" : ""}{formatCurrency(totalPnl)}
              </span>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: "rgba(167, 139, 250, 0.12)", display: "flex", alignItems: "center", justifyContent: "center", border: "1px solid rgba(167, 139, 250, 0.2)" }}>
              <Activity style={{ width: 18, height: 18, color: "#a78bfa" }} />
            </div>
            <div>
              <div style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>Win Rate</div>
              <span style={{ fontSize: "1.1rem", fontWeight: 700, fontFamily: "ui-monospace, monospace", color: totalWinRate > 0.5 ? "#22c55e" : "var(--text-primary)" }}>
                {(totalWinRate * 100).toFixed(0)}%
              </span>
            </div>
          </div>

          <div>
            <div style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>Trades</div>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <span style={{ fontSize: "1.1rem", fontWeight: 700, fontFamily: "ui-monospace, monospace" }}>{totalTrades}</span>
              <span style={{ fontSize: "0.8rem", fontWeight: 600 }}>
                <span style={{ color: "#22c55e" }}>{totalWins}W</span>/<span style={{ color: "#ef4444" }}>{totalLosses}L</span>
              </span>
            </div>
          </div>
        </div>

        <div style={{ width: 1, height: 36, background: "rgba(255,255,255,0.08)" }} />

        {/* Exposure & Bots */}
        <div style={{ display: "flex", alignItems: "center", gap: "1.5rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
            <div style={{
              width: 36, height: 36, borderRadius: 10,
              background: totalExposure > 0 ? "rgba(245, 158, 11, 0.12)" : "rgba(255,255,255,0.05)",
              display: "flex", alignItems: "center", justifyContent: "center",
              border: totalExposure > 0 ? "1px solid rgba(245, 158, 11, 0.2)" : "1px solid rgba(255,255,255,0.08)"
            }}>
              <Target style={{ width: 18, height: 18, color: totalExposure > 0 ? "#f59e0b" : "var(--text-muted)" }} />
            </div>
            <div>
              <div style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>Exposure</div>
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <span style={{ fontSize: "1.1rem", fontWeight: 700, fontFamily: "ui-monospace, monospace", color: totalExposure > 0 ? "#f59e0b" : "var(--text-muted)" }}>
                  {formatCurrency(totalExposure)}
                </span>
                <span style={{
                  fontSize: "0.7rem",
                  fontWeight: 700,
                  padding: "0.2rem 0.5rem",
                  borderRadius: 4,
                  background: exposureRatio > 50 ? "rgba(239, 68, 68, 0.15)" : "rgba(34, 197, 94, 0.15)",
                  color: exposureRatio > 50 ? "#ef4444" : "#22c55e"
                }}>
                  {exposureRatio.toFixed(0)}%
                </span>
              </div>
            </div>
          </div>

          <div>
            <div style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>Bots</div>
            <span style={{ fontSize: "1.1rem", fontWeight: 700, color: isBotRunning ? "#22c55e" : "var(--text-muted)" }}>
              {activeBots}/{totalBots}
            </span>
          </div>
        </div>

        {/* YES/NO Distribution & Potential Outcomes */}
        {(yesBots > 0 || noBots > 0) && (
          <>
            <div style={{ width: 1, height: 36, background: "rgba(255,255,255,0.08)" }} />

            <div style={{ display: "flex", alignItems: "center", gap: "1.5rem" }}>
              {/* YES/NO Bot Distribution */}
              <div>
                <div style={{ fontSize: "0.7rem", color: "var(--text-muted)", marginBottom: "0.25rem" }}>Positions</div>
                <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                  <span style={{ display: "flex", alignItems: "center", gap: "0.25rem", fontSize: "0.85rem", fontWeight: 600 }}>
                    <TrendingUp style={{ width: 14, height: 14, color: "#22c55e" }} />
                    <span style={{ color: "#22c55e" }}>{yesBots}</span>
                    <span style={{ color: "var(--text-muted)", fontWeight: 400 }}>UP</span>
                  </span>
                  <span style={{ display: "flex", alignItems: "center", gap: "0.25rem", fontSize: "0.85rem", fontWeight: 600 }}>
                    <TrendingDown style={{ width: 14, height: 14, color: "#ef4444" }} />
                    <span style={{ color: "#ef4444" }}>{noBots}</span>
                    <span style={{ color: "var(--text-muted)", fontWeight: 400 }}>DOWN</span>
                  </span>
                </div>
              </div>

              {/* Potential Outcomes */}
              {(Math.abs(netIfYesWins) > 0.01 || Math.abs(netIfNoWins) > 0.01) && (
                <div style={{ display: "flex", gap: "1.5rem" }}>
                  <div>
                    <div style={{ fontSize: "0.7rem", color: "var(--text-muted)", marginBottom: "0.25rem" }}>If UP wins</div>
                    <span style={{
                      fontSize: "0.9rem",
                      fontWeight: 700,
                      fontFamily: "ui-monospace, monospace",
                      color: netIfYesWins >= 0 ? "#22c55e" : "#ef4444"
                    }}>
                      {netIfYesWins >= 0 ? "+" : ""}{formatCurrency(netIfYesWins)}
                    </span>
                  </div>
                  <div>
                    <div style={{ fontSize: "0.7rem", color: "var(--text-muted)", marginBottom: "0.25rem" }}>If DOWN wins</div>
                    <span style={{
                      fontSize: "0.9rem",
                      fontWeight: 700,
                      fontFamily: "ui-monospace, monospace",
                      color: netIfNoWins >= 0 ? "#22c55e" : "#ef4444"
                    }}>
                      {netIfNoWins >= 0 ? "+" : ""}{formatCurrency(netIfNoWins)}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </>
        )}

        {/* Max Streak */}
        {maxStreak > 0 && (
          <>
            <div style={{ width: 1, height: 36, background: "rgba(255,255,255,0.08)" }} />

            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: "rgba(251, 146, 60, 0.12)", display: "flex", alignItems: "center", justifyContent: "center", border: "1px solid rgba(251, 146, 60, 0.2)" }}>
                <Flame style={{ width: 18, height: 18, color: "#fb923c" }} />
              </div>
              <div>
                <div style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>Best Streak</div>
                <span style={{ fontSize: "1rem", fontWeight: 700, color: "#fb923c" }}>{maxStreak} wins</span>
              </div>
            </div>
          </>
        )}

        {/* Run Timer - Prominent display at the end */}
        {isBotRunning && runTimeRemaining > 0 && (
          <>
            <div style={{ width: 1, height: 36, background: "rgba(255,255,255,0.08)" }} />

            <div style={{
              display: "flex",
              alignItems: "center",
              gap: "0.75rem",
              padding: "0.5rem 1rem",
              borderRadius: 12,
              background: runTimeRemaining < 60000
                ? "linear-gradient(135deg, rgba(239, 68, 68, 0.2), rgba(239, 68, 68, 0.1))"
                : runTimeRemaining < 180000
                  ? "linear-gradient(135deg, rgba(245, 158, 11, 0.2), rgba(245, 158, 11, 0.1))"
                  : "linear-gradient(135deg, rgba(34, 197, 94, 0.2), rgba(34, 197, 94, 0.1))",
              border: runTimeRemaining < 60000
                ? "1px solid rgba(239, 68, 68, 0.4)"
                : runTimeRemaining < 180000
                  ? "1px solid rgba(245, 158, 11, 0.4)"
                  : "1px solid rgba(34, 197, 94, 0.4)",
            }}>
              <Clock style={{
                width: 20,
                height: 20,
                color: runTimeRemaining < 60000 ? "#ef4444" : runTimeRemaining < 180000 ? "#f59e0b" : "#22c55e"
              }} />
              <div style={{ display: "flex", flexDirection: "column" }}>
                <span style={{ fontSize: "0.65rem", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  Time Left
                </span>
                <span style={{
                  fontSize: "1.4rem",
                  fontWeight: 800,
                  fontFamily: "ui-monospace, monospace",
                  color: runTimeRemaining < 60000 ? "#ef4444" : runTimeRemaining < 180000 ? "#f59e0b" : "#22c55e",
                  lineHeight: 1,
                }}>
                  {formatTimeRemaining(runTimeRemaining)}
                </span>
              </div>
            </div>
          </>
        )}
      </div>
    </motion.div>
  );
}
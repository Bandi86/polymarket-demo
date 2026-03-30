import { Clock, Play, Square } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { CircularTimer, BotRunTimer } from "@/components/ui/CircularTimer";
import { QUICK_RUN_OPTIONS } from "@/components/dashboard";
import { formatTimeRemaining } from "./useTopDashboardState";
import type { MarketData, CompetitionState, LiveBalance } from "@/hooks/useTradingData";
import { RefreshCw } from "lucide-react";

interface MarketInfoPanelProps {
  marketData: MarketData | null;
  competition: CompetitionState | null;
  yesPrice: number;
  noPrice: number;
  timeRemaining: number;
  runTimeRemaining: number;
  isBotRunning: boolean;
  bots: BotData[];
  activeBots: number;
  totalBotsBalance: number;
  totalPnl: number;
  totalWinRate: number;
  totalTrades: number;
  totalWins: number;
  totalLosses: number;
  totalExposure: number;
  exposureRatio: number;
  potentialWin: number;
  potentialLoss: number;
  openPositionsCount: number;
  liveBalance?: LiveBalance;
  onRefreshLiveBalance?: () => Promise<void>;
  onRunAll: () => Promise<void>;
  onStopAll: () => Promise<void>;
  onQuickRun: (durationMinutes: number) => Promise<void>;
  tradingMode: "demo" | "live";
  setTradingMode?: (mode: "demo" | "live") => void;
  // New props for enhanced stats
  totalStake?: number;
  yesTrades?: number;
  noTrades?: number;
  btcPrice?: number;
  btcDelta?: number;
}

interface BotData {
  id: string;
  name: string;
  strategy: string;
  enabled: boolean;
  portfolio: {
    balance: number;
  };
  stats: {
    pnl: number;
    trades: number;
    wins: number;
    losses: number;
  };
}

export function MarketInfoPanel({
  marketData,
  competition,
  yesPrice,
  noPrice,
  timeRemaining,
  runTimeRemaining,
  isBotRunning,
  bots,
  activeBots,
  totalBotsBalance,
  totalPnl,
  totalWinRate,
  totalTrades,
  totalWins,
  totalLosses,
  totalExposure,
  exposureRatio,
  potentialWin,
  potentialLoss,
  openPositionsCount,
  liveBalance,
  onRefreshLiveBalance,
  onRunAll,
  onStopAll,
  onQuickRun,
  totalStake = 0,
  yesTrades = 0,
  noTrades = 0,
  btcPrice,
  btcDelta,
}: MarketInfoPanelProps) {
  if (!marketData?.market) return null;

  const elapsed = marketData.marketDuration ? (marketData.marketDuration - (marketData.timeRemaining || 0)) : 0;
  const marketProgress = marketData.marketDuration ? Math.min(100, Math.max(0, (elapsed / marketData.marketDuration) * 100)) : 0;

  return (
    <div style={{
      background: "linear-gradient(wrap, rgba(0,0,0,0.4), rgba(0,0,0,0.2))",
      border: "1px solid var(--border)",
      borderRadius: 12,
      display: "flex",
      flexDirection: "column",
      overflow: "hidden"
    }}>
      {/* Top Half: Current Market */}
      <div style={{ borderBottom: "1px solid var(--border)", padding: "1rem 1.5rem", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        {/* Left: Market Info + Bot Run Timer */}
        <div style={{ display: "flex", alignItems: "center", gap: "1.5rem" }}>
          {/* Bot Run Timer - Prominent Position */}
          {isBotRunning && (
            <BotRunTimer
              runTimeRemaining={runTimeRemaining}
              isRunning={isBotRunning}
              totalDuration={competition?.config?.duration || undefined}
            />
          )}

          <div style={{ flex: "1 1 auto", minWidth: 0 }}>
            <div style={{ fontSize: "0.625rem", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "0.25rem" }}>
              Current Market
            </div>
            <div style={{ fontSize: "1rem", fontWeight: 600, color: "var(--text-primary)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {marketData.market.question || `${marketData.market.asset || "BTC"} ${marketData.market.timeframe || "5m"} Market`}
            </div>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "2rem" }}>
          {/* Circular Timer - Central, Animated */}
          <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
            <CircularTimer
              timeRemaining={timeRemaining}
              totalDuration={marketData.marketDuration || 300000}
              size={72}
              strokeWidth={5}
            />
            {/* Market Progress Info */}
            <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
              <div style={{ fontSize: "0.625rem", color: "var(--text-muted)" }}>
                {marketProgress.toFixed(0)}% elapsed
              </div>
              <div style={{ width: 80, height: 4, background: "rgba(255,255,255,0.1)", borderRadius: 2, overflow: "hidden" }}>
                <div
                  style={{
                    height: "100%",
                    width: `${marketProgress}%`,
                    background: timeRemaining < 60000 ? "#ef4444" : timeRemaining < 180000 ? "#f59e0b" : "#22c55e",
                    borderRadius: 2,
                    transition: "width 1s linear"
                  }}
                />
              </div>
            </div>
          </div>

          {/* Current Probabilities */}
          <div style={{ display: "flex", gap: "1rem", borderLeft: "1px solid var(--border)", paddingLeft: "1.5rem" }}>
            <div style={{ textAlign: "center", padding: "0.5rem 0.75rem", background: "rgba(34, 197, 94, 0.1)", borderRadius: 8, border: "1px solid rgba(34, 197, 94, 0.2)" }}>
              <div style={{ fontSize: "0.625rem", color: "#22c55e", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 600 }}>YES</div>
              <div style={{ fontSize: "1.25rem", fontWeight: 700, color: "#22c55e" }}>
                {(yesPrice * 100).toFixed(1)}¢
              </div>
            </div>
            <div style={{ textAlign: "center", padding: "0.5rem 0.75rem", background: "rgba(239, 68, 68, 0.1)", borderRadius: 8, border: "1px solid rgba(239, 68, 68, 0.2)" }}>
              <div style={{ fontSize: "0.625rem", color: "#ef4444", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 600 }}>NO</div>
              <div style={{ fontSize: "1.25rem", fontWeight: 700, color: "#ef4444" }}>
                {(noPrice * 100).toFixed(1)}¢
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Half: Financials, Bot Stats & Controls */}
      <div style={{ padding: "0.75rem 1.5rem", display: "flex", alignItems: "center", justifyContent: "space-between", background: "rgba(255,255,255,0.02)" }}>
        <div style={{ display: "flex", gap: "2.5rem" }}>
          {/* Demo Balance */}
          <div>
            <span style={{ fontSize: "0.625rem", color: "var(--text-muted)", display: "block", textTransform: "uppercase", letterSpacing: "0.05em" }}>
              Demo Balance
            </span>
            <span style={{ fontSize: "1.25rem", fontWeight: 700, fontFamily: "ui-monospace, monospace", color: "var(--text-primary)" }}>
              {formatCurrency(liveBalance?.demoBalance || totalBotsBalance)}
            </span>
            <span style={{ fontSize: "0.625rem", color: "var(--text-muted)", marginLeft: "0.25rem" }}>
              ({bots.length} bots)
            </span>
          </div>

          {/* Divider */}
          <div style={{ width: 1, background: "var(--border)", height: 32, alignSelf: "center", opacity: 0.3 }} />

          {/* Live Polymarket Balance */}
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "0.375rem" }}>
              <span style={{ fontSize: "0.625rem", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                Polymarket Live
              </span>
              {/* Connection Status Badge */}
              {!liveBalance?.hasCredentials ? (
                <span style={{ fontSize: "0.5rem", padding: "0.125rem 0.375rem", background: "rgba(239, 68, 68, 0.2)", color: "#ef4444", borderRadius: 4, fontWeight: 600 }}>NO KEY</span>
              ) : !liveBalance?.hasPrivateKey ? (
                <span style={{ fontSize: "0.5rem", padding: "0.125rem 0.375rem", background: "rgba(245, 158, 11, 0.2)", color: "#f59e0b", borderRadius: 4, fontWeight: 600 }}>PARTIAL</span>
              ) : liveBalance?.isLive ? (
                <span style={{ fontSize: "0.5rem", padding: "0.125rem 0.375rem", background: "rgba(34, 197, 94, 0.2)", color: "#22c55e", borderRadius: 4, fontWeight: 600 }}>CONNECTED</span>
              ) : (
                <span style={{ fontSize: "0.5rem", padding: "0.125rem 0.375rem", background: "rgba(239, 68, 68, 0.2)", color: "#ef4444", borderRadius: 4, fontWeight: 600 }}>ERROR</span>
              )}
              {onRefreshLiveBalance && (
                <button onClick={onRefreshLiveBalance} style={{ background: "transparent", border: "none", cursor: "pointer", padding: "0.125rem", display: "flex", alignItems: "center" }} title="Refresh balance">
                  <RefreshCw className="w-3 h-3" style={{ color: "var(--text-muted)" }} />
                </button>
              )}
            </div>
            <div style={{ display: "flex", alignItems: "baseline", gap: "0.5rem" }}>
              <span style={{ fontSize: "1.25rem", fontWeight: 700, fontFamily: "ui-monospace, monospace", color: liveBalance?.isLive ? "var(--text-primary)" : "var(--text-muted)" }}>
                ${(liveBalance?.balance || 0).toFixed(2)}
              </span>
              {liveBalance?.error && (
                <span style={{ fontSize: "0.625rem", color: "#f59e0b", maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {liveBalance.error}
                </span>
              )}
            </div>
          </div>

          <div style={{ width: 1, background: "var(--border)", height: 32, alignSelf: "center", opacity: 0.3 }} />

          {/* Overall P&L */}
          <div>
            <span style={{ fontSize: "0.625rem", color: "var(--text-muted)", display: "block", textTransform: "uppercase", letterSpacing: "0.05em" }}>Total P&L</span>
            <span style={{ fontSize: "1.25rem", fontWeight: 700, fontFamily: "ui-monospace, monospace", color: totalPnl >= 0 ? "var(--green)" : "var(--red)" }}>
              {totalPnl >= 0 ? "+" : ""}{formatCurrency(totalPnl)}
            </span>
          </div>

          <div style={{ width: 1, background: "var(--border)", height: 32, alignSelf: "center", opacity: 0.5 }} />

          {/* Bot Stats */}
          <div>
            <span style={{ fontSize: "0.625rem", color: "var(--text-muted)", display: "block", textTransform: "uppercase", letterSpacing: "0.05em" }}>Bots Active</span>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <span style={{ fontSize: "1.25rem", fontWeight: 700, color: isBotRunning ? "var(--green)" : "var(--text-muted)" }}>
                {activeBots}<span style={{ color: "var(--text-muted)", fontWeight: 400, marginLeft: 2, fontSize: "1rem" }}>/{bots.length}</span>
              </span>
              {isBotRunning && runTimeRemaining > 0 && (
                <span style={{ display: "flex", alignItems: "center", gap: "0.25rem", fontSize: "0.75rem", fontFamily: "ui-monospace, monospace", color: runTimeRemaining < 60000 ? "var(--red)" : "var(--text-muted)", padding: "0.125rem 0.5rem", background: runTimeRemaining < 60000 ? "rgba(239, 68, 68, 0.1)" : "rgba(255,255,255,0.05)", borderRadius: 4 }}>
                  <Clock style={{ width: 12, height: 12 }} />
                  {formatTimeRemaining(runTimeRemaining)}
                </span>
              )}
            </div>
          </div>

          <div>
            <span style={{ fontSize: "0.625rem", color: "var(--text-muted)", display: "block", textTransform: "uppercase", letterSpacing: "0.05em" }}>Bot Win Rate</span>
            <span style={{ fontSize: "1.25rem", fontWeight: 700, fontFamily: "ui-monospace, monospace", color: "var(--text-primary)" }}>
              {(totalWinRate * 100).toFixed(0)}%
            </span>
          </div>

          <div>
            <span style={{ fontSize: "0.625rem", color: "var(--text-muted)", display: "block", textTransform: "uppercase", letterSpacing: "0.05em" }}>Bot Trades</span>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <span style={{ fontSize: "1.25rem", fontWeight: 700, fontFamily: "ui-monospace, monospace", color: "var(--text-primary)" }}>{totalTrades}</span>
              <span style={{ display: "flex", alignItems: "center", gap: "0.375rem", fontSize: "0.75rem" }}>
                <span style={{ color: "#22c55e" }}>{totalWins}W</span>
                <span style={{ color: "var(--text-muted)" }}>/</span>
                <span style={{ color: "#ef4444" }}>{totalLosses}L</span>
              </span>
            </div>
          </div>

          {/* YES/NO Trade Breakdown - Always visible */}
          <>
            <div style={{ width: 1, background: "var(--border)", height: 32, alignSelf: "center", opacity: 0.5 }} />
            <div>
              <span style={{ fontSize: "0.625rem", color: "var(--text-muted)", display: "block", textTransform: "uppercase", letterSpacing: "0.05em" }}>Trade Split</span>
              <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "0.25rem" }}>
                  <div style={{ width: 8, height: 8, borderRadius: 2, background: "#22c55e" }} />
                  <span style={{ fontSize: "0.875rem", fontWeight: 600, color: "#22c55e" }}>{yesTrades}</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "0.25rem" }}>
                  <div style={{ width: 8, height: 8, borderRadius: 2, background: "#ef4444" }} />
                  <span style={{ fontSize: "0.875rem", fontWeight: 600, color: "#ef4444" }}>{noTrades}</span>
                </div>
                {/* Visual bar - shows proportion */}
                <div style={{ width: 60, height: 6, background: "rgba(255,255,255,0.1)", borderRadius: 3, overflow: "hidden", display: "flex" }}>
                  <div style={{ width: `${(yesTrades / Math.max(1, yesTrades + noTrades)) * 100}%`, background: "#22c55e", height: "100%" }} />
                  <div style={{ width: `${(noTrades / Math.max(1, yesTrades + noTrades)) * 100}%`, background: "#ef4444", height: "100%" }} />
                </div>
              </div>
            </div>
          </>

          {/* Total Stake - Always visible */}
          <>
            <div style={{ width: 1, background: "var(--border)", height: 32, alignSelf: "center", opacity: 0.5 }} />
            <div>
              <span style={{ fontSize: "0.625rem", color: "var(--text-muted)", display: "block", textTransform: "uppercase", letterSpacing: "0.05em" }}>Total Stake</span>
              <span style={{ fontSize: "1.25rem", fontWeight: 700, fontFamily: "ui-monospace, monospace", color: totalStake > 0 ? "var(--primary)" : "var(--text-muted)" }}>
                {formatCurrency(totalStake)}
              </span>
            </div>
          </>

          {/* BTC Delta Indicator - Always visible */}
          <>
            <div style={{ width: 1, background: "var(--border)", height: 32, alignSelf: "center", opacity: 0.5 }} />
            <div>
              <span style={{ fontSize: "0.625rem", color: "var(--text-muted)", display: "block", textTransform: "uppercase", letterSpacing: "0.05em" }}>BTC Delta</span>
              <div style={{ display: "flex", alignItems: "center", gap: "0.375rem" }}>
                <span style={{ fontSize: "1.25rem", fontWeight: 700, fontFamily: "ui-monospace, monospace", color: btcDelta && btcDelta !== 0 ? (btcDelta > 0 ? "#22c55e" : "#ef4444") : "var(--text-muted)" }}>
                  {btcDelta ? `${btcDelta > 0 ? "+" : ""}${btcDelta.toFixed(3)}%` : "0.000%"}
                </span>
                <div style={{
                  padding: "0.125rem 0.375rem",
                  borderRadius: 4,
                  background: btcDelta && btcDelta > 0.05 ? "rgba(34, 197, 94, 0.15)" : btcDelta && btcDelta < -0.05 ? "rgba(239, 68, 68, 0.15)" : "rgba(255,255,255,0.05)",
                  color: btcDelta && btcDelta > 0.05 ? "#22c55e" : btcDelta && btcDelta < -0.05 ? "#ef4444" : "var(--text-muted)",
                  fontSize: "0.625rem",
                  fontWeight: 600
                }}>
                  {btcDelta && btcDelta > 0.05 ? "BULL" : btcDelta && btcDelta < -0.05 ? "BEAR" : "FLAT"}
                </div>
              </div>
            </div>
          </>

          {/* Exposure - Always visible */}
          <>
            <div style={{ width: 1, background: "var(--border)", height: 32, alignSelf: "center", opacity: 0.5 }} />
            <div>
              <span style={{ fontSize: "0.625rem", color: "var(--text-muted)", display: "block", textTransform: "uppercase", letterSpacing: "0.05em" }}>Exposure</span>
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <span style={{ fontSize: "1.25rem", fontWeight: 700, fontFamily: "ui-monospace, monospace", color: totalExposure > 0 ? "var(--warning)" : "var(--text-muted)" }}>
                  {formatCurrency(totalExposure)}
                </span>
                <span style={{ fontSize: "0.625rem", padding: "0.125rem 0.375rem", borderRadius: 4, background: exposureRatio > 50 ? "rgba(239, 68, 68, 0.15)" : exposureRatio > 25 ? "rgba(245, 158, 11, 0.15)" : "rgba(34, 197, 94, 0.15)", color: exposureRatio > 50 ? "#ef4444" : exposureRatio > 25 ? "#f59e0b" : "#22c55e" }}>
                  {exposureRatio.toFixed(0)}%
                </span>
              </div>
            </div>
          </>

          {/* Open Positions - Always visible */}
          <>
            <div style={{ width: 1, background: "var(--border)", height: 32, alignSelf: "center", opacity: 0.5 }} />
            <div>
              <span style={{ fontSize: "0.625rem", color: "var(--text-muted)", display: "block", textTransform: "uppercase", letterSpacing: "0.05em" }}>Positions</span>
              <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                <span style={{ fontSize: "1.25rem", fontWeight: 700, fontFamily: "ui-monospace, monospace", color: openPositionsCount > 0 ? "var(--primary)" : "var(--text-muted)" }}>{openPositionsCount}</span>
                {openPositionsCount > 0 && (
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.125rem" }}>
                    <span style={{ fontSize: "0.625rem", color: "#22c55e", display: "flex", alignItems: "center", gap: "0.25rem" }}>↑ +${potentialWin.toFixed(0)}</span>
                    <span style={{ fontSize: "0.625rem", color: "#ef4444", display: "flex", alignItems: "center", gap: "0.25rem" }}>↓ -${potentialLoss.toFixed(0)}</span>
                  </div>
                )}
              </div>
            </div>
          </>
        </div>

        {/* Control Buttons */}
        <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
          {/* Quick Run Buttons */}
          {!isBotRunning && (
            <div style={{ display: "flex", gap: "0.25rem", padding: "0.25rem", background: "var(--glass-bg)", borderRadius: 6, border: "1px solid var(--border)" }}>
              {QUICK_RUN_OPTIONS.map(opt => (
                <button
                  key={opt.minutes}
                  onClick={() => onQuickRun(opt.minutes)}
                  style={{
                    padding: "0.375rem 0.625rem",
                    borderRadius: 4,
                    fontSize: "0.75rem",
                    fontWeight: 600,
                    background: "transparent",
                    color: "var(--text-muted)",
                    border: "none",
                    cursor: "pointer",
                    transition: "all 0.2s",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = "rgba(34, 197, 94, 0.15)";
                    e.currentTarget.style.color = "#22c55e";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = "transparent";
                    e.currentTarget.style.color = "var(--text-muted)";
                  }}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          )}

          <button
            onClick={onRunAll}
            disabled={isBotRunning}
            style={{
              display: "flex", alignItems: "center", gap: "0.375rem",
              padding: "0.5rem 1.5rem", borderRadius: 8, border: "none",
              background: isBotRunning ? "rgba(34, 197, 94, 0.2)" : "linear-gradient(135deg, #22c55e, #16a34a)",
              color: isBotRunning ? "#22c55e" : "white",
              fontWeight: 600, cursor: isBotRunning ? "not-allowed" : "pointer", fontSize: "0.875rem",
              transition: "all 0.2s"
            }}
          >
            <Play className="w-4 h-4" fill={!isBotRunning ? "currentColor" : "none"} />
            RUN ALL
          </button>
          <button
            onClick={onStopAll}
            disabled={!isBotRunning}
            style={{
              display: "flex", alignItems: "center", gap: "0.375rem",
              padding: "0.5rem 1.5rem", borderRadius: 8,
              border: isBotRunning ? "1px solid var(--red)" : "1px solid var(--border)",
              background: isBotRunning ? "rgba(239, 68, 68, 0.1)" : "transparent",
              color: isBotRunning ? "var(--red)" : "var(--text-muted)",
              fontWeight: 600, cursor: !isBotRunning ? "not-allowed" : "pointer", fontSize: "0.875rem",
              transition: "all 0.2s"
            }}
          >
            <Square className="w-4 h-4" />
            STOP ALL
          </button>
        </div>
      </div>
    </div>
  );
}
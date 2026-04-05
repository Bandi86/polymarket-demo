import { Clock, Play, Square, Activity, DollarSign, TrendingUp, TrendingDown, Target, Zap, Crosshair, RefreshCw } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { CircularTimer, BotRunTimer } from "@/components/ui/CircularTimer";
import { QUICK_RUN_OPTIONS } from "@/components/dashboard";
import { formatTimeRemaining } from "./useTopDashboardState";
import type { MarketData, CompetitionState, LiveBalance } from "@/hooks/useTradingData";
import type { BotConfig } from "@/types";
import { motion } from "framer-motion";

function formatBTCPrice(price: number): string {
  if (price >= 1000) {
    return price.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  }
  return price.toFixed(2);
}

// Target Price Tracker - Compact inline display
function TargetPriceTracker({
  btcPrice,
  priceToBeat,
}: {
  btcPrice: number;
  priceToBeat: number;
  yesPrice: number;
}) {
  const priceDiff = btcPrice - priceToBeat;
  const priceDiffPercent = (priceDiff / priceToBeat) * 100;
  const isAboveTarget = priceDiff >= 0;

  return (
    <div style={{ display: "flex", alignItems: "center", gap: "1.5rem" }}>
      {/* Label */}
      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
        <Crosshair style={{ width: 14, height: 14, color: "var(--text-muted)" }} />
        <span style={{ fontSize: "0.65rem", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 600 }}>
          Target
        </span>
      </div>

      {/* Current Price */}
      <div style={{ display: "flex", alignItems: "baseline", gap: "0.375rem" }}>
        <span style={{ fontSize: "0.9rem", fontWeight: 700, fontFamily: "ui-monospace, monospace", color: "var(--text-primary)" }}>
          ${formatBTCPrice(btcPrice)}
        </span>
      </div>

      {/* Delta Badge */}
      <span style={{
        fontSize: "0.7rem",
        fontWeight: 700,
        padding: "0.125rem 0.5rem",
        borderRadius: 6,
        background: isAboveTarget ? "rgba(34, 197, 94, 0.15)" : "rgba(239, 68, 68, 0.15)",
        color: isAboveTarget ? "#22c55e" : "#ef4444",
        fontFamily: "ui-monospace, monospace",
      }}>
        {isAboveTarget ? "▲" : "▼"} {priceDiffPercent >= 0 ? "+" : ""}{priceDiffPercent.toFixed(3)}%
      </span>

      {/* Separator */}
      <div style={{ width: 1, height: 20, background: "rgba(255,255,255,0.08)" }} />

      {/* Target Price */}
      <span style={{ fontSize: "0.85rem", fontWeight: 600, fontFamily: "ui-monospace, monospace", color: "var(--text-muted)" }}>
        ${formatBTCPrice(priceToBeat)}
      </span>

      {/* Market Direction */}
      <span style={{
        fontSize: "0.65rem",
        fontWeight: 700,
        padding: "0.125rem 0.375rem",
        borderRadius: 4,
        background: isAboveTarget ? "rgba(34, 197, 94, 0.1)" : "rgba(239, 68, 68, 0.1)",
        color: isAboveTarget ? "#22c55e" : "#ef4444",
        letterSpacing: "0.05em",
      }}>
        {isAboveTarget ? "YES" : "NO"}
      </span>
    </div>
  );
}

interface MarketInfoPanelProps {
  marketData: MarketData | null;
  competition: CompetitionState | null;
  yesPrice: number;
  noPrice: number;
  timeRemaining: number;
  runTimeRemaining: number;
  isBotRunning: boolean;
  bots: BotConfig[];
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
  totalStake?: number;
  yesTrades?: number;
  noTrades?: number;
  btcPrice?: number;
  btcDelta?: number;
  priceToBeat?: number;
  activeTab?: string;
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
  priceToBeat,
  activeTab,
}: MarketInfoPanelProps) {
  if (!marketData?.market) return null;

  const elapsed = marketData.marketDuration ? (marketData.marketDuration - (marketData.timeRemaining || 0)) : 0;
  const marketProgress = marketData.marketDuration ? Math.min(100, Math.max(0, (elapsed / marketData.marketDuration) * 100)) : 0;

  return (
    <motion.div 
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      style={{
        background: "rgba(10, 15, 25, 0.4)",
        backdropFilter: "blur(24px)",
        border: "1px solid rgba(255, 255, 255, 0.08)",
        borderRadius: "16px",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        boxShadow: "0 8px 32px rgba(0, 0, 0, 0.3)"
      }}
    >
      {/* Top Section: Active Market & Main Indicators */}
      <div style={{ 
        borderBottom: "1px solid rgba(255, 255, 255, 0.05)", 
        padding: "1rem 1.75rem", 
        display: "flex", 
        alignItems: "center", 
        justifyContent: "space-between",
        background: "linear-gradient(90deg, rgba(255,255,255,0.01) 0%, rgba(255,255,255,0.03) 100%)"
      }}>
        {/* Market Context */}
        <div style={{ display: "flex", alignItems: "center", gap: "1.5rem" }}>
          {isBotRunning && (
            <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}>
              <BotRunTimer
                runTimeRemaining={runTimeRemaining}
                isRunning={isBotRunning}
                totalDuration={competition?.config?.duration || undefined}
              />
            </motion.div>
          )}

          <div>
            <div style={{ fontSize: "0.65rem", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.1em", fontWeight: 600, marginBottom: "0.25rem" }}>
              Active Market
            </div>
            <div style={{ fontSize: "1.125rem", fontWeight: 600, color: "var(--text-primary)", display: "flex", alignItems: "center", gap: "0.5rem" }}>
              {marketData.market.question || `${marketData.market.asset || "BTC"} ${marketData.market.timeframe || "5m"} Market`}
              {btcDelta !== undefined && (
                <span style={{
                  fontSize: "0.75rem",
                  padding: "0.125rem 0.5rem",
                  borderRadius: "12px",
                  background: btcDelta > 0 ? "rgba(34, 197, 94, 0.15)" : btcDelta < 0 ? "rgba(239, 68, 68, 0.15)" : "rgba(255,255,255,0.1)",
                  color: btcDelta > 0 ? "#22c55e" : btcDelta < 0 ? "#ef4444" : "var(--text-muted)",
                }}>
                  {btcDelta > 0 ? "+" : ""}{btcDelta.toFixed(3)}%
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Progress & Odds */}
        <div style={{ display: "flex", alignItems: "center", gap: "2rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "1.25rem" }}>
            <CircularTimer
              timeRemaining={timeRemaining}
              totalDuration={marketData.marketDuration || 300000}
              size={64}
              strokeWidth={4}
            />
            <div style={{ display: "flex", flexDirection: "column", gap: "0.375rem" }}>
              <div style={{ fontSize: "0.7rem", color: "var(--text-muted)", fontWeight: 500 }}>
                {marketProgress.toFixed(0)}% elapsed
              </div>
              <div style={{ width: 100, height: 4, background: "rgba(255,255,255,0.06)", borderRadius: 4, overflow: "hidden" }}>
                <motion.div
                  initial={false}
                  animate={{ width: `${marketProgress}%`, backgroundColor: timeRemaining < 60000 ? "#ef4444" : timeRemaining < 180000 ? "#f59e0b" : "#22c55e" }}
                  style={{ height: "100%", borderRadius: 4 }}
                  transition={{ duration: 1, ease: "linear" }}
                />
              </div>
            </div>
          </div>

          <div style={{ width: 1, height: 40, background: "rgba(255, 255, 255, 0.1)" }} />

          {/* YES/NO Odds */}
          <div style={{ display: "flex", gap: "0.75rem" }}>
            <motion.div
              key={`yes-${(yesPrice).toFixed(3)}`}
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              style={{ textAlign: "center", minWidth: "70px", padding: "0.625rem", background: "rgba(34, 197, 94, 0.08)", borderRadius: "10px", border: "1px solid rgba(34, 197, 94, 0.2)" }}
            >
              <div style={{ fontSize: "0.65rem", color: "#22c55e", fontWeight: 700, letterSpacing: "0.1em" }}>YES</div>
              <div style={{ fontSize: "1.25rem", fontWeight: 700, color: "#22c55e", fontFamily: "ui-monospace, monospace" }}>
                {yesPrice > 0 && yesPrice < 1 ? `${(yesPrice * 100).toFixed(1)}¢` : "—"}
              </div>
            </motion.div>
            <motion.div
              key={`no-${(noPrice).toFixed(3)}`}
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              style={{ textAlign: "center", minWidth: "70px", padding: "0.625rem", background: "rgba(239, 68, 68, 0.08)", borderRadius: "10px", border: "1px solid rgba(239, 68, 68, 0.2)" }}
            >
              <div style={{ fontSize: "0.65rem", color: "#ef4444", fontWeight: 700, letterSpacing: "0.1em" }}>NO</div>
              <div style={{ fontSize: "1.25rem", fontWeight: 700, color: "#ef4444", fontFamily: "ui-monospace, monospace" }}>
                {noPrice > 0 && noPrice < 1 ? `${(noPrice * 100).toFixed(1)}¢` : "—"}
              </div>
            </motion.div>
          </div>
        </div>
      </div>

      <div style={{
        borderBottom: "1px solid rgba(255, 255, 255, 0.05)",
        padding: "0.75rem 1.75rem",
        background: "rgba(0, 0, 0, 0.15)",
      }}>
        {priceToBeat && btcPrice ? (
          <TargetPriceTracker
            btcPrice={btcPrice}
            priceToBeat={priceToBeat}
            yesPrice={yesPrice}
          />
        ) : (
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <Crosshair style={{ width: 14, height: 14, color: "var(--text-muted)" }} />
            <span style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>Target price not available</span>
          </div>
        )}
      </div>

      {/* Bottom Section: Command Center Dashboard */}
      <div style={{
          padding: "0.75rem 1.75rem",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          background: "rgba(0, 0, 0, 0.2)"
        }}>

          {/* Metric Grid */}
          <div style={{
            display: "flex",
            gap: "1.5rem",
            flex: 1,
            overflowX: "auto",
            scrollbarWidth: "none",
            alignItems: "stretch"
          }}>
            {/* Portfolio Balances */}
            <div style={{ display: "flex", gap: "1rem", borderRight: "1px solid rgba(255,255,255,0.05)", paddingRight: "1.5rem" }}>
              <div style={{ display: "flex", flexDirection: "column", justifyContent: "center" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "0.375rem", marginBottom: "0.25rem" }}>
                  <DollarSign className="w-3.5 h-3.5 text-blue-400" />
                  <span style={{ fontSize: "0.65rem", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.1em" }}>Demo Bal</span>
                </div>
                <span style={{ fontSize: "1.125rem", fontWeight: 700, fontFamily: "ui-monospace, monospace" }}>
                  {formatCurrency(liveBalance?.demoBalance || totalBotsBalance)}
                </span>
              </div>

              <div style={{ display: "flex", flexDirection: "column", justifyContent: "center" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "0.375rem", marginBottom: "0.25rem" }}>
                  <Zap className="w-3.5 h-3.5 text-primary" />
                  <span style={{ fontSize: "0.65rem", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.1em" }}>Poly Live</span>
                  {liveBalance?.isLive && <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#22c55e", boxShadow: "0 0 8px #22c55e" }} />}
                </div>
                <span style={{ fontSize: "1.125rem", fontWeight: 700, fontFamily: "ui-monospace, monospace", color: liveBalance?.isLive ? "var(--text-primary)" : "var(--text-muted)" }}>
                  ${(liveBalance?.balance || 0).toFixed(2)}
                </span>
              </div>
            </div>

            {/* Performance Flow */}
            <div style={{ display: "flex", gap: "1.5rem", borderRight: "1px solid rgba(255,255,255,0.05)", paddingRight: "1.5rem" }}>
              <div style={{ display: "flex", flexDirection: "column", justifyContent: "center" }}>
                 <div style={{ display: "flex", alignItems: "center", gap: "0.375rem", marginBottom: "0.25rem" }}>
                  {totalPnl >= 0 ? <TrendingUp className="w-3.5 h-3.5 text-green-500" /> : <TrendingDown className="w-3.5 h-3.5 text-red-500" />}
                  <span style={{ fontSize: "0.65rem", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.1em" }}>Total P&L</span>
                </div>
                <span style={{ fontSize: "1.125rem", fontWeight: 700, fontFamily: "ui-monospace, monospace", color: totalPnl >= 0 ? "var(--green)" : "var(--red)" }}>
                  {totalPnl >= 0 ? "+" : ""}{formatCurrency(totalPnl)}
                </span>
              </div>

              <div style={{ display: "flex", flexDirection: "column", justifyContent: "center" }}>
                 <div style={{ display: "flex", alignItems: "center", gap: "0.375rem", marginBottom: "0.25rem" }}>
                  <Activity className="w-3.5 h-3.5 text-purple-400" />
                  <span style={{ fontSize: "0.65rem", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.1em" }}>Trades</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                  <span style={{ fontSize: "1.125rem", fontWeight: 700, fontFamily: "ui-monospace, monospace" }}>{totalTrades}</span>
                  <div style={{ display: "flex", gap: "0.25rem", fontSize: "0.75rem", fontWeight: 600 }}>
                    <span style={{ color: "#22c55e" }}>{yesTrades}Y</span>
                    <span style={{ color: "#ef4444" }}>{noTrades}N</span>
                  </div>
                </div>
              </div>

              <div style={{ display: "flex", flexDirection: "column", justifyContent: "center" }}>
                 <div style={{ display: "flex", alignItems: "center", gap: "0.375rem", marginBottom: "0.25rem", color: "var(--text-muted)" }}>
                  <span style={{ fontSize: "0.65rem", textTransform: "uppercase", letterSpacing: "0.1em" }}>Win Rate</span>
                </div>
                <span style={{ fontSize: "1.125rem", fontWeight: 700, fontFamily: "ui-monospace, monospace", color: totalWinRate > 0.5 ? "#22c55e" : "var(--text-primary)" }}>
                  {(totalWinRate * 100).toFixed(0)}%
                </span>
              </div>
            </div>

            {/* Risk & Exposure */}
            <div style={{ display: "flex", gap: "1.5rem" }}>
              <div style={{ display: "flex", flexDirection: "column", justifyContent: "center" }}>
                 <div style={{ display: "flex", alignItems: "center", gap: "0.375rem", marginBottom: "0.25rem", color: "var(--text-muted)" }}>
                   <Target className="w-3.5 h-3.5" />
                  <span style={{ fontSize: "0.65rem", textTransform: "uppercase", letterSpacing: "0.1em" }}>Exposure</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                  <span style={{ fontSize: "1.125rem", fontWeight: 700, fontFamily: "ui-monospace, monospace", color: totalExposure > 0 ? "var(--warning)" : "var(--text-muted)" }}>
                    {formatCurrency(totalExposure)}
                  </span>
                  <span style={{ fontSize: "0.65rem", padding: "0.125rem 0.375rem", borderRadius: 4, background: exposureRatio > 50 ? "rgba(239, 68, 68, 0.15)" : "rgba(34, 197, 94, 0.15)", color: exposureRatio > 50 ? "#ef4444" : "#22c55e", fontWeight: 600 }}>
                    {exposureRatio.toFixed(0)}%
                  </span>
                </div>
              </div>

              <div style={{ display: "flex", flexDirection: "column", justifyContent: "center" }}>
                 <div style={{ display: "flex", alignItems: "center", gap: "0.375rem", marginBottom: "0.25rem", color: "var(--text-muted)" }}>
                  <span style={{ fontSize: "0.65rem", textTransform: "uppercase", letterSpacing: "0.1em" }}>Bots</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "0.375rem" }}>
                  <span style={{ fontSize: "1.125rem", fontWeight: 700, color: isBotRunning ? "var(--green)" : "var(--text-muted)" }}>
                    {activeBots}/{bots.length}
                  </span>
                  {isBotRunning && runTimeRemaining > 0 && (
                    <span style={{ display: "flex", alignItems: "center", gap: "0.25rem", fontSize: "0.65rem", fontFamily: "ui-monospace, monospace", color: "var(--text-muted)", background: "rgba(255,255,255,0.05)", padding: "0.125rem 0.375rem", borderRadius: 4 }}>
                      <Clock style={{ width: 10, height: 10 }} /> {formatTimeRemaining(runTimeRemaining)}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Global Control Buttons */}
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginLeft: "1.5rem" }}>
            {!isBotRunning && (
              <div style={{ display: "flex", background: "rgba(255,255,255,0.03)", borderRadius: "8px", border: "1px solid rgba(255,255,255,0.08)", padding: "0.25rem" }}>
                {QUICK_RUN_OPTIONS.map(opt => (
                  <button
                    key={opt.minutes}
                    onClick={() => onQuickRun(opt.minutes)}
                    className="hover:bg-green-500/15 hover:text-green-500 transition-colors"
                    style={{
                      padding: "0.375rem 0.625rem", borderRadius: "6px", fontSize: "0.75rem", fontWeight: 600,
                      background: "transparent", color: "var(--text-muted)", border: "none", cursor: "pointer",
                    }}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            )}

            <motion.button
              whileHover={{ scale: isBotRunning ? 1 : 1.05 }}
              whileTap={{ scale: isBotRunning ? 1 : 0.95 }}
              onClick={onRunAll}
              disabled={isBotRunning}
              style={{
                display: "flex", alignItems: "center", gap: "0.5rem", padding: "0.5rem 1rem",
                borderRadius: "8px", border: "none",
                background: isBotRunning ? "rgba(34, 197, 94, 0.15)" : "linear-gradient(135deg, #22c55e, #16a34a)",
                color: isBotRunning ? "#22c55e" : "white",
                fontWeight: 600, cursor: isBotRunning ? "not-allowed" : "pointer", fontSize: "0.8rem",
                boxShadow: isBotRunning ? "none" : "0 4px 12px rgba(34, 197, 94, 0.3)"
              }}
            >
              <Play className="w-3.5 h-3.5" fill={!isBotRunning ? "currentColor" : "none"} />
              RUN
            </motion.button>

            <motion.button
              whileHover={{ scale: !isBotRunning ? 1 : 1.05 }}
              whileTap={{ scale: !isBotRunning ? 1 : 0.95 }}
              onClick={onStopAll}
              disabled={!isBotRunning}
              style={{
                display: "flex", alignItems: "center", gap: "0.5rem", padding: "0.5rem 1rem",
                borderRadius: "8px", border: isBotRunning ? "1px solid rgba(239, 68, 68, 0.4)" : "1px solid rgba(255,255,255,0.1)",
                background: isBotRunning ? "rgba(239, 68, 68, 0.15)" : "transparent",
                color: isBotRunning ? "#ef4444" : "var(--text-muted)",
                fontWeight: 600, cursor: !isBotRunning ? "not-allowed" : "pointer", fontSize: "0.8rem",
              }}
            >
              <Square className="w-3.5 h-3.5" />
              STOP
            </motion.button>
        </div>
      </div>
    </motion.div>
  );
}
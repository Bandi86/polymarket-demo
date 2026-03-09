import { useState } from "react";
import { BarChart3, TrendingUp, TrendingDown, Info } from "lucide-react";
import type { MarketData } from "../hooks/useTradingData";

interface MarketPanelProps {
  marketData: MarketData | null;
  selectedCoin: Coin;
  selectedStrategy: Strategy;
  selectedTimeframe: Timeframe;
  lastUpdate: number;
  yesPrice: number;
  noPrice: number;
  yesPriceDirection: "up" | "down" | null;
  noPriceDirection: "up" | "down" | null;
  coinColor: string;
  onCoinChange: (coin: Coin) => void;
  onStrategyChange: (strategy: Strategy) => void;
  onTimeframeChange: (timeframe: Timeframe) => void;
}

export type Coin = "BTC" | "ETH" | "SOL" | "XRP";
export type Strategy = "LN_EWMA" | "LN_GARCH" | "T_EWMA";
export type Timeframe = "5" | "15" | "60" | "240" | "D";

const COINS: { id: Coin; name: string; tvSymbol: string; color: string }[] = [
  { id: "BTC", name: "Bitcoin", tvSymbol: "BINANCE:BTCUSDT", color: "#f7931a" },
  { id: "ETH", name: "Ethereum", tvSymbol: "BINANCE:ETHUSDT", color: "#627eea" },
  { id: "SOL", name: "Solana", tvSymbol: "BINANCE:SOLUSDT", color: "#14f195" },
  { id: "XRP", name: "Ripple", tvSymbol: "BINANCE:XRPUSDT", color: "#346aa9" },
];

const STRATEGIES: { id: Strategy; name: string; description: string }[] = [
  { id: "LN_EWMA", name: "Classic", description: "Lognormal + EWMA volatility" },
  { id: "LN_GARCH", name: "Adaptive", description: "GARCH(1,1) adaptive model" },
  { id: "T_EWMA", name: "Fat Tails", description: "Student-t distribution" },
];

const TIMEFRAMES: { id: Timeframe; label: string; duration: number; description: string }[] = [
  { id: "5", label: "5m", duration: 5 * 60 * 1000, description: "5 minute markets" },
  { id: "15", label: "15m", duration: 15 * 60 * 1000, description: "15 minute markets" },
  { id: "60", label: "1h", duration: 60 * 60 * 1000, description: "1 hour markets" },
  { id: "240", label: "4h", duration: 4 * 60 * 60 * 1000, description: "4 hour markets" },
  { id: "D", label: "1d", duration: 24 * 60 * 60 * 1000, description: "Daily markets" },
];

function formatCountdown(ms: number): string {
  if (ms <= 0) return "Expired";
  const hours = Math.floor(ms / 3_600_000);
  const minutes = Math.floor((ms % 3_600_000) / 60_000);
  const seconds = Math.floor((ms % 60_000) / 1_000);
  if (hours > 0) return `${hours}h ${minutes.toString().padStart(2, "0")}m ${seconds.toString().padStart(2, "0")}s`;
  return `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
}

function formatTimeAgo(ms: number): string {
  const seconds = Math.floor((Date.now() - ms) / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  return `${Math.floor(seconds / 3600)}h ago`;
}

export function MarketPanel({
  marketData,
  selectedCoin,
  selectedStrategy,
  selectedTimeframe,
  lastUpdate,
  yesPrice,
  noPrice,
  yesPriceDirection,
  noPriceDirection,
  coinColor,
  onCoinChange,
  onStrategyChange,
  onTimeframeChange,
}: MarketPanelProps) {
  const timeRemaining = marketData?.timeRemaining || 0;
  const safeMarket = marketData?.market;
  const [showTimeframeInfo, setShowTimeframeInfo] = useState(false);

  const fairValueYes = 0.5;
  const edge = fairValueYes - yesPrice;
  const fairValueDiff = (edge * 100).toFixed(1);
  const isOverpriced = yesPrice > fairValueYes;

  const activeCoin = COINS.find(c => c.id === selectedCoin);
  const currentTimeframe = TIMEFRAMES.find(t => t.id === selectedTimeframe);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
      {/* Coin Selector */}
      <div className="glass-card" style={{ padding: "1rem" }}>
        <div className="coin-pills">
          {COINS.map((coin) => (
            <button
              key={coin.id}
              onClick={() => onCoinChange(coin.id)}
              className={`coin-pill ${selectedCoin === coin.id ? "active" : ""}`}
              style={selectedCoin === coin.id ? {
                background: `${coin.color}15`,
                borderColor: coin.color,
                color: coin.color
              } : {}}
            >
              {coin.id}
            </button>
          ))}
        </div>

        <div style={{ marginBottom: "1rem" }}>
          <h2 style={{ fontSize: "1.25rem", fontWeight: 700, marginBottom: "0.25rem" }}>
            <span style={{ color: coinColor }}>{selectedCoin}</span>
            <span style={{ color: "var(--text-secondary)", fontSize: "1rem", marginLeft: 8 }}>Up/Down</span>
          </h2>
          <p style={{ fontSize: "0.875rem", color: "var(--text-muted)" }}>
            {safeMarket?.question || `Will ${selectedCoin} go UP or DOWN in the next ${currentTimeframe?.label}?`}
          </p>
        </div>

        <div className="info-grid">
          <div className="info-item">
            <span className="info-label">Spot Price</span>
            <span className="info-value" style={{ color: coinColor }}>
              ${marketData?.btcPrice?.toLocaleString(undefined, { minimumFractionDigits: 2 }) || "—"}
            </span>
          </div>
          <div className="info-item">
            <span className="info-label">Strike Price</span>
            <span className="info-value">
              ${marketData?.btcPrice ? (marketData.btcPrice * 0.995).toFixed(0) : "—"}
            </span>
          </div>
          <div className="info-item">
            <span className="info-label">Time Remaining</span>
            <span style={{
              fontFamily: "monospace",
              fontSize: "1.25rem",
              fontWeight: 700,
              color: timeRemaining < 60000 ? "var(--red)" : timeRemaining < 300000 ? "var(--orange)" : "var(--text)"
            }}>
              {formatCountdown(timeRemaining)}
            </span>
          </div>
          <div className="info-item">
            <span className="info-label">Last Update</span>
            <span style={{ fontSize: "0.875rem", color: "var(--text-secondary)" }}>
              {formatTimeAgo(lastUpdate)}
            </span>
          </div>
        </div>
      </div>

      {/* Strategy Selector */}
      <div className="glass-card" style={{ padding: "1rem" }}>
        <div style={{ marginBottom: "1rem" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.5rem" }}>
            <span style={{ fontSize: "0.875rem", fontWeight: 500, color: "var(--text-secondary)" }}>Strategy</span>
          </div>
          <div className="strategy-pills">
            {STRATEGIES.map((strat) => (
              <button
                key={strat.id}
                onClick={() => onStrategyChange(strat.id)}
                className={`strategy-pill ${selectedStrategy === strat.id ? "active" : ""}`}
              >
                {strat.name}
              </button>
            ))}
          </div>
          <p style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: "0.5rem" }}>
            {STRATEGIES.find(s => s.id === selectedStrategy)?.description}
          </p>
        </div>

        <div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.5rem" }}>
            <span style={{ fontSize: "0.875rem", fontWeight: 500, color: "var(--text-secondary)" }}>Market Duration</span>
            <button
              onClick={() => setShowTimeframeInfo(!showTimeframeInfo)}
              style={{ background: "none", border: "none", cursor: "pointer", padding: 0 }}
            >
              <Info className="w-4 h-4" style={{ color: "var(--text-muted)" }} />
            </button>
          </div>
          <div className="tf-pills">
            {TIMEFRAMES.map((tf) => (
              <button
                key={tf.id}
                onClick={() => onTimeframeChange(tf.id)}
                className={`tf-pill ${selectedTimeframe === tf.id ? "active" : ""}`}
                title={tf.description}
              >
                {tf.label}
              </button>
            ))}
          </div>
          {showTimeframeInfo && (
            <p style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: "0.5rem", padding: "0.5rem", background: "var(--glass-bg)", borderRadius: 6 }}>
              Select market expiration time. The bot will look for Polymarket markets
              with matching duration. Note: Not all durations may be available.
            </p>
          )}
        </div>
      </div>

      {/* Fair Value Analysis */}
      <div className="glass-card" style={{ padding: "1rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "1rem" }}>
          <BarChart3 className="w-4 h-4" style={{ color: coinColor }} />
          <span style={{ fontWeight: 600 }}>Fair Value Analysis</span>
        </div>

        <div className="unified-grid">
          {/* YES Column */}
          <div className="uni-col">
            <span className="side-tag up">UP</span>
            <span
              className={`price-big ${yesPriceDirection === "up" ? "price-up" : yesPriceDirection === "down" ? "price-down" : ""}`}
              style={{ color: "var(--green)", transition: "all 0.3s" }}
            >
              {(yesPrice * 100).toFixed(1)}¢
            </span>
            <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginBottom: "0.75rem" }}>
              Implied {(yesPrice * 100).toFixed(0)}%
            </span>

            <div className="uni-divider" />

            <div className="uni-row">
              <span className="uni-label">Fair Price</span>
              <span className="uni-value">{(fairValueYes * 100).toFixed(1)}¢</span>
            </div>
            <div className="uni-row">
              <span className="uni-label">Market</span>
              <span className="uni-value">{(yesPrice * 100).toFixed(1)}¢</span>
            </div>
            <div className="uni-row uni-row-highlight">
              <span className="uni-label">Diff</span>
              <span style={{ fontFamily: "monospace", fontWeight: 500, color: isOverpriced ? "var(--red)" : "var(--green)" }}>
                {isOverpriced ? "" : "+"}{fairValueDiff}¢
              </span>
            </div>

            <div style={{ marginTop: "0.75rem" }}>
              <span className={`verdict ${isOverpriced ? "verdict-sell" : "verdict-buy"}`}>
                {isOverpriced ? "OVERPRICED" : "UNDERPRICED"}
              </span>
            </div>
          </div>

          {/* NO Column */}
          <div className="uni-col">
            <span className="side-tag down">DOWN</span>
            <span
              className={`price-big ${noPriceDirection === "up" ? "price-up" : noPriceDirection === "down" ? "price-down" : ""}`}
              style={{ color: "var(--red)", transition: "all 0.3s" }}
            >
              {(noPrice * 100).toFixed(1)}¢
            </span>
            <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginBottom: "0.75rem" }}>
              Implied {(noPrice * 100).toFixed(0)}%
            </span>

            <div className="uni-divider" />

            <div className="uni-row">
              <span className="uni-label">Fair Price</span>
              <span className="uni-value">{((1 - fairValueYes) * 100).toFixed(1)}¢</span>
            </div>
            <div className="uni-row">
              <span className="uni-label">Market</span>
              <span className="uni-value">{(noPrice * 100).toFixed(1)}¢</span>
            </div>
            <div className="uni-row uni-row-highlight">
              <span className="uni-label">Diff</span>
              <span style={{ fontFamily: "monospace", fontWeight: 500, color: !isOverpriced ? "var(--red)" : "var(--green)" }}>
                {!isOverpriced ? "" : "+"}{(-parseFloat(fairValueDiff)).toFixed(1)}¢
              </span>
            </div>

            <div style={{ marginTop: "0.75rem" }}>
              <span className={`verdict ${!isOverpriced ? "verdict-sell" : "verdict-buy"}`}>
                {!isOverpriced ? "OVERPRICED" : "UNDERPRICED"}
              </span>
            </div>
          </div>
        </div>

        {/* Probability Bar */}
        <div style={{ marginTop: "1rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.75rem", marginBottom: "0.5rem" }}>
            <span style={{ color: "var(--green)", fontWeight: 600 }}>YES {(yesPrice * 100).toFixed(1)}%</span>
            <span style={{ color: "var(--red)", fontWeight: 600 }}>NO {(noPrice * 100).toFixed(1)}%</span>
          </div>
          <div className="progress-bar">
            <div style={{ height: "100%", background: "var(--green)", transition: "width 0.5s", width: `${yesPrice * 100}%` }} />
            <div style={{ height: "100%", background: "var(--red)", transition: "width 0.5s", width: `${noPrice * 100}%` }} />
          </div>
        </div>
      </div>
    </div>
  );
}

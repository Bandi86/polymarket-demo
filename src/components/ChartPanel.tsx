import { TrendingUp, Clock } from "lucide-react";
import { TradingViewWidget } from "./trading-view-widget";
import type { MarketData, MarketHistory } from "../hooks/useTradingData";

interface ChartPanelProps {
  marketData: MarketData | null;
  marketHistory: MarketHistory[];
  selectedCoin: string;
  selectedTimeframe: string;
  coinColor: string;
  tvSymbol: string;
  yesPrice: number;
  noPrice: number;
}

export function ChartPanel({
  marketData,
  marketHistory,
  selectedCoin,
  selectedTimeframe,
  coinColor,
  tvSymbol,
  yesPrice,
  noPrice,
}: ChartPanelProps) {
  const safeMarket = marketData?.market;

  const formatTimeframe = (tf: string): string => {
    switch (tf) {
      case "D": return "1d";
      case "60": return "1h";
      case "240": return "4h";
      default: return `${tf}m`;
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
      {/* Main Chart */}
      <div className="glass-card" style={{ padding: "1rem" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.75rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <TrendingUp className="w-4 h-4" style={{ color: coinColor }} />
            <span style={{ fontWeight: 600 }}>{selectedCoin}/USDT</span>
            <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>• {formatTimeframe(selectedTimeframe)}</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>Live</span>
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--green)", animation: "pulse 2s infinite" }} />
          </div>
        </div>

        <TradingViewWidget
          symbol={tvSymbol}
          interval={selectedTimeframe}
          height={450}
        />
      </div>

      {/* Market Stats */}
      <div className="glass-card" style={{ padding: "1rem" }}>
        <div className="stats-grid">
          <div className="stat-item">
            <span className="stat-label">Volume</span>
            <span className="stat-value">
              ${(safeMarket?.volumeNum || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </span>
          </div>
          <div className="stat-item">
            <span className="stat-label">Liquidity</span>
            <span className="stat-value">
              ${(safeMarket?.liquidity || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </span>
          </div>
          <div className="stat-item">
            <span className="stat-label">YES Price</span>
            <span className="stat-value" style={{ color: "var(--green)" }}>
              {(yesPrice * 100).toFixed(1)}¢
            </span>
          </div>
          <div className="stat-item">
            <span className="stat-label">NO Price</span>
            <span className="stat-value" style={{ color: "var(--red)" }}>
              {(noPrice * 100).toFixed(1)}¢
            </span>
          </div>
        </div>
      </div>

      {/* Market History */}
      {marketHistory.length > 0 && (
        <div className="glass-card" style={{ padding: "1rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.75rem" }}>
            <Clock className="w-4 h-4" style={{ color: coinColor }} />
            <span style={{ fontWeight: 600 }}>Recent Settlements</span>
          </div>
          <div style={{ maxHeight: 150, overflowY: "auto" }}>
            {marketHistory.slice(0, 5).map((m, i) => (
              <div key={i} style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "0.5rem 0",
                borderBottom: i < marketHistory.length - 1 ? "1px solid var(--border)" : undefined
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                  <span className={`badge ${m.result === "UP" ? "badge-green" : "badge-red"}`}>
                    {m.result === "UP" ? "YES" : "NO"}
                  </span>
                  <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                    {(m.startPrice * 100).toFixed(0)}¢ → {(m.endPrice * 100).toFixed(0)}¢
                  </span>
                </div>
                <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                  {new Date(m.endTime).toLocaleTimeString()}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

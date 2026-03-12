import { TrendingUp, TrendingDown, Clock, Volume2, RefreshCw } from "lucide-react";
import type { MarketData } from "../hooks/useTradingData";

interface MarketCardProps {
  marketData: MarketData | null;
  yesPrice: number;
  noPrice: number;
  yesPriceDirection: "up" | "down" | null;
  noPriceDirection: "up" | "down" | null;
  coinColor: string;
  selectedAsset: string;
  selectedTimeframe: string;
}

function formatCountdown(ms: number): string {
  if (ms <= 0) return "Expired";
  const minutes = Math.floor(ms / 60_000);
  const seconds = Math.floor((ms % 60_000) / 1_000);
  if (minutes > 0) return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  return `0:${seconds.toString().padStart(2, "0")}`;
}

export function MarketCard({
  marketData,
  yesPrice,
  noPrice,
  yesPriceDirection,
  noPriceDirection,
  coinColor,
  selectedAsset,
  selectedTimeframe,
}: MarketCardProps) {
  const timeRemaining = marketData?.timeRemaining || 0;
  const market = marketData?.market;
  
  const isUrgent = timeRemaining < 60000;
  const isWarning = timeRemaining < 300000;

  return (
    <div className="glass-card" style={{ padding: "1.25rem" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1rem" }}>
        <div>
          <h2 style={{ fontSize: "1.125rem", fontWeight: 700, marginBottom: "0.25rem" }}>
            <span style={{ color: coinColor }}>{selectedAsset}</span>
            <span style={{ color: "var(--text-secondary)", fontWeight: 400, marginLeft: "0.5rem" }}>Up/Down</span>
          </h2>
          <p style={{ fontSize: "0.8rem", color: "var(--text-muted)", maxWidth: 250, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {market?.question || `Will ${selectedAsset} go up or down?`}
          </p>
        </div>
        <div style={{
          display: "flex",
          alignItems: "center",
          gap: "0.375rem",
          padding: "0.375rem 0.625rem",
          borderRadius: 6,
          background: isUrgent ? "rgba(239, 68, 68, 0.15)" : isWarning ? "rgba(251, 191, 36, 0.15)" : "var(--glass-bg)",
          color: isUrgent ? "var(--red)" : isWarning ? "var(--orange)" : "var(--text-muted)",
          fontSize: "0.8rem",
          fontWeight: 500,
        }}>
          <Clock className="w-3.5 h-3.5" />
          <span style={{ fontFamily: "monospace", fontSize: "0.9rem" }}>{formatCountdown(timeRemaining)}</span>
        </div>
      </div>

      {/* Price Display */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem", marginBottom: "1rem" }}>
        {/* UP / YES */}
        <div
          style={{
            padding: "1rem",
            borderRadius: 10,
            background: "rgba(34, 197, 94, 0.08)",
            border: "1px solid rgba(34, 197, 94, 0.2)",
            transition: "all 0.3s",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "0.375rem", marginBottom: "0.5rem" }}>
            <TrendingUp className="w-4 h-4" style={{ color: "var(--green)" }} />
            <span style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--green)", letterSpacing: "0.05em" }}>UP</span>
          </div>
          <div
            className={yesPriceDirection === "up" ? "price-flash-up" : yesPriceDirection === "down" ? "price-flash-down" : ""}
            style={{
              fontSize: "1.75rem",
              fontWeight: 700,
              fontFamily: "monospace",
              color: "var(--green)",
              transition: "all 0.3s",
            }}
          >
            {(yesPrice * 100).toFixed(1)}¢
          </div>
          <div style={{ fontSize: "0.7rem", color: "var(--text-muted)", marginTop: "0.25rem" }}>
            ROI: {((1/yesPrice - 1) * 100).toFixed(0)}%
          </div>
        </div>

        {/* DOWN / NO */}
        <div
          style={{
            padding: "1rem",
            borderRadius: 10,
            background: "rgba(239, 68, 68, 0.08)",
            border: "1px solid rgba(239, 68, 68, 0.2)",
            transition: "all 0.3s",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "0.375rem", marginBottom: "0.5rem" }}>
            <TrendingDown className="w-4 h-4" style={{ color: "var(--red)" }} />
            <span style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--red)", letterSpacing: "0.05em" }}>DOWN</span>
          </div>
          <div
            className={noPriceDirection === "up" ? "price-flash-up" : noPriceDirection === "down" ? "price-flash-down" : ""}
            style={{
              fontSize: "1.75rem",
              fontWeight: 700,
              fontFamily: "monospace",
              color: "var(--red)",
              transition: "all 0.3s",
            }}
          >
            {(noPrice * 100).toFixed(1)}¢
          </div>
          <div style={{ fontSize: "0.7rem", color: "var(--text-muted)", marginTop: "0.25rem" }}>
            ROI: {((1/noPrice - 1) * 100).toFixed(0)}%
          </div>
        </div>
      </div>

      {/* Probability Bar */}
      <div style={{ marginBottom: "1rem" }}>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.7rem", marginBottom: "0.375rem" }}>
          <span style={{ color: "var(--green)", fontWeight: 600 }}>{(yesPrice * 100).toFixed(1)}%</span>
          <span style={{ color: "var(--red)", fontWeight: 600 }}>{(noPrice * 100).toFixed(1)}%</span>
        </div>
        <div style={{ 
          height: 6, 
          borderRadius: 3, 
          background: "var(--red)", 
          overflow: "hidden",
          display: "flex",
        }}>
          <div style={{ 
            width: `${yesPrice * 100}%`, 
            height: "100%", 
            background: "var(--green)",
            transition: "width 0.3s",
          }} />
        </div>
      </div>

      {/* Market Info */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem", fontSize: "0.75rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.375rem", color: "var(--text-muted)" }}>
          <Volume2 className="w-3.5 h-3.5" />
          <span>Vol:</span>
          <span style={{ fontFamily: "monospace", color: "var(--text)" }}>
            ${((market?.volumeNum || market?.liquidity || 0) / 1000).toFixed(1)}K
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "0.375rem", color: "var(--text-muted)" }}>
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Status:</span>
          <span style={{ color: "var(--green)", fontWeight: 500 }}>Live</span>
        </div>
      </div>
    </div>
  );
}

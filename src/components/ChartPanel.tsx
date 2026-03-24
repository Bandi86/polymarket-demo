'use client'

import { TrendingUp } from "lucide-react";
import { TradingViewWidget } from "@/components/trading-view-widget";
import type { MarketData } from "@/hooks/useTradingData";

interface ChartPanelProps {
  marketData: MarketData | null;
  selectedCoin: string;
  selectedTimeframe: string;
  coinColor: string;
  tvSymbol: string;
  yesPrice: number;
  noPrice: number;
}

export function ChartPanel({
  selectedCoin,
  selectedTimeframe,
  coinColor,
  tvSymbol,
}: ChartPanelProps) {
  const formatTimeframe = (tf: string): string => {
    switch (tf) {
      case "D": return "1d";
      case "60": return "1h";
      case "240": return "4h";
      default: return `${tf}m`;
    }
  };

  return (
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
        height={500}
      />
    </div>
  );
}

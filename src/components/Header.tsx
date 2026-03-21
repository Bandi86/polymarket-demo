import { Zap, RefreshCw, Bot } from "lucide-react";
import { PriceTicker } from "./ui/PriceTicker";
import { ThemeToggle } from "./ui/ThemeToggle";

interface HeaderProps {
  isBotRunning: boolean;
  apiLatency: number;
  coinColor: string;
  onRefresh: () => void;
  activeBots?: number;
  totalBots?: number;
}

export function Header({
  isBotRunning,
  apiLatency,
  coinColor,
  onRefresh,
  activeBots = 0,
  totalBots = 10
}: HeaderProps) {
  return (
    <nav style={{
      background: "rgba(11, 11, 15, 0.8)",
      backdropFilter: "blur(20px)",
      borderBottom: "1px solid var(--border)",
      padding: "0.75rem 1.5rem",
      position: "sticky",
      top: 0,
      zIndex: 50
    }}>
      <div style={{ maxWidth: 1600, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
          <div style={{ fontSize: "1.25rem", fontWeight: 700, display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <Zap style={{ color: coinColor }} className="w-5 h-5" />
            <span>Poly</span><span style={{ color: "var(--primary)" }}>Trade</span>
          </div>
          {/* Price Ticker */}
          <PriceTicker className="hidden md:flex" />
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
          {/* Bot indicator */}
          <div
            className="status-pill"
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.375rem",
            }}
          >
            <Bot className="w-3 h-3" style={{ color: isBotRunning ? "#22c55e" : "var(--text-muted)" }} />
            <span style={{ fontFamily: "ui-monospace, monospace", fontSize: "0.75rem" }}>
              {activeBots}/{totalBots}
            </span>
          </div>

          <div className="status-pill">
            <div style={{
              width: 6, height: 6, borderRadius: "50%",
              background: isBotRunning ? "var(--green)" : "var(--orange)",
              animation: isBotRunning ? "pulse 2s infinite" : undefined
            }} />
            <span>{isBotRunning ? "Trading Live" : "Standby"}</span>
          </div>
          <div className="status-pill">
            <span style={{ color: "var(--text-muted)" }}>Latency:</span>
            <span style={{ fontFamily: "monospace", marginLeft: 4 }}>{apiLatency}ms</span>
          </div>
          <button onClick={onRefresh} className="quick-btn">
            <RefreshCw className="w-3 h-3" />
          </button>
          <ThemeToggle />
        </div>
      </div>
    </nav>
  );
}
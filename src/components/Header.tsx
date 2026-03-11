import { Zap, RefreshCw, BarChart3, ArrowLeft } from "lucide-react";

interface HeaderProps {
  isBotRunning: boolean;
  apiLatency: number;
  coinColor: string;
  onRefresh: () => void;
  showBackButton?: boolean;
  onBack?: () => void;
  onOpenDashboard?: () => void;
}

export function Header({
  isBotRunning,
  apiLatency,
  coinColor,
  onRefresh,
  showBackButton,
  onBack,
  onOpenDashboard
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
        <div style={{ fontSize: "1.25rem", fontWeight: 700, display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <Zap style={{ color: coinColor }} className="w-5 h-5" />
          <span>Poly</span><span style={{ color: "var(--primary)" }}>Trade</span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
          {/* Back button - show on dashboard page */}
          {showBackButton && onBack && (
            <button
              onClick={onBack}
              className="quick-btn"
              style={{ display: "flex", alignItems: "center", gap: "0.25rem" }}
            >
              <ArrowLeft className="w-3 h-3" />
              <span style={{ fontSize: "0.75rem" }}>Back</span>
            </button>
          )}

          {/* Dashboard button - show on trading page */}
          {onOpenDashboard && !showBackButton && (
            <button
              onClick={onOpenDashboard}
              className="quick-btn"
              title="Bot Dashboard"
              style={{ display: "flex", alignItems: "center", gap: "0.25rem" }}
            >
              <BarChart3 className="w-3 h-3" />
              <span style={{ fontSize: "0.75rem" }}>Bots</span>
            </button>
          )}

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
        </div>
      </div>
    </nav>
  );
}
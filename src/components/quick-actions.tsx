import { Zap, Play, Square, RotateCcw } from "lucide-react";

interface QuickActionsProps {
  isBotRunning: boolean;
  onToggleBot: () => void;
  onReset: () => void;
  coinColor: string;
}

export function QuickActions({ isBotRunning, onToggleBot, onReset, coinColor }: QuickActionsProps) {
  return (
    <div className="glass-card" style={{ padding: "1rem" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "1rem" }}>
        <Zap className="w-4 h-4" style={{ color: coinColor }} />
        <span style={{ fontWeight: 600, fontSize: "0.875rem" }}>Quick Actions</span>
      </div>
      
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem" }}>
        <button
          onClick={onToggleBot}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "0.375rem",
            padding: "0.625rem",
            borderRadius: 8,
            border: "none",
            background: isBotRunning ? "rgba(239, 68, 68, 0.15)" : "rgba(34, 197, 94, 0.15)",
            color: isBotRunning ? "var(--red)" : "var(--green)",
            fontWeight: 600,
            fontSize: "0.8rem",
            cursor: "pointer",
            transition: "all 0.2s",
          }}
        >
          {isBotRunning ? (
            <>
              <Square className="w-3.5 h-3.5" />
              Stop Bots
            </>
          ) : (
            <>
              <Play className="w-3.5 h-3.5" />
              Start Bots
            </>
          )}
        </button>
        
        <button
          onClick={onReset}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "0.375rem",
            padding: "0.625rem",
            borderRadius: 8,
            border: "1px solid var(--border)",
            background: "transparent",
            color: "var(--text-muted)",
            fontWeight: 500,
            fontSize: "0.8rem",
            cursor: "pointer",
            transition: "all 0.2s",
          }}
        >
          <RotateCcw className="w-3.5 h-3.5" />
          Reset All
        </button>
      </div>
    </div>
  );
}

import { useState } from "react";
import { Bot, Play, Square, Clock, TrendingUp, TrendingDown, Info, Activity } from "lucide-react";
import { formatCurrency, formatPercentage } from "../lib/utils";
import type { BotData } from "../hooks/useTradingData";
import type { BotLog } from "../types";

interface BotPanelProps {
  bots: BotData[];
  isBotRunning: boolean;
  botLogs: BotLog[];
  coinColor: string;
  onToggleBot: () => Promise<void>;
}

function formatDuration(ms: number): string {
  if (ms < 60000) return `${Math.floor(ms / 1000)}s`;
  if (ms < 3600000) return `${Math.floor(ms / 60000)}m`;
  return `${Math.floor(ms / 3600000)}h ${Math.floor((ms % 3600000) / 60000)}m`;
}

function getLogIcon(type: BotLog["type"]) {
  switch (type) {
    case "START": return <Play className="w-3 h-3" style={{ color: "var(--green)" }} />;
    case "STOP": return <Square className="w-3 h-3" style={{ color: "var(--red)" }} />;
    case "TRADE": return <TrendingUp className="w-3 h-3" style={{ color: "var(--primary)" }} />;
    case "DECISION": return <Info className="w-3 h-3" style={{ color: "var(--orange)" }} />;
    case "ERROR": return <Activity className="w-3 h-3" style={{ color: "var(--red)" }} />;
    default: return <Info className="w-3 h-3" />;
  }
}

function getLogColor(type: BotLog["type"]): string {
  switch (type) {
    case "START": return "var(--green)";
    case "STOP": return "var(--red)";
    case "TRADE": return "var(--primary)";
    case "DECISION": return "var(--orange)";
    case "ERROR": return "var(--red)";
    default: return "var(--text-muted)";
  }
}

export function BotPanel({ bots, isBotRunning, botLogs, coinColor, onToggleBot }: BotPanelProps) {
  const [showLogs, setShowLogs] = useState(false);
  const [isToggling, setIsToggling] = useState(false);

  const totalBotTrades = bots.reduce((s, b) => s + b.stats.trades, 0);
  const totalBotPnl = bots.reduce((s, b) => s + b.stats.pnl, 0);
  const activeBotCount = bots.filter(b => b.enabled).length;

  const totalRuntime = bots.filter(b => b.enabled).reduce((sum, b) => {
    // Approximate runtime based on session or assume recent start
    return sum + (Date.now() - (b.runTime || Date.now()));
  }, 0);

  const handleToggle = async () => {
    if (isToggling) return;
    setIsToggling(true);
    try {
      await onToggleBot();
    } finally {
      setIsToggling(false);
    }
  };
  return (
    <div className="glass-card" style={{ padding: "1.25rem" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "1rem" }}>
        <Bot className="w-5 h-5" style={{ color: coinColor }} />
        <span style={{ fontWeight: 600, fontSize: "1.125rem" }}>Trading Bot</span>
        {isBotRunning && <span className="badge badge-green">Active</span>}
      </div>

      <button
        onClick={handleToggle}
        disabled={isToggling}
        style={{
          width: "100%",
          padding: "1.25rem",
          borderRadius: 12,
          fontSize: "1.125rem",
          fontWeight: 600,
          border: "none",
          cursor: isToggling ? "not-allowed" : "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: "0.75rem",
          color: "white",
          background: isBotRunning
            ? "linear-gradient(135deg, var(--red), #dc2626)"
            : "linear-gradient(135deg, var(--green), #16a34a)",
          boxShadow: isBotRunning
            ? "0 4px 20px rgba(239, 68, 68, 0.3)"
            : "0 4px 20px rgba(34, 197, 94, 0.3)",
          transition: "all 0.3s",
          position: "relative",
          overflow: "hidden",
          opacity: isToggling ? 0.7 : 1
        }}
      >
        {isToggling ? (
          <span>Processing...</span>
        ) : isBotRunning ? (
          <>
            <Square className="w-5 h-5" fill="currentColor" />
            Stop Trading Bot
          </>
        ) : (
          <>
            <Play className="w-5 h-5" fill="currentColor" />
            Start Trading Bot
          </>
        )}
      </button>

      {isBotRunning && (
        <div style={{ marginTop: "1rem", animation: "fadeIn 0.3s" }}>
          <div className="stats-grid">
            <div className="stat-item">
              <span className="stat-label">Bot Trades</span>
              <span className="stat-value">{totalBotTrades}</span>
            </div>
            <div className="stat-item">
              <span className="stat-label">Bot P&L</span>
              <span className="stat-value" style={{ color: totalBotPnl >= 0 ? "var(--green)" : "var(--red)" }}>
                {formatCurrency(totalBotPnl)}
              </span>
            </div>
            <div className="stat-item">
              <span className="stat-label">Active Bots</span>
              <span className="stat-value">{activeBotCount}/{bots.length}</span>
            </div>
            <div className="stat-item">
              <span className="stat-label">Win Rate</span>
              <span className="stat-value">
                {formatPercentage(bots.find(b => b.enabled)?.stats.winRate || 0)}
              </span>
            </div>
          </div>

          {/* Runtime Info */}
          {runningBots.length > 0 && (
            <div style={{
              marginTop: "1rem",
              padding: "0.75rem",
              background: "var(--glass-bg)",
              borderRadius: 8,
              fontSize: "0.875rem"
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.5rem" }}>
                <Clock className="w-4 h-4" style={{ color: "var(--text-muted)" }} />
                <span style={{ color: "var(--text-secondary)" }}>Session Info</span>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem" }}>
                <div>
                  <span style={{ color: "var(--text-muted)", fontSize: "0.75rem" }}>Running For</span>
                  <p style={{ fontFamily: "monospace", fontWeight: 600 }}>
                    {runningBots[0]?.portfolio?.totalTrades > 0
                      ? formatDuration(Date.now() - (runningBots[0]?.runTime || Date.now()))
                      : "Just started"}
                  </p>
                </div>
                <div>
                  <span style={{ color: "var(--text-muted)", fontSize: "0.75rem" }}>Strategies</span>
                  <p style={{ fontWeight: 600 }}>
                    {runningBots.map(b => b.strategy).slice(0, 3).join(", ")}
                    {runningBots.length > 3 && "..."}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Bot Status List */}
          <div style={{ marginTop: "1rem" }}>
            <div style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: "0.5rem"
            }}>
              <span style={{ fontSize: "0.875rem", color: "var(--text-secondary)" }}>Active Bot Details</span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
              {runningBots.slice(0, 3).map(bot => (
                <div
                  key={bot.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "0.5rem 0.75rem",
                    background: "var(--glass-bg)",
                    borderRadius: 6,
                    fontSize: "0.875rem"
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                    <div style={{
                      width: 6,
                      height: 6,
                      borderRadius: "50%",
                      background: "var(--green)",
                      animation: "pulse 2s infinite"
                    }} />
                    <span>{bot.name}</span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
                    <span style={{ color: "var(--text-muted)", fontSize: "0.75rem" }}>
                      {bot.stats.trades} trades
                    </span>
                    <span style={{
                      fontFamily: "monospace",
                      color: bot.stats.pnl >= 0 ? "var(--green)" : "var(--red)"
                    }}>
                      {formatCurrency(bot.stats.pnl)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Bot Logs */}
      <div style={{ marginTop: "1rem" }}>
        <button
          onClick={() => setShowLogs(!showLogs)}
          style={{
            width: "100%",
            padding: "0.5rem",
            background: "var(--glass-bg)",
            border: "none",
            borderRadius: 6,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            fontSize: "0.875rem",
            color: "var(--text-secondary)"
          }}
        >
          <span>Bot Activity Log ({botLogs.length})</span>
          <span style={{ transform: showLogs ? "rotate(180deg)" : "none", transition: "transform 0.2s" }}>▼</span>
        </button>

        {showLogs && (
          <div style={{
            marginTop: "0.5rem",
            maxHeight: 200,
            overflowY: "auto",
            background: "var(--glass-bg)",
            borderRadius: 6,
            padding: "0.5rem"
          }}>
            {botLogs.length === 0 ? (
              <div style={{ textAlign: "center", padding: "1rem", color: "var(--text-muted)", fontSize: "0.875rem" }}>
                No bot activity yet
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                {botLogs.slice(0, 20).map((log) => (
                  <div
                    key={log.id}
                    style={{
                      display: "flex",
                      alignItems: "flex-start",
                      gap: "0.5rem",
                      padding: "0.5rem",
                      background: "rgba(0,0,0,0.2)",
                      borderRadius: 4,
                      fontSize: "0.75rem"
                    }}
                  >
                    {getLogIcon(log.type)}
                    <div style={{ flex: 1 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.25rem" }}>
                        <span style={{ color: getLogColor(log.type), fontWeight: 600 }}>
                          {log.type}
                        </span>
                        <span style={{ color: "var(--text-muted)" }}>
                          {log.botName}
                        </span>
                        <span style={{ color: "var(--text-muted)", marginLeft: "auto" }}>
                          {new Date(log.timestamp).toLocaleTimeString()}
                        </span>
                      </div>
                      <p style={{ color: "var(--text-secondary)", margin: 0 }}>
                        {log.message}
                      </p>
                      {log.details && Object.keys(log.details).length > 0 && (
                        <pre style={{
                          margin: "0.25rem 0 0 0",
                          padding: "0.25rem",
                          background: "rgba(0,0,0,0.3)",
                          borderRadius: 4,
                          fontSize: "0.7rem",
                          overflow: "auto",
                          maxHeight: 60
                        }}>
                          {JSON.stringify(log.details, null, 2)}
                        </pre>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

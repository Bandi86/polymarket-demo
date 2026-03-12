import { useState, useEffect } from "react";
import { Bot, Play, Square, Clock, TrendingUp, TrendingDown, Info, Activity, Zap, Target, DollarSign, BarChart3, RefreshCw } from "lucide-react";
import { formatCurrency, formatPercentage } from "../lib/utils";
import type { BotData } from "../hooks/useTradingData";
import type { BotLog } from "../types";

interface Position {
  id: string;
  marketId: string;
  outcome: "YES" | "NO";
  amount: number;
  odds: number;
  stake: number;
  fee: number;
  timestamp: number;
  status: string;
  pnl: number | null;
  botId?: string;
  unrealizedPnl?: number;
}

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
    case "START": return <Play className="w-3 h-3" style={{ color: "#22c55e" }} />;
    case "STOP": return <Square className="w-3 h-3" style={{ color: "#ef4444" }} />;
    case "TRADE": return <TrendingUp className="w-3 h-3" style={{ color: "#3b82f6" }} />;
    case "DECISION": return <Info className="w-3 h-3" style={{ color: "#f59e0b" }} />;
    case "ERROR": return <Activity className="w-3 h-3" style={{ color: "#ef4444" }} />;
    default: return <Info className="w-3 h-3" />;
  }
}

function getLogColor(type: BotLog["type"]): string {
  switch (type) {
    case "START": return "#22c55e";
    case "STOP": return "#ef4444";
    case "TRADE": return "#3b82f6";
    case "DECISION": return "#f59e0b";
    case "ERROR": return "#ef4444";
    default: return "#6b7280";
  }
}

export function BotPanel({ bots, isBotRunning, botLogs, coinColor, onToggleBot }: BotPanelProps) {
  const [showLogs, setShowLogs] = useState(true);
  const [isToggling, setIsToggling] = useState(false);
  const [positions, setPositions] = useState<Position[]>([]);
  const [yesPrice, setYesPrice] = useState(0.5);

  // Fetch positions and current price
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [positionsRes, marketRes] = await Promise.all([
          fetch("/api/positions"),
          fetch("/api/market")
        ]);
        const positionsData = await positionsRes.json();
        const marketData = await marketRes.json();
        setPositions(positionsData.open || []);
        setYesPrice(parseFloat(marketData.market?.outcomePrices?.yes || "0.5"));
      } catch (err) {
        console.error("Failed to fetch positions:", err);
      }
    };

    fetchData();
    const interval = setInterval(fetchData, 2000);
    return () => clearInterval(interval);
  }, []);

  const totalBotTrades = bots.reduce((s, b) => s + b.stats.trades, 0);
  const totalBotPnl = bots.reduce((s, b) => s + b.stats.pnl, 0);
  const activeBotCount = bots.filter(b => b.enabled).length;
  const runningBots = bots.filter(b => b.enabled);

  // Calculate total balance across all bots
  const totalBotBalance = bots.reduce((s, b) => s + (b.portfolio?.balance || 0), 0);
  const totalBotPositions = positions.filter(p => p.botId).length;

  // Calculate unrealized PnL for open positions
  const totalUnrealizedPnl = positions.reduce((sum, pos) => {
    if (pos.outcome === "YES") {
      return sum + (pos.amount * yesPrice - pos.stake);
    } else {
      return sum + (pos.amount * (1 - yesPrice) - pos.stake);
    }
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

  // Group positions by bot
  const positionsByBot = positions.reduce((acc, pos) => {
    const botId = pos.botId || "manual";
    if (!acc[botId]) acc[botId] = [];
    acc[botId].push(pos);
    return acc;
  }, {} as Record<string, Position[]>);

  return (
    <div className="glass-card" style={{ padding: "1.25rem" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <Bot className="w-5 h-5" style={{ color: coinColor }} />
          <span style={{ fontWeight: 600, fontSize: "1.125rem" }}>Trading Bots</span>
          {isBotRunning && (
            <span style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "0.25rem",
              padding: "0.125rem 0.5rem",
              borderRadius: 9999,
              fontSize: "0.75rem",
              fontWeight: 600,
              background: "rgba(34, 197, 94, 0.2)",
              color: "#22c55e"
            }}>
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#22c55e", animation: "pulse 2s infinite" }} />
              Active
            </span>
          )}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.75rem", color: "var(--text-muted)" }}>
          <Zap className="w-3 h-3" />
          <span>{activeBotCount}/{bots.length} bots</span>
        </div>
      </div>

      {/* Main Stats Grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "0.5rem", marginBottom: "1rem" }}>
        <div style={{ padding: "0.5rem", background: "var(--glass-bg)", borderRadius: 8, textAlign: "center" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "0.25rem", marginBottom: "0.25rem" }}>
            <Target className="w-3 h-3" style={{ color: "var(--primary)" }} />
          </div>
          <div style={{ fontSize: "1.125rem", fontWeight: 700, fontFamily: "ui-monospace, monospace" }}>{totalBotTrades}</div>
          <div style={{ fontSize: "0.625rem", color: "var(--text-muted)" }}>Trades</div>
        </div>
        <div style={{ padding: "0.5rem", background: "var(--glass-bg)", borderRadius: 8, textAlign: "center" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "0.25rem", marginBottom: "0.25rem" }}>
            <DollarSign className="w-3 h-3" style={{ color: "#22c55e" }} />
          </div>
          <div style={{ 
            fontSize: "1.125rem", 
            fontWeight: 700, 
            fontFamily: "ui-monospace, monospace",
            color: totalBotPnl >= 0 ? "#22c55e" : "#ef4444"
          }}>
            {totalBotPnl >= 0 ? "+" : ""}{formatCurrency(totalBotPnl)}
          </div>
          <div style={{ fontSize: "0.625rem", color: "var(--text-muted)" }}>Realized P&L</div>
        </div>
        <div style={{ padding: "0.5rem", background: "var(--glass-bg)", borderRadius: 8, textAlign: "center" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "0.25rem", marginBottom: "0.25rem" }}>
            <BarChart3 className="w-3 h-3" style={{ color: "var(--primary)" }} />
          </div>
          <div style={{ 
            fontSize: "1.125rem", 
            fontWeight: 700, 
            fontFamily: "ui-monospace, monospace",
            color: totalUnrealizedPnl >= 0 ? "#22c55e" : "#ef4444"
          }}>
            {totalUnrealizedPnl >= 0 ? "+" : ""}{formatCurrency(totalUnrealizedPnl)}
          </div>
          <div style={{ fontSize: "0.625rem", color: "var(--text-muted)" }}>Unrealized</div>
        </div>
        <div style={{ padding: "0.5rem", background: "var(--glass-bg)", borderRadius: 8, textAlign: "center" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "0.25rem", marginBottom: "0.25rem" }}>
            <Activity className="w-3 h-3" style={{ color: "#f59e0b" }} />
          </div>
          <div style={{ fontSize: "1.125rem", fontWeight: 700, fontFamily: "ui-monospace, monospace" }}>{totalBotPositions}</div>
          <div style={{ fontSize: "0.625rem", color: "var(--text-muted)" }}>Positions</div>
        </div>
      </div>

      {/* Toggle Button */}
      <button
        onClick={handleToggle}
        disabled={isToggling}
        style={{
          width: "100%",
          padding: "1rem",
          borderRadius: 12,
          fontSize: "1rem",
          fontWeight: 600,
          border: "none",
          cursor: isToggling ? "not-allowed" : "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: "0.75rem",
          color: "white",
          background: isBotRunning
            ? "linear-gradient(135deg, #ef4444, #dc2626)"
            : "linear-gradient(135deg, #22c55e, #16a34a)",
          boxShadow: isBotRunning
            ? "0 4px 20px rgba(239, 68, 68, 0.3)"
            : "0 4px 20px rgba(34, 197, 94, 0.3)",
          transition: "all 0.3s",
          opacity: isToggling ? 0.7 : 1
        }}
      >
        {isToggling ? (
          <span>Processing...</span>
        ) : isBotRunning ? (
          <>
            <Square className="w-4 h-4" fill="currentColor" />
            Stop All Bots
          </>
        ) : (
          <>
            <Play className="w-4 h-4" fill="currentColor" />
            Start All Bots
          </>
        )}
      </button>

      {/* Active Bots List */}
      {runningBots.length > 0 && (
        <div style={{ marginTop: "1rem" }}>
          <div style={{ 
            display: "flex", 
            alignItems: "center", 
            justifyContent: "space-between",
            marginBottom: "0.5rem",
            fontSize: "0.875rem",
            fontWeight: 600,
            color: "var(--text-secondary)"
          }}>
            <span>Active Strategies</span>
            <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
              Total Balance: {formatCurrency(totalBotBalance)}
            </span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", maxHeight: 200, overflowY: "auto" }}>
            {runningBots.map(bot => {
              const botPositions = positionsByBot[bot.id] || [];
              const botUnrealizedPnl = botPositions.reduce((sum, pos) => {
                if (pos.outcome === "YES") {
                  return sum + (pos.amount * yesPrice - pos.stake);
                } else {
                  return sum + (pos.amount * (1 - yesPrice) - pos.stake);
                }
              }, 0);

              return (
                <div
                  key={bot.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "0.5rem 0.75rem",
                    background: "var(--glass-bg)",
                    borderRadius: 8,
                    fontSize: "0.75rem",
                    border: "1px solid var(--border)"
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                    <div style={{
                      width: 8,
                      height: 8,
                      borderRadius: "50%",
                      background: "#22c55e",
                      animation: "pulse 2s infinite"
                    }} />
                    <div>
                      <div style={{ fontWeight: 600 }}>{bot.name}</div>
                      <div style={{ fontSize: "0.625rem", color: "var(--text-muted)" }}>
                        {bot.strategy} • {bot.stats.trades} trades
                      </div>
                    </div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
                    {botPositions.length > 0 && (
                      <span style={{ 
                        padding: "0.125rem 0.375rem",
                        background: "rgba(59, 130, 246, 0.2)",
                        borderRadius: 4,
                        color: "#3b82f6",
                        fontSize: "0.625rem"
                      }}>
                        {botPositions.length} pos
                      </span>
                    )}
                    <div style={{ textAlign: "right" }}>
                      <div style={{
                        fontFamily: "ui-monospace, monospace",
                        fontWeight: 600,
                        color: bot.stats.pnl >= 0 ? "#22c55e" : "#ef4444"
                      }}>
                        {bot.stats.pnl >= 0 ? "+" : ""}{formatCurrency(bot.stats.pnl)}
                      </div>
                      {botUnrealizedPnl !== 0 && (
                        <div style={{
                          fontSize: "0.625rem",
                          color: botUnrealizedPnl >= 0 ? "#22c55e" : "#ef4444"
                        }}>
                          {botUnrealizedPnl >= 0 ? "+" : ""}{formatCurrency(botUnrealizedPnl)} unrealized
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Open Positions */}
      {totalBotPositions > 0 && (
        <div style={{ marginTop: "1rem" }}>
          <div style={{ 
            display: "flex", 
            alignItems: "center", 
            justifyContent: "space-between",
            marginBottom: "0.5rem",
            fontSize: "0.875rem",
            fontWeight: 600,
            color: "var(--text-secondary)"
          }}>
            <span>Open Positions</span>
            <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
              YES: {yesPrice.toFixed(3)} | NO: {(1 - yesPrice).toFixed(3)}
            </span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem", maxHeight: 150, overflowY: "auto" }}>
            {positions.slice(0, 5).map(pos => {
              const currentPrice = pos.outcome === "YES" ? yesPrice : (1 - yesPrice);
              const pnl = pos.amount * currentPrice - pos.stake;
              const pnlPercent = (pnl / pos.stake) * 100;
              const bot = bots.find(b => b.id === pos.botId);

              return (
                <div
                  key={pos.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "0.375rem 0.5rem",
                    background: "rgba(0,0,0,0.2)",
                    borderRadius: 6,
                    fontSize: "0.7rem"
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                    <span style={{
                      padding: "0.125rem 0.25rem",
                      borderRadius: 4,
                      fontSize: "0.625rem",
                      fontWeight: 600,
                      background: pos.outcome === "YES" ? "rgba(34, 197, 94, 0.2)" : "rgba(239, 68, 68, 0.2)",
                      color: pos.outcome === "YES" ? "#22c55e" : "#ef4444"
                    }}>
                      {pos.outcome === "YES" ? "UP" : "DOWN"}
                    </span>
                    <span style={{ color: "var(--text-muted)" }}>{bot?.name || "Manual"}</span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                    <span style={{ fontFamily: "ui-monospace, monospace" }}>
                      {formatCurrency(pos.stake)}
                    </span>
                    <span style={{
                      fontFamily: "ui-monospace, monospace",
                      fontWeight: 600,
                      color: pnl >= 0 ? "#22c55e" : "#ef4444"
                    }}>
                      {pnl >= 0 ? "+" : ""}{formatCurrency(pnl)} ({pnlPercent >= 0 ? "+" : ""}{pnlPercent.toFixed(1)}%)
                    </span>
                  </div>
                </div>
              );
            })}
            {positions.length > 5 && (
              <div style={{ textAlign: "center", padding: "0.25rem", color: "var(--text-muted)", fontSize: "0.625rem" }}>
                +{positions.length - 5} more positions
              </div>
            )}
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
            border: "1px solid var(--border)",
            borderRadius: 8,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            fontSize: "0.875rem",
            color: "var(--text-secondary)"
          }}
        >
          <span style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <Activity className="w-4 h-4" />
            Activity Log
            {botLogs.length > 0 && (
              <span style={{
                padding: "0.125rem 0.375rem",
                background: "var(--primary)",
                color: "white",
                borderRadius: 9999,
                fontSize: "0.625rem"
              }}>
                {botLogs.length}
              </span>
            )}
          </span>
          <span style={{ transform: showLogs ? "rotate(180deg)" : "none", transition: "transform 0.2s" }}>▼</span>
        </button>

        {showLogs && (
          <div style={{
            marginTop: "0.5rem",
            maxHeight: 250,
            overflowY: "auto",
            background: "var(--glass-bg)",
            borderRadius: 8,
            padding: "0.5rem"
          }}>
            {botLogs.length === 0 ? (
              <div style={{ textAlign: "center", padding: "1.5rem", color: "var(--text-muted)", fontSize: "0.875rem" }}>
                <Activity className="w-6 h-6" style={{ margin: "0 auto 0.5rem", opacity: 0.5 }} />
                No bot activity yet.<br />
                <span style={{ fontSize: "0.75rem" }}>Start the bots to see live trading activity.</span>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "0.375rem" }}>
                {botLogs.slice(0, 30).map((log) => (
                  <div
                    key={log.id}
                    style={{
                      display: "flex",
                      alignItems: "flex-start",
                      gap: "0.5rem",
                      padding: "0.375rem 0.5rem",
                      background: "rgba(0,0,0,0.3)",
                      borderRadius: 6,
                      fontSize: "0.7rem"
                    }}
                  >
                    {getLogIcon(log.type)}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "0.375rem", marginBottom: "0.125rem" }}>
                        <span style={{ color: getLogColor(log.type), fontWeight: 600, fontSize: "0.625rem" }}>
                          {log.type}
                        </span>
                        <span style={{ color: "var(--text-muted)", fontSize: "0.625rem" }}>
                          {log.botName}
                        </span>
                        <span style={{ color: "var(--text-muted)", marginLeft: "auto", fontSize: "0.625rem" }}>
                          {new Date(log.timestamp).toLocaleTimeString()}
                        </span>
                      </div>
                      <p style={{ color: "var(--text-secondary)", margin: 0, fontSize: "0.7rem" }}>
                        {log.message}
                      </p>
                      {log.details && log.type === "TRADE" && (
                        <div style={{
                          display: "flex",
                          gap: "0.5rem",
                          marginTop: "0.25rem",
                          fontSize: "0.625rem",
                          color: "var(--text-muted)"
                        }}>
                          <span>Amount: {formatCurrency(typeof log.details.amount === 'number' ? log.details.amount : 0)}</span>
                          <span>Odds: {((typeof log.details.odds === 'number' ? log.details.odds : 0) * 100).toFixed(1)}%</span>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Dashboard Link */}
      <div style={{ marginTop: "1rem", textAlign: "center" }}>
        <button
          onClick={() => { window.location.hash = 'bots'; }}
          style={{
            fontSize: "0.75rem",
            color: "var(--primary)",
            background: "transparent",
            border: "none",
            cursor: "pointer",
            textDecoration: "underline"
          }}
        >
          View Full Bot Dashboard →
        </button>
      </div>
    </div>
  );
}
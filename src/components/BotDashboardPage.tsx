import { useState, useEffect, useCallback } from "react";
import { Activity, Play, Square, FlaskConical, Trophy, Settings } from "lucide-react";
import { LiveMonitorTab } from "./LiveMonitorTab";
import { SessionHistoryTab } from "./SessionHistoryTab";
import { StrategyLabTab } from "./StrategyLabTab";
import { CompetitionTab } from "./CompetitionTab";
import { RiskPanel } from "./RiskPanel";
import { AnalyticsTab } from "./AnalyticsTab";
import { TradingModeToggle } from "./TradingModeToggle";
import { SettingsPanel } from "./SettingsPanel";
import { PerformanceDashboard } from "./dashboard/PerformanceDashboard";
import { useTradingData } from "../hooks/useTradingData";
import { formatCurrency } from "../lib/utils";
import type { MarketData } from "../hooks/useTradingData";

type Tab = 'monitor' | 'backtest' | 'leaderboard' | 'config';

// Helper functions for market display
function formatTimeRemaining(ms: number): string {
  if (!ms || ms <= 0) return "0:00";
  const totalSeconds = Math.floor(ms / 1000);
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

function calculateMarketProgress(marketData: MarketData | null): number {
  if (!marketData?.market || !marketData.marketDuration) return 0;
  const elapsed = marketData.marketDuration - (marketData.timeRemaining || 0);
  return Math.min(100, Math.max(0, (elapsed / marketData.marketDuration) * 100));
}

export function BotDashboardPage() {
  const [activeTab, setActiveTab] = useState<Tab>('monitor');
  const {
    bots,
    botLogs,
    yesPrice,
    noPrice,
    loading,
    updateBotState,
    portfolio,
    fetchData,
    timeRemaining,
    marketData,
  } = useTradingData();

  const [positions, setPositions] = useState<Array<{
    id: string;
    botId?: string;
    outcome: "YES" | "NO";
    amount: number;
    stake: number;
  }>>([]);

  useEffect(() => {
    const fetchPositions = async () => {
      try {
        const res = await fetch("/api/positions");
        const data = await res.json();
        setPositions(data.open || []);
      } catch (err) {
        console.error("Failed to fetch positions:", err);
      }
    };

    fetchPositions();
    const interval = setInterval(fetchPositions, 3000);
    return () => clearInterval(interval);
  }, []);

  const activeBots = bots.filter(b => b.enabled);
  const totalPnl = bots.reduce((sum, b) => sum + (b.stats?.pnl || 0), 0);
  const totalTrades = bots.reduce((sum, b) => sum + (b.stats?.trades || 0), 0);
  const totalWinRate = bots.length > 0 
    ? bots.reduce((sum, b) => sum + (b.stats?.winRate || 0), 0) / bots.length 
    : 0;

  const handleRunAll = useCallback(async () => {
    await fetch("/api/bots/run-all", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ betSize: 1 })
    });
    await fetchData();
  }, [fetchData]);

  const handleStopAll = useCallback(async () => {
    await fetch("/api/bots/stop-all", { method: "POST" });
    await fetchData();
  }, [fetchData]);

  if (loading) {
    return (
      <div style={{ textAlign: "center", padding: "4rem", color: "var(--text-secondary)" }}>
        <div className="loading-spinner" style={{ margin: "0 auto 1rem" }} />
        Loading bot dashboard...
      </div>
    );
  }

  const tabs: { id: Tab; label: string; icon: typeof Activity; description: string }[] = [
    { id: 'monitor', label: 'Monitor', icon: Activity, description: 'Live bot status & activity' },
    { id: 'backtest', label: 'Backtest', icon: FlaskConical, description: 'Strategy testing lab' },
    { id: 'leaderboard', label: 'Leaderboard', icon: Trophy, description: 'Competition & ranking' },
    { id: 'config', label: 'Config', icon: Settings, description: 'Risk & settings' },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
      {/* Market Info Banner */}
      {marketData?.market && (
        <div className="glass-card" style={{ padding: "1rem" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "1rem" }}>
            <div style={{ flex: "1 1 300px", minWidth: 0 }}>
              <div style={{ fontSize: "0.625rem", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "0.25rem" }}>
                Current Market
              </div>
              <div style={{ fontSize: "0.875rem", color: "var(--text-primary)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {marketData.market.question || `${marketData.market.asset || "BTC"} ${marketData.market.timeframe || "5m"} Market`}
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "1.5rem" }}>
              {/* Time Remaining */}
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: "0.625rem", color: "var(--text-muted)", marginBottom: "0.25rem" }}>Time Left</div>
                <div style={{
                  fontSize: "1.25rem",
                  fontWeight: 700,
                  fontFamily: "ui-monospace, monospace",
                  color: timeRemaining < 60000 ? "var(--red)" : timeRemaining < 180000 ? "var(--warning)" : "var(--text-primary)"
                }}>
                  {formatTimeRemaining(timeRemaining)}
                </div>
              </div>
              {/* Progress Bar */}
              <div style={{ width: 120 }}>
                <div style={{ height: 6, background: "var(--border)", borderRadius: 3, overflow: "hidden" }}>
                  <div
                    style={{
                      height: "100%",
                      width: `${calculateMarketProgress(marketData)}%`,
                      background: timeRemaining < 60 ? "var(--red)" : "var(--primary)",
                      borderRadius: 3,
                      transition: "width 1s linear"
                    }}
                  />
                </div>
                <div style={{ fontSize: "0.625rem", color: "var(--text-muted)", marginTop: "0.25rem", textAlign: "center" }}>
                  {calculateMarketProgress(marketData).toFixed(0)}% elapsed
                </div>
              </div>
              {/* Current Prices */}
              <div style={{ display: "flex", gap: "0.75rem" }}>
                <div style={{ textAlign: "center" }}>
                  <div style={{ fontSize: "0.625rem", color: "var(--text-muted)" }}>YES</div>
                  <div style={{ fontSize: "1rem", fontWeight: 600, color: "var(--green)" }}>
                    {(yesPrice * 100).toFixed(1)}¢
                  </div>
                </div>
                <div style={{ textAlign: "center" }}>
                  <div style={{ fontSize: "0.625rem", color: "var(--text-muted)" }}>NO</div>
                  <div style={{ fontSize: "1rem", fontWeight: 600, color: "var(--red)" }}>
                    {(noPrice * 100).toFixed(1)}¢
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Quick Stats Header */}
      <div className="glass-card" style={{ padding: "1rem" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "1rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "2rem" }}>
            <div>
              <span style={{ fontSize: "0.625rem", color: "var(--text-muted)", display: "block", textTransform: "uppercase", letterSpacing: "0.05em" }}>Bots</span>
              <span style={{ fontSize: "1.5rem", fontWeight: 700, color: "var(--green)" }}>
                {activeBots.length}<span style={{ color: "var(--text-muted)", fontWeight: 400 }}>/{bots.length}</span>
              </span>
            </div>
            <div>
              <span style={{ fontSize: "0.625rem", color: "var(--text-muted)", display: "block", textTransform: "uppercase", letterSpacing: "0.05em" }}>Total P&L</span>
              <span style={{ 
                fontSize: "1.5rem", 
                fontWeight: 700, 
                fontFamily: "ui-monospace, monospace",
                color: totalPnl >= 0 ? "var(--green)" : "var(--red)" 
              }}>
                {totalPnl >= 0 ? "+" : ""}{formatCurrency(totalPnl)}
              </span>
            </div>
            <div>
              <span style={{ fontSize: "0.625rem", color: "var(--text-muted)", display: "block", textTransform: "uppercase", letterSpacing: "0.05em" }}>Win Rate</span>
              <span style={{ fontSize: "1.5rem", fontWeight: 700, fontFamily: "ui-monospace, monospace" }}>
                {(totalWinRate * 100).toFixed(0)}%
              </span>
            </div>
            <div>
              <span style={{ fontSize: "0.625rem", color: "var(--text-muted)", display: "block", textTransform: "uppercase", letterSpacing: "0.05em" }}>Trades</span>
              <span style={{ fontSize: "1.5rem", fontWeight: 700, fontFamily: "ui-monospace, monospace" }}>
                {totalTrades}
              </span>
            </div>
            <div>
              <span style={{ fontSize: "0.625rem", color: "var(--text-muted)", display: "block", textTransform: "uppercase", letterSpacing: "0.05em" }}>Prices</span>
              <div style={{ display: "flex", gap: "0.75rem", fontSize: "1rem", fontWeight: 600 }}>
                <span style={{ color: "var(--green)" }}>↑{(yesPrice * 100).toFixed(1)}¢</span>
                <span style={{ color: "var(--red)" }}>↓{(noPrice * 100).toFixed(1)}¢</span>
              </div>
            </div>
          </div>

          <div style={{ display: "flex", gap: "0.5rem" }}>
            <button
              onClick={handleRunAll}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.375rem",
                padding: "0.5rem 1rem",
                borderRadius: 8,
                border: "none",
                background: "linear-gradient(135deg, #22c55e, #16a34a)",
                color: "white",
                fontWeight: 600,
                cursor: "pointer",
                fontSize: "0.875rem",
              }}
            >
              <Play className="w-4 h-4" fill="currentColor" />
              Run All
            </button>
            <button
              onClick={handleStopAll}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.375rem",
                padding: "0.5rem 1rem",
                borderRadius: 8,
                border: "1px solid var(--border)",
                background: "transparent",
                color: "var(--text-secondary)",
                fontWeight: 600,
                cursor: "pointer",
                fontSize: "0.875rem",
              }}
            >
              <Square className="w-4 h-4" />
              Stop All
            </button>
          </div>
        </div>
      </div>

      {/* 4-Tab Navigation */}
      <div style={{
        display: "flex",
        alignItems: "stretch",
        gap: "0.5rem",
        padding: "0.25rem",
        background: "rgba(0,0,0,0.2)",
        borderRadius: 12,
      }}>
        {tabs.map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                flex: 1,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "0.5rem",
                padding: "0.75rem 1rem",
                borderRadius: 10,
                border: "none",
                background: isActive ? "var(--glass-bg)" : "transparent",
                color: isActive ? "var(--text-primary)" : "var(--text-muted)",
                fontWeight: isActive ? 600 : 400,
                cursor: "pointer",
                fontSize: "0.875rem",
                transition: "all 0.2s",
                boxShadow: isActive ? "0 2px 8px rgba(0,0,0,0.2)" : "none",
              }}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab Content */}
      {activeTab === 'monitor' && (
        <LiveMonitorTab
          bots={bots}
          botLogs={botLogs}
          yesPrice={yesPrice}
          noPrice={noPrice}
          positions={positions}
          updateBotState={updateBotState}
          timeRemaining={timeRemaining}
          marketData={marketData}
        />
      )}

      {activeTab === 'backtest' && (
        <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
          <StrategyLabTab />
          <PerformanceDashboard bots={bots} />
          <AnalyticsTab />
        </div>
      )}

      {activeTab === 'leaderboard' && (
        <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
          <CompetitionTab bots={bots} />
          <SessionHistoryTab />
        </div>
      )}

      {activeTab === 'config' && (
        <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
          <RiskPanel />
          <TradingModeToggle />
          <SettingsPanel />
        </div>
      )}
    </div>
  );
}

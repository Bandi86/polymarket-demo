import { useState, useEffect, useCallback } from "react";
import { Zap, Play, Square, BarChart3, History, FlaskConical, Trophy, Shield, Settings, Activity } from "lucide-react";
import { LiveMonitorTab } from "./LiveMonitorTab";
import { SessionHistoryTab } from "./SessionHistoryTab";
import { StrategyLabTab } from "./StrategyLabTab";
import { CompetitionTab } from "./CompetitionTab";
import { RiskPanel } from "./RiskPanel";
import { AnalyticsTab } from "./AnalyticsTab";
import { TradingModeToggle } from "./TradingModeToggle";
import { SettingsPanel } from "./SettingsPanel";
import { useTradingData } from "../hooks/useTradingData";
import { formatCurrency } from "../lib/utils";

type Tab = 'bots' | 'history' | 'lab' | 'competition' | 'analytics' | 'risk' | 'settings';

export function BotDashboardPage() {
  const [activeTab, setActiveTab] = useState<Tab>('bots');
  const {
    bots,
    botLogs,
    yesPrice,
    noPrice,
    loading,
    updateBotState,
    portfolio,
    fetchData,
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

  const tabs: { id: Tab; label: string; icon: typeof Activity }[] = [
    { id: 'bots', label: 'Bots', icon: Zap },
    { id: 'history', label: 'History', icon: History },
    { id: 'lab', label: 'Lab', icon: FlaskConical },
    { id: 'competition', label: 'Competition', icon: Trophy },
    { id: 'analytics', label: 'Analytics', icon: BarChart3 },
    { id: 'risk', label: 'Risk', icon: Shield },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
      {/* Quick Stats Header */}
      <div className="glass-card" style={{ padding: "1rem" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "1rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "2rem" }}>
            <div>
              <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", display: "block" }}>Running</span>
              <span style={{ fontSize: "1.5rem", fontWeight: 700, color: "var(--green)" }}>
                {activeBots.length}/{bots.length}
              </span>
            </div>
            <div>
              <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", display: "block" }}>Total P&L</span>
              <span style={{ 
                fontSize: "1.5rem", 
                fontWeight: 700, 
                fontFamily: "monospace",
                color: totalPnl >= 0 ? "var(--green)" : "var(--red)" 
              }}>
                {totalPnl >= 0 ? "+" : ""}{formatCurrency(totalPnl)}
              </span>
            </div>
            <div>
              <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", display: "block" }}>Avg Win Rate</span>
              <span style={{ fontSize: "1.5rem", fontWeight: 700, fontFamily: "monospace" }}>
                {(totalWinRate * 100).toFixed(1)}%
              </span>
            </div>
            <div>
              <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", display: "block" }}>Current Price</span>
              <div style={{ display: "flex", gap: "0.75rem", fontSize: "1rem", fontWeight: 600 }}>
                <span style={{ color: "var(--green)" }}>UP: {(yesPrice * 100).toFixed(1)}¢</span>
                <span style={{ color: "var(--red)" }}>DN: {(noPrice * 100).toFixed(1)}¢</span>
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
                background: "var(--green)",
                color: "white",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              <Play className="w-4 h-4" />
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
              }}
            >
              <Square className="w-4 h-4" />
              Stop All
            </button>
          </div>
        </div>
      </div>

      {/* Tab Header */}
      <div style={{
        display: "flex",
        alignItems: "center",
        gap: "0.25rem",
        borderBottom: "1px solid var(--border)",
        paddingBottom: "0",
        overflowX: "auto",
      }}>
        {tabs.map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.5rem",
                padding: "0.625rem 1rem",
                borderRadius: "8px 8px 0 0",
                border: "none",
                background: isActive ? "var(--glass-bg)" : "transparent",
                color: isActive ? "var(--text-primary)" : "var(--text-muted)",
                fontWeight: isActive ? 600 : 400,
                cursor: "pointer",
                fontSize: "0.875rem",
                borderBottom: isActive ? "2px solid var(--primary)" : "2px solid transparent",
                whiteSpace: "nowrap",
              }}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab Content */}
      {activeTab === 'bots' && (
        <LiveMonitorTab
          bots={bots}
          botLogs={botLogs}
          yesPrice={yesPrice}
          positions={positions}
          updateBotState={updateBotState}
        />
      )}
      {activeTab === 'history' && (
        <SessionHistoryTab />
      )}
      {activeTab === 'lab' && (
        <StrategyLabTab />
      )}
      {activeTab === 'competition' && (
        <CompetitionTab />
      )}
      {activeTab === 'analytics' && (
        <AnalyticsTab />
      )}
      {activeTab === 'risk' && (
        <RiskPanel />
      )}
      {activeTab === 'settings' && (
        <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
          <TradingModeToggle />
          <SettingsPanel />
        </div>
      )}
    </div>
  );
}

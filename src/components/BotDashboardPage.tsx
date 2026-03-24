'use client'

import { useState, useEffect } from "react";
import { LiveMonitorTab } from "@/components/LiveMonitorTab";
import { SessionHistoryTab } from "@/components/SessionHistoryTab";
import { StrategyLabTab } from "@/components/StrategyLabTab";
import { CompetitionTab } from "@/components/CompetitionTab";
import { RiskPanel } from "@/components/RiskPanel";
import { RiskDashboard } from "@/components/RiskDashboard";
import { AnalyticsTab } from "@/components/AnalyticsTab";
import { TradingModeToggle } from "@/components/TradingModeToggle";
import { SettingsPanel } from "@/components/SettingsPanel";
import { PerformanceDashboard } from "@/components/dashboard/PerformanceDashboard";
import { useTradingData } from "@/hooks/useTradingData";

export function BotTabsContent({ activeTab }: { activeTab: string }) {
  const {
    bots,
    botLogs,
    yesPrice,
    noPrice,
    loading,
    updateBotState,
    timeRemaining,
    competition,
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

  if (loading) {
    return (
      <div style={{ textAlign: "center", padding: "4rem", color: "var(--text-secondary)" }}>
        <div className="loading-spinner" style={{ margin: "0 auto 1rem" }} />
        Loading bot dashboard...
      </div>
    );
  }

  return (
    <div style={{ padding: "0" }}>
      {/* Tab Content */}
      {activeTab === 'monitor' && (
        <LiveMonitorTab
          bots={bots}
          botLogs={botLogs}
          yesPrice={yesPrice}
          positions={positions}
          updateBotState={updateBotState}
          timeRemaining={timeRemaining}
          competition={competition}
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
          <CompetitionTab bots={bots} competition={competition} onRefreshData={fetchData} />
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

      {activeTab === 'risk' && (
        <RiskDashboard
          bots={bots}
          totalBalance={bots.reduce((sum, b) => sum + (b.portfolio?.balance || 0), 0)}
          initialBalance={bots.length * 10}
        />
      )}
    </div>
  );
}

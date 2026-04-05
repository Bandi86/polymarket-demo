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
import { SettlementStats } from "@/components/SettlementStats";
import { PerformanceDashboard } from "@/components/dashboard/PerformanceDashboard";
import LiveModeDashboard from "@/components/LiveModeDashboard";
import { useTradingData } from "@/hooks/useTradingData";
import { useTradingStore } from "@/lib/stores/trading-store";
import { useBotStore } from "@/lib/stores/bot-store";
import type { BotData, MarketData } from "@/hooks/useTradingData";
import type { BotLog, Position } from "@/types";

export function BotTabsContent({ activeTab, marketData, coinColor }: { activeTab: string; marketData?: MarketData | null; coinColor?: string }) {
  // Use Zustand stores directly instead of useTradingData 
  // to avoid creating duplicate interval polling loops
  const { yesPrice, noPrice, timeRemaining, competition, loading } = useTradingStore();
  const { bots, botLogs, updateBot } = useBotStore();

  const updateBotState = async (id: string, updates: Partial<BotData>) => {
    // API call to update bot server-side - specifically for enabling/disabling
    if ('enabled' in updates) {
      try {
        await fetch(`/api/bots/${id}/toggle`, { method: "POST" });
      } catch(e) { console.error(e) }
    }
    // Update local store immediately for responsiveness
    updateBot(id, updates);
  };

  const fetchData = async () => {
    // Function passed to CompetitionTab for manual refresh requested
    try {
      await fetch('/api/market'); // forces market refresh
      await fetch('/api/bots');   // forces bots refresh
    } catch(e) { console.error(e) }
  };

  const [positions, setPositions] = useState<Position[]>([]);

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
          <SettlementStats />
          <RiskPanel />
          <TradingModeToggle />
          <SettingsPanel />
        </div>
      )}

      {activeTab === 'risk' && (
        <RiskDashboard
          bots={bots}
          totalBalance={bots.reduce((sum: number, b: BotData) => sum + (b.portfolio?.balance || 0), 0)}
          initialBalance={bots.length * 10}
        />
      )}

      {activeTab === 'live' && (
        <LiveModeDashboard />
      )}
    </div>
  );
}

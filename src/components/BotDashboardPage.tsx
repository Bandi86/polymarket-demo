import { useState, useEffect } from "react";
import { BarChart3, Activity, FlaskConical } from "lucide-react";
import { LiveMonitorTab } from "./LiveMonitorTab";
import { SessionHistoryTab } from "./SessionHistoryTab";
import { StrategyLabTab } from "./StrategyLabTab";
import { useTradingData } from "../hooks/useTradingData";

type Tab = 'live' | 'history' | 'lab';

export function BotDashboardPage() {
  const [activeTab, setActiveTab] = useState<Tab>('live');
  const {
    bots,
    botLogs,
    yesPrice,
    loading
  } = useTradingData();

  // Fetch positions for live monitor
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

  const tabs: { id: Tab; label: string; icon: typeof Activity }[] = [
    { id: 'live', label: 'Live Monitor', icon: Activity },
    { id: 'history', label: 'Session History', icon: BarChart3 },
    { id: 'lab', label: 'Strategy Lab', icon: FlaskConical },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
      {/* Tab Header */}
      <div style={{
        display: "flex",
        alignItems: "center",
        gap: "0.5rem",
        borderBottom: "1px solid var(--border)",
        paddingBottom: "0.5rem"
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
                padding: "0.5rem 1rem",
                borderRadius: "8px 8px 0 0",
                border: "none",
                background: isActive ? "var(--glass-bg)" : "transparent",
                color: isActive ? "var(--text-primary)" : "var(--text-muted)",
                fontWeight: isActive ? 600 : 400,
                cursor: "pointer",
                borderBottom: isActive ? "2px solid var(--primary)" : "none"
              }}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab Content */}
      {activeTab === 'live' && (
        <LiveMonitorTab
          bots={bots}
          botLogs={botLogs}
          yesPrice={yesPrice}
          positions={positions}
        />
      )}
      {activeTab === 'history' && (
        <SessionHistoryTab />
      )}
      {activeTab === 'lab' && (
        <StrategyLabTab />
      )}
    </div>
  );
}
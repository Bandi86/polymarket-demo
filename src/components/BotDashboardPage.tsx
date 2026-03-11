import { useState, useEffect } from "react";
import { BarChart3, Activity } from "lucide-react";
import { LiveMonitorTab } from "./LiveMonitorTab";
import { SessionHistoryTab } from "./SessionHistoryTab";
import { useTradingData } from "../hooks/useTradingData";

type Tab = 'live' | 'history';

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
        <button
          onClick={() => setActiveTab('live')}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.5rem",
            padding: "0.5rem 1rem",
            borderRadius: "8px 8px 0 0",
            border: "none",
            background: activeTab === 'live' ? "var(--glass-bg)" : "transparent",
            color: activeTab === 'live' ? "var(--text-primary)" : "var(--text-muted)",
            fontWeight: activeTab === 'live' ? 600 : 400,
            cursor: "pointer",
            borderBottom: activeTab === 'live' ? "2px solid var(--primary)" : "none"
          }}
        >
          <Activity className="w-4 h-4" />
          Live Monitor
        </button>
        <button
          onClick={() => setActiveTab('history')}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.5rem",
            padding: "0.5rem 1rem",
            borderRadius: "8px 8px 0 0",
            border: "none",
            background: activeTab === 'history' ? "var(--glass-bg)" : "transparent",
            color: activeTab === 'history' ? "var(--text-primary)" : "var(--text-muted)",
            fontWeight: activeTab === 'history' ? 600 : 400,
            cursor: "pointer",
            borderBottom: activeTab === 'history' ? "2px solid var(--primary)" : "none"
          }}
        >
          <BarChart3 className="w-4 h-4" />
          Session History
        </button>
      </div>

      {/* Tab Content */}
      {activeTab === 'live' ? (
        <LiveMonitorTab
          bots={bots}
          botLogs={botLogs}
          yesPrice={yesPrice}
          positions={positions}
        />
      ) : (
        <SessionHistoryTab />
      )}
    </div>
  );
}
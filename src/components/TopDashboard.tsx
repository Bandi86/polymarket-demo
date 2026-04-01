'use client'

import { useState } from "react";
import { toast } from "@/components/ui/toast";
import { DepositModal } from "@/components/DepositModal";
import { useLocalTimer } from "@/hooks/useLocalTimer";
import {
  TopDashboardHeader,
  CompactDataBar,
  TabNavigation,
  useTopDashboardState,
  formatDurationMs,
} from "@/components/dashboard";
import type { MarketData, BotData, CompetitionState, LiveBalance } from "@/hooks/useTradingData";
import type { Portfolio } from "@/types";

export type TabId = 'trade' | 'monitor' | 'live' | 'backtest' | 'leaderboard' | 'config' | 'risk';

interface TopDashboardProps {
  // Global
  marketData: MarketData | null;
  portfolio: Portfolio | null;
  yesPrice: number;
  noPrice: number;
  apiLatency: number;
  coinColor: string;
  isBotRunning: boolean;
  soundEnabled: boolean;
  onToggleSound: () => void;
  // Bot stats
  bots: BotData[];
  onRunAll: () => Promise<void>;
  onStopAll: () => Promise<void>;
  // Competition state
  competition: CompetitionState | null;
  // Positions
  openPositionsCount: number;
  openPositionsValue: number;
  openPositions?: Array<{ outcome: string; stake: number; amount?: number; odds?: number; botId?: string }>;
  // Bot logs for historical trade tracking
  botLogs?: Array<{ type: string; details?: { outcome?: string; action?: string; amount?: number; stake?: number } }>;
  // Tabs
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
  // Selectors
  selectedAsset: string;
  onAssetChange: (asset: string) => void;
  selectedTimeframe: string;
  onTimeframeChange: (tf: string) => void;
  // Trading mode
  tradingMode?: "demo" | "live";
  onModeChange?: (mode: "demo" | "live") => Promise<void>;
  setTradingMode?: (mode: "demo" | "live") => void;
  // Live balance from Polymarket
  liveBalance?: LiveBalance;
  onRefreshLiveBalance?: () => Promise<void>;
  // BTC data for enhanced stats
  btcPrice?: number;
  btcWindowOpen?: number;
}

export function TopDashboard({
  marketData,
  portfolio,
  yesPrice,
  noPrice,
  coinColor,
  isBotRunning,
  soundEnabled,
  onToggleSound,
  bots,
  onRunAll,
  onStopAll,
  competition,
  openPositionsCount,
  openPositionsValue,
  openPositions,
  botLogs,
  activeTab,
  onTabChange,
  selectedAsset,
  onAssetChange,
  selectedTimeframe,
  onTimeframeChange,
  tradingMode = "demo",
  onModeChange,
  setTradingMode,
  liveBalance,
  onRefreshLiveBalance,
  btcPrice,
  btcWindowOpen,
}: TopDashboardProps) {

  // Deposit modal state
  const [showDepositModal, setShowDepositModal] = useState(false);

  // Use custom hook for state management
  const state = useTopDashboardState({
    marketData,
    bots,
    competition,
    openPositionsCount,
    openPositionsValue,
    isBotRunning,
    tradingMode,
    liveBalance,
    setTradingMode,
    openPositions,
    botLogs,
    btcPrice,
    btcWindowOpen,
    yesPrice,
  });

  // Use local timer for smooth countdown
  const { timeRemaining } = useLocalTimer();

  // Quick run handler
  const handleQuickRun = async (durationMinutes: number) => {
    try {
      const res = await fetch("/api/competition/quick-run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ durationMinutes })
      });

      const data = await res.json();

      if (res.ok) {
        // Sync trading mode with backend (might have switched to demo)
        if (data.mode && data.mode !== tradingMode && setTradingMode) {
          console.log(`[TopDashboard] Backend switched mode to ${data.mode}`);
          setTradingMode(data.mode);
        }
        toast.success(`Started ${formatDurationMs(durationMinutes * 60000)} run`, `${bots.length} bots enabled`);
      } else {
        toast.error("Failed to start quick run", data.error || "Unknown error");
      }
    } catch (err) {
      toast.error("Failed to start quick run");
    }
  };

  return (
    <div style={{
      background: "rgba(11, 11, 15, 0.95)",
      backdropFilter: "blur(20px)",
      borderBottom: "1px solid var(--border)",
      position: "sticky",
      top: 0,
      zIndex: 50,
      width: "100%"
    }}>
      <div style={{
        maxWidth: 1600,
        margin: "0 auto",
        width: "100%",
        padding: "0.75rem 1.5rem 0",
        display: "flex",
        flexDirection: "column",
        gap: "0.75rem"
      }}>
        {/* ROW 1: Logo & Global Controls */}
        <TopDashboardHeader
          coinColor={coinColor}
          selectedAsset={selectedAsset}
          onAssetChange={onAssetChange}
          selectedTimeframe={selectedTimeframe}
          onTimeframeChange={onTimeframeChange}
          tradingMode={tradingMode}
          onModeChange={onModeChange}
          setTradingMode={setTradingMode}
          liveBalance={liveBalance}
          isBotRunning={isBotRunning}
          soundEnabled={soundEnabled}
          onToggleSound={onToggleSound}
          onDepositClick={() => setShowDepositModal(true)}
          risk={state.risk}
        />

        {/* ROW 2: Compact Data Bar with all metrics */}
        <CompactDataBar
          yesPrice={yesPrice}
          noPrice={noPrice}
          timeRemaining={timeRemaining}
          btcPrice={btcPrice}
          priceToBeat={marketData?.priceToBeat || marketData?.market?.priceToBeat}
          totalBotsBalance={state.totalBotsBalance}
          liveBalance={liveBalance}
          totalPnl={state.totalPnl}
          totalTrades={state.totalTrades}
          totalWinRate={state.totalWinRate}
          totalWins={state.totalWins}
          totalLosses={state.totalLosses}
          totalExposure={state.totalExposure}
          exposureRatio={state.exposureRatio}
          activeBots={state.activeBots}
          totalBots={bots.length}
          competition={competition}
          runTimeRemaining={state.runTimeRemaining}
          isBotRunning={isBotRunning}
          onRunAll={onRunAll}
          onStopAll={onStopAll}
          onQuickRun={handleQuickRun}
          maxStreak={state.maxConsecutiveWins}
          yesBots={state.yesPositions}
          noBots={state.noPositions}
          yesStake={state.yesStake}
          noStake={state.noStake}
          netIfYesWins={state.netIfYesWins}
          netIfNoWins={state.netIfNoWins}
        />

        {/* ROW 3: Tab Navigation */}
        <TabNavigation
          activeTab={activeTab}
          onTabChange={onTabChange}
        />
      </div>

      {/* Deposit Modal */}
      <DepositModal
        isOpen={showDepositModal}
        onClose={() => setShowDepositModal(false)}
        polymarketBalance={liveBalance?.balance || 0}
        onRefreshBalance={onRefreshLiveBalance || (async () => {})}
      />
    </div>
  );
}
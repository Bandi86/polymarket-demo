'use client'

import { useState } from "react";
import { toast } from "@/components/ui/toast";
import { DepositModal } from "@/components/DepositModal";
import { useLocalTimer } from "@/hooks/useLocalTimer";
import {
  TopDashboardHeader,
  QuickStatsCards,
  MarketInfoPanel,
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
  openPositions?: Array<{ outcome: string; stake: number }>;
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
  apiLatency,
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
        padding: "1rem 1.5rem 0",
        display: "flex",
        flexDirection: "column",
        gap: "1rem"
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

        {/* Quick Stats Cards */}
        <QuickStatsCards
          maxConsecutiveWins={state.maxConsecutiveWins}
          bestTrade={state.bestTrade}
          activeBots={state.activeBots}
          isBotRunning={isBotRunning}
          totalPnl={state.totalPnl}
        />

        {/* ROW 2: Detailed Market & Bot Stats Box */}
        <MarketInfoPanel
          marketData={marketData}
          competition={competition}
          yesPrice={yesPrice}
          noPrice={noPrice}
          timeRemaining={timeRemaining}
          runTimeRemaining={state.runTimeRemaining}
          isBotRunning={isBotRunning}
          bots={bots}
          activeBots={state.activeBots}
          totalBotsBalance={state.totalBotsBalance}
          totalPnl={state.totalPnl}
          totalWinRate={state.totalWinRate}
          totalTrades={state.totalTrades}
          totalWins={state.totalWins}
          totalLosses={state.totalLosses}
          totalExposure={state.totalExposure}
          exposureRatio={state.exposureRatio}
          potentialWin={state.potentialWin}
          potentialLoss={state.potentialLoss}
          openPositionsCount={openPositionsCount}
          liveBalance={liveBalance}
          onRefreshLiveBalance={onRefreshLiveBalance}
          onRunAll={onRunAll}
          onStopAll={onStopAll}
          onQuickRun={handleQuickRun}
          tradingMode={tradingMode}
          setTradingMode={setTradingMode}
          totalStake={state.totalStake}
          yesTrades={state.yesTrades}
          noTrades={state.noTrades}
          btcPrice={btcPrice}
          btcDelta={state.btcDelta}
          priceToBeat={marketData?.priceToBeat || marketData?.market?.priceToBeat}
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
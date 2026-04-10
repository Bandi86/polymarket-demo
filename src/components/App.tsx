'use client'

import { useState, useCallback, useEffect, useRef } from "react";
import { useTradingData } from "@/hooks/useTradingData";
import { useTradingStore } from "@/lib/stores/trading-store";
import { useFixedSoundNotifications } from "@/hooks/useFixedSoundNotifications";
import { useNotifications } from "@/lib/notifications";
import { NotificationCenter } from "@/components/NotificationCenter";
import { MarketCard } from "@/components/MarketCard";
import { ChartPanel } from "@/components/ChartPanel";
import { TradingPanel } from "@/components/TradingPanel";
import { PositionsPanel } from "@/components/PositionsPanel";
import { ActivityLog } from "@/components/ActivityLog";
import { BotTabsContent } from "@/components/BotDashboardPage";
import { TopDashboard, type TabId } from "@/components/TopDashboard";
import { QuickActions } from "@/components/quick-actions";
import { OrderBook } from "@/components/OrderBook";
import { SessionSummaryModal } from "@/components/SessionSummaryModal";
import { useToastActions } from "@/components/ui/toast";
import { TradeNotification, SettlementNotification, SessionCompleteNotification, MarketPeriodSummary, HourlySummary } from "@/components/ui/notification-components";
import { formatCurrency } from "@/lib/utils";

const ASSETS = [
  { id: "BTC", name: "Bitcoin", color: "#f7931a" },
  { id: "ETH", name: "Ethereum", color: "#627eea" },
  { id: "SOL", name: "Solana", color: "#14f195" },
  { id: "XRP", name: "Ripple", color: "#346aa9" },
];

export function App() {
  const [selectedAsset, setSelectedAsset] = useState("BTC");
  const [selectedTimeframe, setSelectedTimeframe] = useState("5");
  const [activeTab, setActiveTab] = useState<TabId>('trade');
  const [openPositionsCount, setOpenPositionsCount] = useState(0);
  const [openPositionsValue, setOpenPositionsValue] = useState(0);
  const [showSessionSummary, setShowSessionSummary] = useState(false);
  const [tradingMode, setTradingMode] = useState<"demo" | "live">("demo");
  const prevCompetitionActive = useRef(true);
  const lastProcessedLogId = useRef<string>("");

  // Portfolio tracking for summaries
  const portfolioStartValue = useRef<number>(0);
  const lastHourlyReport = useRef<number>(0);
  const lastMarketSettlement = useRef<number>(0);
  const marketPeriodTrades = useRef<number>(0);
  const marketPeriodWins = useRef<number>(0);
  const marketPeriodLosses = useRef<number>(0);
  const marketPeriodPnl = useRef<number>(0);
  const hourlyTrades = useRef<number>(0);
  const hourlyWins = useRef<number>(0);
  const hourlyLosses = useRef<number>(0);
  const hourlyPnl = useRef<number>(0);

  const {
    marketData,
    portfolio,
    bots,
    events,
    botLogs,
    competition,
    loading,
    apiLatency,
    isBotRunning,
    yesPrice,
    noPrice,
    yesPriceDirection,
    noPriceDirection,
    liveBalance,
    fetchData,
    fetchLiveBalance,
    addTradeEvent,
  } = useTradingData();

  // Use BTC price directly from store for real-time updates (bypasses marketData.spotPrice lag)
  const btcPriceFromStore = useTradingStore(s => s.btcPrice);
  const priceToBeatFromStore = useTradingStore(s => s.priceToBeat);

  // Use enhanced notification system
  const { showTrade, showSettlement, showSessionComplete, showError } = useNotifications();
  const { enabled: soundEnabled, playTrade, playWin, playWinBig, playLoss, toggleEnabled: toggleSound } = useFixedSoundNotifications();
  const toast = useToastActions();

  // Track processed log IDs to avoid duplicate notifications
  const processedLogIds = useRef<Set<string>>(new Set());

  // Handle new bot trade notifications - only when bots are running
  useEffect(() => {
    if (!isBotRunning || botLogs.length === 0) return;

    const newLogs = botLogs.filter(log => !processedLogIds.current.has(log.id));
    if (newLogs.length === 0) return;

    // Process each new log
    newLogs.forEach(latestLog => {
      processedLogIds.current.add(latestLog.id);

      // Skip competition logs
      if (latestLog.botId === "competition") return;

      // Notify on TRADE (position opened) and SETTLED (position closed/won/lost)
      if (latestLog.type === "TRADE") {
        const details = latestLog.details || {};
        const outcome = (details.outcome as "YES" | "NO") || "YES";
        const amount = details.amount as number || details.stake as number || 0;
        const price = details.odds as number || details.price as number || details.avgPrice as number || details.marketPrice as number || details.fillPrice as number || 0;

        playTrade();

        // Find bot for additional info
        const bot = bots.find(b => b.id === latestLog.botId);

        // Show enhanced notification
        showTrade({
          botName: latestLog.botName,
          outcome,
          amount,
          price,
          balance: bot?.portfolio?.balance,
          strategy: bot?.strategy,
        });

        // Also show toast for backward compatibility
        toast.custom(
          <TradeNotification
            botName={latestLog.botName}
            outcome={outcome}
            amount={amount}
            price={price}
            balance={bot?.portfolio?.balance}
            strategy={bot?.strategy}
          />,
          { duration: 4000 }
        );
      } else if (latestLog.type === "SETTLED") {
        const details = latestLog.details || {};
        const won = details.won as boolean;
        const pnl = details.pnl as number || 0;
        const outcome = details.outcome as string || "YES";

        // Play sound - win for wins, loss notification for losses
        if (won) {
          playWin();
        } else {
          playLoss();
        }

        // Track hourly stats
        hourlyTrades.current++;
        hourlyPnl.current += pnl;
        if (won) {
          hourlyWins.current++;
        } else {
          hourlyLosses.current++;
        }

        // Track market period stats
        marketPeriodTrades.current++;
        marketPeriodPnl.current += pnl;
        if (won) {
          marketPeriodWins.current++;
        } else {
          marketPeriodLosses.current++;
        }

        // Show market period summary every ~5 minutes (when price likely reset)
        const now = Date.now();
        const fiveMinutes = 5 * 60 * 1000;
        if (now - lastMarketSettlement.current >= fiveMinutes && marketPeriodTrades.current > 0) {
          // Find best/worst bots in this period
          const botPerformances = bots.map(b => ({
            name: b.name,
            pnl: (b.stats?.pnl || 0),
          }));
          const sorted = [...botPerformances].sort((a, b) => b.pnl - a.pnl);
          const topBot = sorted[0];
          const bottomBot = sorted.length > 1 ? sorted[sorted.length - 1] : undefined;

          toast.custom(
            <MarketPeriodSummary
              periodPnl={marketPeriodPnl.current}
              periodTrades={marketPeriodTrades.current}
              periodWins={marketPeriodWins.current}
              periodLosses={marketPeriodLosses.current}
              periodDuration={fiveMinutes}
              topBot={topBot}
              bottomBot={bottomBot && bottomBot.pnl < 0 ? bottomBot : undefined}
            />,
            { duration: 10000 }
          );

          // Reset market period stats
          marketPeriodTrades.current = 0;
          marketPeriodWins.current = 0;
          marketPeriodLosses.current = 0;
          marketPeriodPnl.current = 0;
          lastMarketSettlement.current = now;
        }

        // Find bot for additional stats
        const bot = bots.find(b => b.id === latestLog.botId);

        // Show enhanced notification
        showSettlement({
          botName: latestLog.botName,
          won,
          pnl,
          outcome,
          trades: bot?.stats?.trades,
          winRate: bot?.stats?.winRate,
          strategy: bot?.strategy,
        });

        // Also show toast for backward compatibility
        toast.custom(
          <SettlementNotification
            botName={latestLog.botName}
            won={won}
            pnl={pnl}
            outcome={outcome}
            trades={bot?.stats?.trades}
            winRate={bot?.stats?.winRate}
            strategy={bot?.strategy}
          />,
          { duration: 5000 }
        );
      }
    });

    // Cleanup old processed IDs to prevent memory leak (keep last 1000)
    if (processedLogIds.current.size > 1000) {
      const ids = Array.from(processedLogIds.current);
      processedLogIds.current = new Set(ids.slice(-500));
    }
  }, [botLogs, isBotRunning, bots, showTrade, showSettlement, playTrade, playWin, playLoss, toast]);

  const [botPositions, setBotPositions] = useState<Array<{
    id: string; botId?: string; outcome: "YES" | "NO";
    amount: number; stake: number; odds: number; fee?: number;
  }>>([]);

  useEffect(() => {
    const fetchPositions = async () => {
      try {
        const res = await fetch("/api/positions");
        const data = await res.json();
        const openPositions = data.open || [];
        setOpenPositionsCount(openPositions.length);
        setOpenPositionsValue(openPositions.reduce((sum: number, p: { amount: number; odds?: number; stake?: number }) => sum + (p.amount || p.stake || 0), 0));
        setBotPositions(openPositions);
      } catch (err) {
        console.error("Failed to fetch positions:", err);
      }
    };

    fetchPositions();
    const interval = setInterval(fetchPositions, 5000);
    return () => clearInterval(interval);
  }, []);

  // Track portfolio start value when bots start
  useEffect(() => {
    if (isBotRunning && portfolioStartValue.current === 0) {
      // Capture starting portfolio value when bots first start
      const totalBalance = bots.reduce((sum, b) => sum + (b.portfolio?.balance || 0), 0);
      if (totalBalance > 0) {
        portfolioStartValue.current = totalBalance;
        lastHourlyReport.current = Date.now();
      }
    } else if (!isBotRunning) {
      // Reset when bots stop
      portfolioStartValue.current = 0;
      lastHourlyReport.current = 0;
    }
  }, [isBotRunning, bots]);

  // Hourly summary report
  useEffect(() => {
    if (!isBotRunning || portfolioStartValue.current === 0) return;

    const checkHourlyReport = () => {
      const now = Date.now();
      const hourMs = 60 * 60 * 1000; // 1 hour

      if (now - lastHourlyReport.current >= hourMs && hourlyTrades.current > 0) {
        const totalPortfolio = bots.reduce((sum, b) => sum + (b.portfolio?.balance || 0), 0);

        // Find best bot this hour
        const botPerformances = bots.map(b => ({
          name: b.name,
          pnl: (b.portfolio?.balance || 0) - 10, // Assuming $10 start
        }));
        const bestBot = botPerformances.reduce((best, b) => b.pnl > (best?.pnl || 0) ? b : best, undefined as { name: string; pnl: number } | undefined);

        toast.custom(
          <HourlySummary
            hourPnl={hourlyPnl.current}
            hourTrades={hourlyTrades.current}
            hourWins={hourlyWins.current}
            hourLosses={hourlyLosses.current}
            totalPortfolio={totalPortfolio}
            startPortfolio={portfolioStartValue.current}
            bestBot={bestBot}
          />,
          { duration: 15000 }
        );

        // Reset hourly stats
        hourlyTrades.current = 0;
        hourlyWins.current = 0;
        hourlyLosses.current = 0;
        hourlyPnl.current = 0;
        lastHourlyReport.current = now;
      }
    };

    const interval = setInterval(checkHourlyReport, 60000); // Check every minute
    return () => clearInterval(interval);
  }, [isBotRunning, bots]);

  // Periodic memory cleanup for long-running sessions
  useEffect(() => {
    const CLEANUP_INTERVAL = 5 * 60 * 1000; // 5 minutes

    const cleanup = () => {
      // Clear old bot logs if too many
      if (botLogs.length > 100) {
        console.log(`[MemoryCleanup] Trimming ${botLogs.length - 100} old bot logs`);
      }

      // Clear old events if too many
      if (events.length > 50) {
        console.log(`[MemoryCleanup] Trimming ${events.length - 50} old events`);
      }
    };

    const intervalId = setInterval(cleanup, CLEANUP_INTERVAL);
    return () => clearInterval(intervalId);
  }, [botLogs.length, events.length]);

  // Fetch trading mode from backend on mount
  useEffect(() => {
    const fetchTradingMode = async () => {
      try {
        const res = await fetch("/api/account");
        const data = await res.json();
        if (data.mode && (data.mode === "demo" || data.mode === "live")) {
          setTradingMode(data.mode);
        }
      } catch (err) {
        console.error("Failed to fetch trading mode:", err);
      }
    };
    fetchTradingMode();
  }, []);

  // Show session summary when competition ends
  useEffect(() => {
    if (prevCompetitionActive.current && !competition?.active && competition?.completedAt) {
      setShowSessionSummary(true);

      // Calculate session stats
      const totalPnl = bots.reduce((sum, b) => sum + (b.stats?.pnl || 0), 0);
      const totalTrades = bots.reduce((sum, b) => sum + (b.stats?.trades || 0), 0);
      const totalWins = bots.reduce((sum, b) => sum + (b.stats?.wins || 0), 0);
      const totalLosses = bots.reduce((sum, b) => sum + (b.stats?.losses || 0), 0);
      const totalLossesChecked = totalLosses || 0;
      const winRate = totalTrades > 0 ? totalWins / totalTrades : 0;
      const duration = competition.completedAt - competition.startTime;

      // Find best and worst bots
      const sortedBots = [...bots].sort((a, b) => (b.stats?.pnl || 0) - (a.stats?.pnl || 0));
      const bestBot = sortedBots[0] ? { name: sortedBots[0].name, pnl: sortedBots[0].stats?.pnl || 0 } : undefined;
      const worstBot = sortedBots[sortedBots.length - 1] ? { name: sortedBots[sortedBots.length - 1].name, pnl: sortedBots[sortedBots.length - 1].stats?.pnl || 0 } : undefined;

      // Play session end sound
      if (totalPnl >= 0) {
        playWinBig();
      } else {
        playLoss();
      }

      // Show enhanced notification
      showSessionComplete({
        totalPnl,
        totalTrades,
        totalWins,
        totalLosses: totalLossesChecked,
        winRate,
        duration,
        bestBot,
        worstBot,
      });

      // Also show toast for backward compatibility
      toast.custom(
        <SessionCompleteNotification
          totalPnl={totalPnl}
          totalTrades={totalTrades}
          totalWins={totalWins}
          totalLosses={totalLossesChecked}
          winRate={winRate}
          duration={duration}
          bestBot={bestBot}
          worstBot={worstBot}
        />,
        { duration: 10000 }
      );
    }
    prevCompetitionActive.current = competition?.active ?? false;
  }, [competition?.active, competition?.completedAt, bots, playWinBig, playLoss, showSessionComplete, toast]);

  // Sync timeframe and asset to backend
  useEffect(() => {
    const syncSettings = async () => {
      try {
        await Promise.all([
          fetch("/api/market/timeframe", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ timeframe: selectedTimeframe }),
          }),
          fetch("/api/market/asset", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ asset: selectedAsset }),
          }),
        ]);
        // Fetch fresh market data after sync
        await fetchData();
      } catch (err) {
        console.error("Failed to sync settings:", err);
      }
    };
    // Skip initial render (when both are still default)
    if (selectedTimeframe !== "5" || selectedAsset !== "BTC") {
      syncSettings();
    }
  }, [selectedTimeframe, selectedAsset, fetchData]);

  // Note: Removed auto-switch to monitor tab when bots start running
  // Users should be free to navigate tabs without being forced to a different view

  const activeAsset = ASSETS.find(a => a.id === selectedAsset);
  const coinColor = activeAsset?.color || "#f7931a";

  const handleTrade = useCallback(async (direction: "YES" | "NO", amount: number) => {
    if (!marketData?.market) return;

    const res = await fetch("/api/trade", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        marketId: marketData.market.id,
        outcome: direction,
        amount
      }),
    });

    const data = await res.json();

    if (data.success) {
      playTrade();
      toast.success(
        `${direction === "YES" ? "📈 Bought UP" : "📉 Bought DOWN"}`,
        `$${amount.toFixed(2)} at ${((direction === "YES" ? yesPrice : noPrice) * 100).toFixed(1)}¢ — Potential return: $${(amount / (direction === "YES" ? yesPrice : noPrice)).toFixed(2)}`
      );
      addTradeEvent({
        id: `evt-${Date.now()}`,
        type: "BUY",
        outcome: direction,
        amount,
        price: direction === "YES" ? yesPrice : noPrice,
        time: Date.now(),
      });
      await fetchData();
    } else {
      toast.error("Trade Failed", data.error || "Unknown error");
    }
  }, [marketData, yesPrice, noPrice, addTradeEvent, fetchData]);

  const handleClosePosition = useCallback(async (positionId: string) => {
    await fetch(`/api/positions/${positionId}/close`, { method: "POST" });
    await fetchData();
  }, [fetchData]);

  const handleToggleBot = useCallback(async () => {
    if (isBotRunning) {
      await fetch("/api/bots/stop-all", { method: "POST" });
    } else {
      await fetch("/api/bots/run-all", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ betSize: 1 })
      });
    }
    await fetchData();
  }, [isBotRunning, fetchData]);

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

  const handleReset = useCallback(async () => {
    await fetch("/api/reset", { method: "POST" });
    await fetch("/api/bots/reset-all", { method: "POST" });
    await fetch("/api/competition/clear", { method: "POST" });
    await fetchData();
  }, [fetchData]);

  const handleModeChange = useCallback(async (mode: "demo" | "live") => {
    const res = await fetch("/api/account/mode", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode }),
    });
    const data = await res.json();
    if (data.success) {
      setTradingMode(mode);
      toast.success(
        mode === "live" ? "🔴 Live Mode Enabled" : "🧪 Demo Mode Enabled",
        mode === "live"
          ? "Bots will trade with real USDC on Polymarket"
          : "Bots will trade with simulated balance"
      );
      await fetchLiveBalance();
    } else {
      toast.error("Failed to change mode", data.error || "Unknown error");
    }
  }, [fetchLiveBalance]);

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--bg)" }}>
        <div style={{ textAlign: "center" }}>
          <div className="loading-spinner" style={{ margin: "0 auto 1rem" }} />
          <p style={{ color: "var(--text-secondary)" }}>Connecting to trading engine...</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", display: "flex", flexDirection: "column" }}>
      <TopDashboard
        marketData={marketData}
        portfolio={portfolio}
        yesPrice={yesPrice}
        noPrice={noPrice}
        apiLatency={apiLatency}
        coinColor={coinColor}
        isBotRunning={isBotRunning}
        soundEnabled={soundEnabled}
        onToggleSound={toggleSound}
        bots={bots}
        onRunAll={handleRunAll}
        onStopAll={handleStopAll}
        competition={competition}
        openPositionsCount={openPositionsCount}
        openPositionsValue={openPositionsValue}
        openPositions={botPositions}
        botLogs={botLogs}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        selectedAsset={selectedAsset}
        onAssetChange={setSelectedAsset}
        selectedTimeframe={selectedTimeframe}
        onTimeframeChange={setSelectedTimeframe}
        tradingMode={tradingMode}
        onModeChange={handleModeChange}
        setTradingMode={setTradingMode}
        liveBalance={liveBalance}
        onRefreshLiveBalance={fetchLiveBalance}
        btcPrice={btcPriceFromStore || marketData?.spotPrice}
        btcWindowOpen={priceToBeatFromStore || marketData?.priceToBeat}
      />

      <div style={{ maxWidth: 1600, margin: "0 auto", width: "100%", padding: "1.5rem", position: "relative", flex: 1 }}>

        {/* Ambient Glow Background */}
        <div
          className="ambient-glow hidden md:block"
          style={{
            top: "0%",
            left: "10%",
            width: "600px",
            height: "600px",
            background: `radial-gradient(circle, ${coinColor} 0%, transparent 70%)`
          }}
        />

        {activeTab === 'trade' ? (
          /* Main Content Grid (Manual Trading) */
          <div className="grid gap-4 grid-cols-1 lg:grid-cols-[320px_1fr_360px] items-start animate-slide-in">
            {/* LEFT COLUMN - Market Card */}
            <div className="flex flex-col gap-4">
              <MarketCard
                marketData={marketData}
                yesPrice={yesPrice}
                noPrice={noPrice}
                yesPriceDirection={yesPriceDirection}
                noPriceDirection={noPriceDirection}
                coinColor={coinColor}
                selectedAsset={selectedAsset}
                selectedTimeframe={selectedTimeframe}
                btcPrice={btcPriceFromStore || marketData?.spotPrice}
                priceToBeat={priceToBeatFromStore || marketData?.priceToBeat || marketData?.market?.priceToBeat}
              />

              {/* Quick Actions */}
              <QuickActions
                isBotRunning={isBotRunning}
                onToggleBot={handleToggleBot}
                onReset={handleReset}
                coinColor={coinColor}
              />

              {/* Order Book */}
              <OrderBook
                yesPrice={yesPrice}
                noPrice={noPrice}
                coinColor={coinColor}
              />
            </div>

            {/* CENTER COLUMN - Chart */}
            <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
              <ChartPanel
                marketData={marketData}
                selectedCoin={selectedAsset}
                selectedTimeframe={selectedTimeframe}
                coinColor={coinColor}
                tvSymbol={`BINANCE:${selectedAsset}USDT`}
                yesPrice={yesPrice}
                noPrice={noPrice}
              />

              {/* Activity Log - under the chart */}
              <ActivityLog events={events} botLogs={botLogs} coinColor={coinColor} />
            </div>

            {/* RIGHT COLUMN - Trading & Positions */}
            <div className="flex flex-col gap-4">
              <TradingPanel
                portfolio={portfolio}
                yesPrice={yesPrice}
                noPrice={noPrice}
                coinColor={coinColor}
                onTrade={handleTrade}
              />

              <PositionsPanel
                positions={(portfolio?.openPositions || []) as Array<{ id: string; outcome: "YES" | "NO"; amount: number; odds: number; unrealizedPnl?: number }>}
                coinColor={coinColor}
                onClosePosition={handleClosePosition}
              />
            </div>
          </div>
        ) : (
          /* Bot Management Tabs (Monitor, Backtest, etc) */
          <div className="animate-slide-in">
            <BotTabsContent activeTab={activeTab} marketData={marketData} coinColor={coinColor} />
          </div>
        )}
      </div>

      {/* Session Summary Modal */}
      {showSessionSummary && (
        <SessionSummaryModal
          competition={competition}
          bots={bots}
          onClose={() => setShowSessionSummary(false)}
          onReset={handleReset}
        />
      )}
    </div>
  );
}

export default App;

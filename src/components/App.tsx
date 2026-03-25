'use client'

import { useState, useCallback, useEffect, useRef } from "react";
import { useTradingData } from "@/hooks/useTradingData";
import { useSoundNotifications } from "@/hooks/useSoundNotifications";
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

  const { enabled: soundEnabled, playTrade, playNotification, toggleEnabled: toggleSound } = useSoundNotifications();
  const toast = useToastActions();

  // Handle new bot trade notifications
  useEffect(() => {
    if (botLogs.length === 0) return;

    const latestLog = botLogs[0];
    if (latestLog.id === lastProcessedLogId.current) return;

    lastProcessedLogId.current = latestLog.id;

    // Notify on TRADE (position opened) and SETTLED (position closed/won/lost)
    if (latestLog.type === "TRADE") {
      const details = latestLog.details || {};
      const outcome = details.outcome as string || details.action as string || "YES";
      const amount = details.amount as number || details.stake as number || 0;
      // Try multiple price fields: odds, price, avgPrice, marketPrice, fillPrice
      const price = details.odds as number || details.price as number || details.avgPrice as number || details.marketPrice as number || details.fillPrice as number || 0;

      const isYes = outcome === "YES" || outcome === "UP";
      playTrade();

      toast.success(
        `🤖 ${latestLog.botName}`,
        `${isYes ? "📈" : "📉"} ${isYes ? "Bought UP" : "Bought DOWN"} $${amount.toFixed(2)} @ ${(price * 100).toFixed(1)}¢`
      );
    } else if (latestLog.type === "SETTLED") {
      // Notification when a position is settled (won or lost)
      const details = latestLog.details || {};
      const won = details.won as boolean;
      const pnl = details.pnl as number || 0;
      const outcome = details.outcome as string || "YES";
      
      if (won) {
        playNotification?.();
        toast.success(
          `🎉 ${latestLog.botName} WON!`,
          `+$${pnl.toFixed(2)} | ${outcome} position settled`
        );
      } else {
        playNotification?.();
        toast.error(
          `💔 ${latestLog.botName} LOST`,
          `${pnl.toFixed(2)} | ${outcome} position settled`
        );
      }
    }
  }, [botLogs, playTrade, playNotification, toast]);

  // Fetch positions count
  useEffect(() => {
    const fetchPositions = async () => {
      try {
        const res = await fetch("/api/positions");
        const data = await res.json();
        const openPositions = data.open || [];
        setOpenPositionsCount(openPositions.length);
        setOpenPositionsValue(openPositions.reduce((sum: number, p: { amount: number; odds?: number; stake?: number }) => sum + (p.amount || p.stake || 0), 0));
      } catch (err) {
        console.error("Failed to fetch positions:", err);
      }
    };

    fetchPositions();
    const interval = setInterval(fetchPositions, 5000);
    return () => clearInterval(interval);
  }, []);

  // Fetch trading mode from backend on mount
  useEffect(() => {
    const fetchTradingMode = async () => {
      try {
        const res = await fetch("/api/account/mode");
        const data = await res.json();
        if (data.mode && (data.mode === "demo" || data.mode === "live")) {
          setTradingMode(data.mode);
          console.log("[App] Loaded trading mode from backend:", data.mode);
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
      // Competition just ended
      setShowSessionSummary(true);
    }
    prevCompetitionActive.current = competition?.active ?? false;
  }, [competition?.active, competition?.completedAt]);

  // Fetch trading mode on mount
  useEffect(() => {
    const fetchTradingMode = async () => {
      try {
        const res = await fetch("/api/account");
        const data = await res.json();
        setTradingMode(data.mode || "demo");
      } catch (err) {
        console.error("Failed to fetch trading mode:", err);
      }
    };
    fetchTradingMode();
  }, []);

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

  // Auto-switch to monitor tab when bots are running and we are not on a bot tab
  useEffect(() => {
    if (isBotRunning && activeTab === 'trade') {
      setActiveTab('monitor');
    }
  }, [isBotRunning]);

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
                btcPrice={marketData?.spotPrice}
                priceToBeat={marketData?.priceToBeat || marketData?.market?.priceToBeat}
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
            <BotTabsContent activeTab={activeTab} />
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

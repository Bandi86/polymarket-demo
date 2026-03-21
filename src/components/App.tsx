import { useState, useCallback, useEffect, useRef } from "react";
import { useTradingData } from "../hooks/useTradingData";
import { useSoundNotifications } from "../hooks/useSoundNotifications";
import { MarketCard } from "./MarketCard";
import { ChartPanel } from "./ChartPanel";
import { TradingPanel } from "./TradingPanel";
import { PositionsPanel } from "./PositionsPanel";
import { ActivityLog } from "./ActivityLog";
import { BotTabsContent } from "./BotDashboardPage";
import { TopDashboard, type TabId } from "./TopDashboard";
import { QuickActions } from "./quick-actions";
import { OrderBook } from "./OrderBook";
import { SessionSummaryModal } from "./SessionSummaryModal";
import { useToastActions } from "./ui/toast";

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
    fetchData,
    addTradeEvent,
  } = useTradingData();

  const { enabled: soundEnabled, playTrade, toggleEnabled: toggleSound } = useSoundNotifications();
  const toast = useToastActions();

  // Handle new bot trade notifications
  useEffect(() => {
    if (botLogs.length === 0) return;

    const latestLog = botLogs[0];
    if (latestLog.id === lastProcessedLogId.current) return;

    lastProcessedLogId.current = latestLog.id;

    // Only notify on TRADE type
    if (latestLog.type === "TRADE") {
      const details = latestLog.details || {};
      const outcome = details.outcome as string || "YES";
      const amount = details.amount as number || details.stake as number || 0;
      const price = details.price as number || details.avgPrice as number || 0;

      const isYes = outcome === "YES";
      playTrade();

      toast.success(
        `🤖 ${latestLog.botName}`,
        `${isYes ? "📈" : "📉"} ${isYes ? "Bought UP" : "Bought DOWN"} $${amount.toFixed(2)} @ ${(price * 100).toFixed(1)}¢`
      );
    }
  }, [botLogs, playTrade, toast]);

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

  // Show session summary when competition ends
  useEffect(() => {
    if (prevCompetitionActive.current && !competition?.active && competition?.completedAt) {
      // Competition just ended
      setShowSessionSummary(true);
    }
    prevCompetitionActive.current = competition?.active ?? false;
  }, [competition?.active, competition?.completedAt]);

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

  const handleReset = useCallback(async () => {
    await fetch("/api/reset", { method: "POST" });
    await fetch("/api/bots/reset-all", { method: "POST" });
    await fetch("/api/competition/clear", { method: "POST" });
    await fetchData();
  }, [fetchData]);

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
        onRunAll={handleToggleBot}
        onStopAll={handleToggleBot}
        competition={competition}
        openPositionsCount={openPositionsCount}
        openPositionsValue={openPositionsValue}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        selectedAsset={selectedAsset}
        onAssetChange={setSelectedAsset}
        selectedTimeframe={selectedTimeframe}
        onTimeframeChange={setSelectedTimeframe}
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

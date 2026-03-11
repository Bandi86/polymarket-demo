import { useState, useCallback, useEffect } from "react";
import { useTradingData } from "../hooks/useTradingData";
import { Header } from "./Header";
import { MarketPanel, type Coin, type Strategy, type Timeframe } from "./MarketPanel";
import { ChartPanel } from "./ChartPanel";
import { TradingPanel } from "./TradingPanel";
import { BotPanel } from "./BotPanel";
import { PortfolioPanel } from "./PortfolioPanel";
import { ActivityLog } from "./ActivityLog";
import { BotDashboardPage } from "./BotDashboardPage";

// Hash-based routing hook
function useRoute(): [string, (route: string) => void] {
  const [route, setRoute] = useState<string>(() => {
    if (typeof window === 'undefined') return 'trading';
    const hash = window.location.hash.slice(1);
    return hash === 'bots' ? 'bots' : 'trading';
  });

  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.slice(1);
      setRoute(hash === 'bots' ? 'bots' : 'trading');
    };
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  const navigate = useCallback((newRoute: string) => {
    window.location.hash = newRoute === 'trading' ? '' : newRoute;
    setRoute(newRoute);
  }, []);

  return [route, navigate];
}

const COINS = [
  { id: "BTC" as Coin, name: "Bitcoin", tvSymbol: "BINANCE:BTCUSDT", color: "#f7931a" },
  { id: "ETH" as Coin, name: "Ethereum", tvSymbol: "BINANCE:ETHUSDT", color: "#627eea" },
  { id: "SOL" as Coin, name: "Solana", tvSymbol: "BINANCE:SOLUSDT", color: "#14f195" },
  { id: "XRP" as Coin, name: "Ripple", tvSymbol: "BINANCE:XRPUSDT", color: "#346aa9" },
];

export function App() {
  // UI State
  const [selectedCoin, setSelectedCoin] = useState<Coin>("BTC");
  const [selectedStrategy, setSelectedStrategy] = useState<Strategy>("LN_EWMA");
  const [selectedTimeframe, setSelectedTimeframe] = useState<Timeframe>("5");
  const [route, navigate] = useRoute();

  // Trading data hook
  const {
    marketData,
    portfolio,
    bots,
    events,
    marketHistory,
    botLogs,
    loading,
    lastUpdate,
    apiLatency,
    isBotRunning,
    yesPrice,
    noPrice,
    yesPriceDirection,
    noPriceDirection,
    pnlHistory,
    fetchData,
    addTradeEvent,
  } = useTradingData();

  // Sync timeframe with backend when it changes
  useEffect(() => {
    const syncTimeframe = async () => {
      try {
        await fetch("/api/market/timeframe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ timeframe: selectedTimeframe }),
        });
      } catch (err) {
        console.error("Failed to sync timeframe:", err);
      }
    };
    syncTimeframe();
  }, [selectedTimeframe]);

  const activeCoin = COINS.find(c => c.id === selectedCoin);
  const coinColor = activeCoin?.color || "#f7931a";

  // Handle manual trade
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
      addTradeEvent({
        id: `evt-${Date.now()}`,
        type: "BUY",
        outcome: direction,
        amount,
        price: direction === "YES" ? yesPrice : noPrice,
        time: Date.now(),
      });
      await fetchData();
    }
  }, [marketData, yesPrice, noPrice, addTradeEvent, fetchData]);

  // Handle close position
  const handleClosePosition = useCallback(async (positionId: string) => {
    await fetch(`/api/positions/${positionId}/close`, { method: "POST" });
    await fetchData();
  }, [fetchData]);

  // Toggle bot
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

  // Reset everything
  const handleReset = useCallback(async () => {
    await fetch("/api/reset", { method: "POST" });
    await fetch("/api/bots/reset-all", { method: "POST" });
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

  // Bot Dashboard Route
  if (route === 'bots') {
    return (
      <div style={{ minHeight: "100vh", background: "var(--bg)" }}>
        <Header
          isBotRunning={isBotRunning}
          apiLatency={apiLatency}
          coinColor={coinColor}
          onRefresh={fetchData}
          showBackButton
          onBack={() => navigate('trading')}
          activeBots={bots.filter(b => b.enabled).length}
          totalBots={bots.length}
        />
        <main style={{ padding: "1rem", maxWidth: 1400, margin: "0 auto" }}>
          <BotDashboardPage />
        </main>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)" }}>
      <Header
        isBotRunning={isBotRunning}
        apiLatency={apiLatency}
        coinColor={coinColor}
        onRefresh={fetchData}
        onOpenDashboard={() => navigate('bots')}
        activeBots={bots.filter(b => b.enabled).length}
        totalBots={bots.length}
      />

      <main style={{ padding: "1rem" }}>
        <div className="trading-grid" style={{ maxWidth: 1600, margin: "0 auto" }}>
          {/* LEFT COLUMN - Market Info */}
          <MarketPanel
            marketData={marketData}
            selectedCoin={selectedCoin}
            selectedStrategy={selectedStrategy}
            selectedTimeframe={selectedTimeframe}
            lastUpdate={lastUpdate}
            yesPrice={yesPrice}
            noPrice={noPrice}
            yesPriceDirection={yesPriceDirection}
            noPriceDirection={noPriceDirection}
            coinColor={coinColor}
            onCoinChange={setSelectedCoin}
            onStrategyChange={setSelectedStrategy}
            onTimeframeChange={setSelectedTimeframe}
          />

          {/* CENTER COLUMN - Chart */}
          <ChartPanel
            marketData={marketData}
            marketHistory={marketHistory}
            selectedCoin={selectedCoin}
            selectedTimeframe={selectedTimeframe}
            coinColor={coinColor}
            tvSymbol={activeCoin?.tvSymbol || "BINANCE:BTCUSDT"}
            yesPrice={yesPrice}
            noPrice={noPrice}
          />

          {/* RIGHT COLUMN - Trading & Bot */}
          <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            <BotPanel
              bots={bots}
              isBotRunning={isBotRunning}
              botLogs={botLogs}
              coinColor={coinColor}
              onToggleBot={handleToggleBot}
            />

            <TradingPanel
              portfolio={portfolio}
              yesPrice={yesPrice}
              noPrice={noPrice}
              coinColor={coinColor}
              onTrade={handleTrade}
            />

            <PortfolioPanel
              portfolio={portfolio}
              coinColor={coinColor}
              pnlHistory={pnlHistory}
              onClosePosition={handleClosePosition}
              onReset={handleReset}
            />

            <ActivityLog events={events} coinColor={coinColor} />
          </div>
        </div>
      </main>
    </div>
  );
}

export default App;

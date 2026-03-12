import { useState, useCallback, useEffect } from "react";
import { useTradingData } from "../hooks/useTradingData";
import { Header } from "./Header";
import { MarketCard } from "./MarketCard";
import { ChartPanel } from "./ChartPanel";
import { TradingPanel } from "./TradingPanel";
import { PositionsPanel } from "./PositionsPanel";
import { ActivityLog } from "./ActivityLog";
import { BotDashboardPage } from "./BotDashboardPage";
import { QuickActions } from "./quick-actions";

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

const ASSETS = [
  { id: "BTC", name: "Bitcoin", color: "#f7931a" },
  { id: "ETH", name: "Ethereum", color: "#627eea" },
  { id: "SOL", name: "Solana", color: "#14f195" },
  { id: "XRP", name: "Ripple", color: "#346aa9" },
];

const TIMEFRAMES = [
  { id: "5", label: "5m", description: "5 minute markets" },
  { id: "15", label: "15m", description: "15 minute markets" },
  { id: "60", label: "1h", description: "1 hour markets" },
  { id: "240", label: "4h", description: "4 hour markets" },
];

export function App() {
  const [selectedAsset, setSelectedAsset] = useState("BTC");
  const [selectedTimeframe, setSelectedTimeframe] = useState("5");
  const [route, navigate] = useRoute();

  const {
    marketData,
    portfolio,
    bots,
    events,
    botLogs,
    loading,
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

      <main style={{ padding: "1rem", maxWidth: 1600, margin: "0 auto" }}>
        {/* Asset & Timeframe Selector Bar */}
        <div style={{
          display: "flex",
          alignItems: "center",
          gap: "1rem",
          marginBottom: "1rem",
          padding: "0.75rem 1rem",
          background: "var(--glass-bg)",
          borderRadius: 12,
          border: "1px solid var(--border)",
        }}>
          {/* Asset Selector */}
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <span style={{ fontSize: "0.875rem", color: "var(--text-muted)" }}>Asset:</span>
            <div style={{ display: "flex", gap: "0.25rem" }}>
              {ASSETS.map((asset) => (
                <button
                  key={asset.id}
                  onClick={() => setSelectedAsset(asset.id)}
                  style={{
                    padding: "0.375rem 0.75rem",
                    borderRadius: 6,
                    border: "none",
                    background: selectedAsset === asset.id ? `${asset.color}20` : "transparent",
                    color: selectedAsset === asset.id ? asset.color : "var(--text-muted)",
                    fontWeight: selectedAsset === asset.id ? 600 : 400,
                    cursor: "pointer",
                    fontSize: "0.875rem",
                    transition: "all 0.2s",
                  }}
                >
                  {asset.id}
                </button>
              ))}
            </div>
          </div>

          <div style={{ width: 1, height: 24, background: "var(--border)" }} />

          {/* Timeframe Selector */}
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <span style={{ fontSize: "0.875rem", color: "var(--text-muted)" }}>Market:</span>
            <div style={{ display: "flex", gap: "0.25rem" }}>
              {TIMEFRAMES.map((tf) => (
                <button
                  key={tf.id}
                  onClick={() => setSelectedTimeframe(tf.id)}
                  style={{
                    padding: "0.375rem 0.75rem",
                    borderRadius: 6,
                    border: "1px solid",
                    borderColor: selectedTimeframe === tf.id ? "var(--primary)" : "var(--border)",
                    background: selectedTimeframe === tf.id ? "var(--primary)" : "transparent",
                    color: selectedTimeframe === tf.id ? "white" : "var(--text-muted)",
                    fontWeight: selectedTimeframe === tf.id ? 600 : 400,
                    cursor: "pointer",
                    fontSize: "0.875rem",
                    transition: "all 0.2s",
                  }}
                >
                  {tf.label}
                </button>
              ))}
            </div>
          </div>

          <div style={{ flex: 1 }} />

          {/* Quick Stats */}
          <div style={{ display: "flex", alignItems: "center", gap: "1.5rem", fontSize: "0.875rem" }}>
            <div>
              <span style={{ color: "var(--text-muted)" }}>Balance: </span>
              <span style={{ fontFamily: "monospace", fontWeight: 600, color: "var(--green)" }}>
                ${(portfolio?.balance || 0).toFixed(2)}
              </span>
            </div>
            <div>
              <span style={{ color: "var(--text-muted)" }}>P&L: </span>
              <span style={{ fontFamily: "monospace", fontWeight: 600, color: (portfolio?.totalPnL || 0) >= 0 ? "var(--green)" : "var(--red)" }}>
                {(portfolio?.totalPnL || 0) >= 0 ? "+" : ""}${(portfolio?.totalPnL || 0).toFixed(2)}
              </span>
            </div>
          </div>
        </div>

        {/* Main Content Grid */}
        <div style={{
          display: "grid",
          gridTemplateColumns: "320px 1fr 360px",
          gap: "1rem",
          alignItems: "start",
        }}>
          {/* LEFT COLUMN - Market Card */}
          <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            <MarketCard
              marketData={marketData}
              yesPrice={yesPrice}
              noPrice={noPrice}
              yesPriceDirection={yesPriceDirection}
              noPriceDirection={noPriceDirection}
              coinColor={coinColor}
              selectedAsset={selectedAsset}
              selectedTimeframe={selectedTimeframe}
            />

            {/* Quick Actions */}
            <QuickActions
              isBotRunning={isBotRunning}
              onToggleBot={handleToggleBot}
              onReset={handleReset}
              coinColor={coinColor}
            />
          </div>

          {/* CENTER COLUMN - Chart */}
          <ChartPanel
            marketData={marketData}
            marketHistory={[]}
            selectedCoin={selectedAsset}
            selectedTimeframe={selectedTimeframe}
            coinColor={coinColor}
            tvSymbol={`BINANCE:${selectedAsset}USDT`}
            yesPrice={yesPrice}
            noPrice={noPrice}
          />

          {/* RIGHT COLUMN - Trading & Positions */}
          <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
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

            <ActivityLog events={events} coinColor={coinColor} />
          </div>
        </div>
      </main>
    </div>
  );
}

export default App;

import { useState, useEffect, useCallback } from "react";

interface Market {
  id: string;
  question: string;
  description: string;
  outcomePrices?: { yes: string; no: string };
}

interface Position {
  id: string;
  outcome: "YES" | "NO";
  amount: number;
  odds: number;
  currentValue?: number;
  unrealizedPnl?: number;
  pnl?: number;
  fee?: number;
}

interface Portfolio {
  balance: number;
  totalPnL: number;
  winRate: number;
  roi: number;
  openPositions: Position[];
  closedPositions: Position[];
}

interface Bot {
  id: string;
  name: string;
  type: string;
  enabled: boolean;
  betSize: number;
  interval: number;
  useKelly?: boolean;
  kellyFraction?: number;
  maxBet?: number;
  stats: { trades: number; wins: number; pnl: number; winRate: number };
  runTime: number;
}

interface MarketData {
  market: Market;
  btcPrice: number;
  priceHistory: number[];
  timeRemaining: number;
  marketDuration: number;
}

interface MarketHistory {
  id: string;
  result: "UP" | "DOWN";
  startPrice: number;
  endPrice: number;
  startTime: number;
  endTime: number;
}

interface TradeEvent {
  type: string;
  bot?: string;
  outcome?: string;
  amount?: number;
  pnl?: number;
  time: number;
}

interface Session {
  id: number;
  session_id: string;
  bot_id: string;
  bot_name: string;
  strategy: string;
  start_time: number;
  end_time: number | null;
  start_balance: number;
  end_balance: number | null;
  total_trades: number;
  winning_trades: number;
  total_pnl: number;
  status: string;
}

export function App() {
  const [marketData, setMarketData] = useState<MarketData | null>(null);
  const [portfolio, setPortfolio] = useState<Portfolio | null>(null);
  const [bots, setBots] = useState<Bot[]>([]);
  const [events, setEvents] = useState<TradeEvent[]>([]);
  const [marketHistory, setMarketHistory] = useState<MarketHistory[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [tradeAmount, setTradeAmount] = useState(1);
  const [loading, setLoading] = useState(true);
  const [runTimer, setRunTimer] = useState(0);
  const [activeTab, setActiveTab] = useState<"bots" | "history" | "sessions">("bots");
  const [useRealData, setUseRealData] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      const [mr, pr, br, er, mhr, sr, modeRes] = await Promise.all([
        fetch("/api/market"),
        fetch("/api/portfolio"),
        fetch("/api/bots"),
        fetch("/api/events"),
        fetch("/api/market/history"),
        fetch("/api/sessions"),
        fetch("/api/mode"),
      ]);
      setMarketData(await mr.json());
      setPortfolio(await pr.json());
      setBots(await br.json());
      setEvents(await er.json());
      setMarketHistory(await mhr.json());
      setSessions(await sr.json());
      const modeData = await modeRes.json();
      setUseRealData(modeData.useRealPolymarketData);
    } catch (err) {
      console.error("Fetch error:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 1000);
    return () => clearInterval(interval);
  }, [fetchData]);

  useEffect(() => {
    const runningBot = bots.find(b => b.enabled);
    if (runningBot) {
      const timer = setInterval(() => {
        setRunTimer(prev => prev + 1);
      }, 1000);
      return () => clearInterval(timer);
    } else {
      setRunTimer(0);
    }
  }, [bots]);

  const handleTrade = async (outcome: "YES" | "NO") => {
    if (!marketData?.market) return;
    try {
      await fetch("/api/trade", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ marketId: marketData.market.id, outcome, amount: tradeAmount }),
      });
      fetchData();
    } catch (err) { console.error("Trade failed:", err); }
  };

  const handleClosePosition = async (positionId: string) => {
    try {
      await fetch(`/api/positions/${positionId}/close`, { method: "POST" });
      fetchData();
    } catch (err) { console.error("Close failed:", err); }
  };

  const handleToggleBot = async (botId: string) => {
    try {
      await fetch(`/api/bots/${botId}/toggle`, { method: "POST" });
      fetchData();
    } catch (err) { console.error("Toggle failed:", err); }
  };

  const handleUpdateBot = async (botId: string, field: string, value: any) => {
    try {
      await fetch(`/api/bots/${botId}/config`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [field]: value }),
      });
      fetchData();
    } catch (err) { console.error("Update failed:", err); }
  };

  const handleRunTemplate = async (minutes: number) => {
    const botId = "bot-3";
    try {
      await fetch(`/api/bots/${botId}/config`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ useKelly: true, kellyFraction: 0.25, maxBet: 5 }),
      });
      await fetch(`/api/bots/${botId}/toggle`, { method: "POST" });
      setRunTimer(0);
      fetchData();
    } catch (err) { console.error("Run template failed:", err); }
  };

  const handleRefresh = async () => {
    try {
      await fetch("/api/market/refresh", { method: "POST" });
      fetchData();
    } catch (err) { console.error("Refresh failed:", err); }
  };

  const handleReset = async () => {
    try {
      await fetch("/api/reset", { method: "POST" });
      setRunTimer(0);
      fetchData();
    } catch (err) { console.error("Reset failed:", err); }
  };

  const fmt = (v: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(v);
  const fmtPct = (v: number) => `${(v * 100).toFixed(1)}%`;
  const fmtTime = (ms: number) => {
    const s = Math.floor(ms / 1000);
    return `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, "0")}`;
  };
  const fmtRunTime = (secs: number) => {
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = secs % 60;
    if (h > 0) {
      return `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
    }
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  if (loading || !marketData) {
    return <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh", background: "var(--bg-primary)", color: "var(--accent)" }}>Loading...</div>;
  }

  const progress = (marketData.timeRemaining / marketData.marketDuration) * 100;
  const isWarning = progress < 15;

  const totalBotTrades = bots.reduce((s, b) => s + b.stats.trades, 0);
  const totalBotWins = bots.reduce((s, b) => s + b.stats.wins, 0);
  const totalBotPnl = bots.reduce((s, b) => s + b.stats.pnl, 0);
  const activeBot = bots.find(b => b.enabled);

  return (
    <div className="container">
      <header className="header">
          <div className="logo">
            <div className="logo-icon">₿</div>
            <div><h1>Bitcoin Predictor</h1><p>Real-time price markets</p></div>
          </div>
        <div className="header-stats">
          <div className="stat-box"><div className="stat-label">Balance</div><div className={`stat-value ${(portfolio?.balance || 0) >= 10 ? "positive" : "negative"}`}>{fmt(portfolio?.balance || 0)}</div></div>
          <div className="stat-box"><div className="stat-label">P&L</div><div className={`stat-value ${(portfolio?.totalPnL || 0) >= 0 ? "positive" : "negative"}`}>{fmt(portfolio?.totalPnL || 0)}</div></div>
          {activeBot && <div className="stat-box"><div className="stat-label">Run Time</div><div className="stat-value" style={{ color: "var(--accent)" }}>{fmtRunTime(runTimer)}</div></div>}
        </div>
        <div className="header-actions">
          <button className="btn btn-primary" onClick={handleRefresh}>🔄 New Market</button>
          <button 
            className={`btn ${useRealData ? "btn-primary" : "btn-secondary"}`} 
            onClick={async () => {
              await fetch("/api/mode", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ useReal: !useRealData }),
              });
              fetchData();
            }}
          >
            {useRealData ? "🔗 Real Data" : "🎲 Simulated"}
          </button>
          <button className="btn btn-secondary" onClick={handleReset}>Reset</button>
        </div>
      </header>

      <div className="stats-row">
        <div className="stat-card">
          <div className="stat-card-label"><span className="api-status"><span className="api-dot"></span>BTC Price</span></div>
          <div className="stat-card-value" style={{ color: "var(--btc)" }}>${marketData.btcPrice.toLocaleString()}</div>
          <div className="stat-card-sub">{useRealData ? "🔗 Polymarket Live" : "🎲 Simulated"}</div>
        </div>
        <div className="stat-card">
          <div className="stat-card-label">Time Left</div>
          <div className="stat-card-value" style={{ color: isWarning ? "var(--red)" : "inherit" }}>{fmtTime(marketData.timeRemaining)}</div>
          <div className="stat-card-sub">{((marketData.timeRemaining / marketData.marketDuration) * 100).toFixed(0)}% remaining</div>
        </div>
        <div className="stat-card">
          <div className="stat-card-label">YES <span className="fee-badge">2% fee</span></div>
          <div className="stat-card-value" style={{ color: "var(--green)" }}>{marketData.market.outcomePrices?.yes || "0.50"}</div>
          <div className="stat-card-sub">Payout: {(1 / parseFloat(marketData.market.outcomePrices?.yes || "0.5")).toFixed(2)}x</div>
        </div>
        <div className="stat-card">
          <div className="stat-card-label">NO <span className="fee-badge">2% fee</span></div>
          <div className="stat-card-value" style={{ color: "var(--red)" }}>{marketData.market.outcomePrices?.no || "0.50"}</div>
          <div className="stat-card-sub">Payout: {(1 / parseFloat(marketData.market.outcomePrices?.no || "0.5")).toFixed(2)}x</div>
        </div>
        <div className="stat-card">
          <div className="stat-card-label">Open</div>
          <div className="stat-card-value">{portfolio?.openPositions.length || 0}</div>
          <div className="stat-card-sub">{portfolio?.closedPositions.length || 0} closed</div>
        </div>
        <div className="stat-card">
          <div className="stat-card-label">Win Rate</div>
          <div className="stat-card-value">{fmtPct(portfolio?.winRate || 0)}</div>
          <div className="stat-card-sub">{portfolio?.totalPnL && portfolio.totalPnL >= 0 ? "+" : ""}{fmt(portfolio?.totalPnL || 0)} P&L</div>
        </div>
      </div>

      <div className="main-grid">
        <div className="left-col" style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
          <div className="market-card">
            <div className="market-header">
              <div>
                <div className="market-title">
                  {marketData.market.question}
                  <span className="market-question-mark">?</span>
                </div>
                <div className="market-desc">{marketData.market.description}</div>
                <div className="market-meta">
                  <span className="market-meta-item">📊 Vol: ${(parseFloat(marketData.market.volumeNum || "0") / 1000).toFixed(1)}K</span>
                  <span className="market-meta-item">💧 Liq: ${(parseFloat(marketData.market.liquidity || "1000") / 1000).toFixed(1)}K</span>
                </div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div className={`timer-value ${isWarning ? "warning" : ""}`}>{fmtTime(marketData.timeRemaining)}</div>
                <div className="timer-label">Remaining</div>
              </div>
            </div>
            <div className="progress-bar">
              <div className="progress-fill" style={{ width: `${100 - progress}%` }} />
            </div>
            
            <div className="new-chart-container">
              <div className="chart-header">
                <span className="chart-title">Price History</span>
                <div className="chart-legend">
                  <span className="legend-item yes">YES</span>
                  <span className="legend-item no">NO</span>
                </div>
              </div>
              <div className="price-chart">
                <div className="chart-y-axis">
                  <span>100%</span>
                  <span>75%</span>
                  <span>50%</span>
                  <span>25%</span>
                  <span>0%</span>
                </div>
                <div className="chart-canvas">
                  <div className="chart-grid-lines">
                    {[25, 50, 75].map(p => (
                      <div key={p} className="grid-line" style={{ top: `${100 - p}%` }} />
                    ))}
                  </div>
                  {marketData.priceHistory.length > 1 && (
                    <svg className="price-line-svg" viewBox={`0 0 ${marketData.priceHistory.length} 100`} preserveAspectRatio="none">
                      <defs>
                        <linearGradient id="lineGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                          <stop offset="0%" stopColor="var(--green)" />
                          <stop offset="100%" stopColor="var(--green)" stopOpacity="0.3" />
                        </linearGradient>
                      </defs>
                      <polyline
                        fill="none"
                        stroke="var(--green)"
                        strokeWidth="2"
                        points={marketData.priceHistory.map((p, i) => `${i},${100 - p * 100}`).join(' ')}
                      />
                      <polygon
                        fill="url(#lineGradient)"
                        points={`0,100 ${marketData.priceHistory.map((p, i) => `${i},${100 - p * 100}`).join(' ')} ${marketData.priceHistory.length - 1},100`}
                        opacity="0.3"
                      />
                    </svg>
                  )}
                </div>
              </div>
              <div className="probability-bar-container">
                <div className="probability-label">Market Sentiment</div>
                <div className="probability-bar">
                  <div 
                    className="prob-yes" 
                    style={{ width: `${parseFloat(marketData.market.outcomePrices?.yes || "0.5") * 100}%` }}
                  >
                    <span>YES {((parseFloat(marketData.market.outcomePrices?.yes || "0.5")) * 100).toFixed(0)}%</span>
                  </div>
                  <div 
                    className="prob-no" 
                    style={{ width: `${parseFloat(marketData.market.outcomePrices?.no || "0.5") * 100}%` }}
                  >
                    <span>NO {((parseFloat(marketData.market.outcomePrices?.no || "0.5")) * 100).toFixed(0)}%</span>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="odds-row">
              <div className="odd-card yes">
                <div className="odd-label">YES</div>
                <div className="odd-value">{marketData.market.outcomePrices?.yes || "0.50"}</div>
                <div className="odd-payout">Cost: {fmt(tradeAmount)} → Win: {fmt(tradeAmount / parseFloat(marketData.market.outcomePrices?.yes || "0.5"))}</div>
                <div className="odd-fee">Fee: {fmt(tradeAmount * 0.02)}</div>
              </div>
              <div className="odd-card no">
                <div className="odd-label">NO</div>
                <div className="odd-value">{marketData.market.outcomePrices?.no || "0.50"}</div>
                <div className="odd-payout">Cost: {fmt(tradeAmount)} → Win: {fmt(tradeAmount / parseFloat(marketData.market.outcomePrices?.no || "0.5"))}</div>
                <div className="odd-fee">Fee: {fmt(tradeAmount * 0.02)}</div>
              </div>
            </div>
            <div className="trade-controls">
              <div className="amount-group">
                <label>Bet $</label>
                <input type="number" className="amount-input" value={tradeAmount} onChange={(e) => setTradeAmount(Math.max(0.1, Number(e.target.value)))} step="0.1" min="0.1" />
                <div className="quick-btns">
                  {[0.25, 0.5, 1, 2].map(a => <button key={a} className={`quick-btn ${tradeAmount === a ? "active" : ""}`} onClick={() => setTradeAmount(a)}>${a}</button>)}
                </div>
              </div>
              <div className="bet-btns">
                <button className="bet-btn yes" onClick={() => handleTrade("YES")} disabled={(portfolio?.balance || 0) < tradeAmount * 1.02}>🟢 YES</button>
                <button className="bet-btn no" onClick={() => handleTrade("NO")} disabled={(portfolio?.balance || 0) < tradeAmount * 1.02}>🔴 NO</button>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-header"><span className="card-title">📋 Open Positions</span></div>
            <div className="pos-list">
              {portfolio?.openPositions?.length ? portfolio.openPositions.map(pos => (
                <div key={pos.id} className={`pos-item ${pos.outcome.toLowerCase()}`}>
                  <div className="pos-left">
                    <span className={`pos-outcome ${pos.outcome.toLowerCase()}`}>{pos.outcome}</span>
                    <span className="pos-details">@{pos.odds.toFixed(2)} | {fmt(pos.amount)}</span>
                    {pos.fee && <span className="pos-fee">Fee: {fmt(pos.fee)}</span>}
                  </div>
                  <div className="pos-right">
                    <span className={`pos-pnl ${(pos.unrealizedPnl || 0) >= 0 ? "positive" : "negative"}`}>{fmt(pos.unrealizedPnl || 0)}</span>
                    <button className="close-btn" onClick={() => handleClosePosition(pos.id)}>Close</button>
                  </div>
                </div>
              )) : <div className="empty">No open positions</div>}
            </div>
          </div>

          <div className="card">
            <div className="card-header"><span className="card-title">📜 Trade History</span></div>
            <div className="hist-list">
              {portfolio?.closedPositions?.length ? portfolio.closedPositions.slice().reverse().slice(0, 12).map(pos => (
                <div key={pos.id} className="hist-item">
                  <span className={`hist-outcome ${pos.outcome.toLowerCase()}`}>{pos.outcome}</span>
                  <span className="hist-odds">@{pos.odds.toFixed(2)}</span>
                  <span className={`hist-pnl ${(pos.pnl || 0) >= 0 ? "positive" : "negative"}`}>{fmt(pos.pnl || 0)}</span>
                </div>
              )) : <div className="empty">No closed positions</div>}
            </div>
          </div>
        </div>

        <div className="sidebar">
          <div className="card">
            <div className="card-header"><span className="card-title">⚡ Quick Run Templates</span></div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem" }}>
              <button className="quick-btn active" style={{ padding: "0.5rem" }} onClick={() => handleRunTemplate(5)}>▶ 5 min</button>
              <button className="quick-btn active" style={{ padding: "0.5rem" }} onClick={() => handleRunTemplate(10)}>▶ 10 min</button>
              <button className="quick-btn active" style={{ padding: "0.5rem" }} onClick={() => handleRunTemplate(15)}>▶ 15 min</button>
              <button className="quick-btn active" style={{ padding: "0.5rem" }} onClick={() => handleRunTemplate(30)}>▶ 30 min</button>
            </div>
            <div style={{ marginTop: "0.75rem", fontSize: "0.7rem", color: "var(--text-muted)" }}>
              Uses Kelly Criterion with 25% fraction, max $5 bet
            </div>
          </div>

          <div className="card">
            <div className="card-header">
              <button className={`tab-btn ${activeTab === "bots" ? "active" : ""}`} onClick={() => setActiveTab("bots")}>🤖 Bots</button>
              <button className={`tab-btn ${activeTab === "history" ? "active" : ""}`} onClick={() => setActiveTab("history")}>📈 History</button>
              <button className={`tab-btn ${activeTab === "sessions" ? "active" : ""}`} onClick={() => setActiveTab("sessions")}>📊 Sessions</button>
            </div>
            
            {activeTab === "bots" && (
              <div className="bot-list">
                {bots.map(bot => (
                  <div key={bot.id} className={`bot-item ${bot.enabled ? "active" : ""}`}>
                    <div className="bot-header">
                      <span className="bot-name">{bot.name}</span>
                      <button className={`bot-btn ${bot.enabled ? "stop" : "start"}`} onClick={() => handleToggleBot(bot.id)}>
                        {bot.enabled ? "⏹ STOP" : "▶ START"}
                      </button>
                    </div>
                    <div className="bot-config">
                      <input type="number" value={bot.betSize} onChange={(e) => handleUpdateBot(bot.id, "betSize", Number(e.target.value))} placeholder="Bet $" step="0.1" min="0.1" />
                      <input type="number" value={bot.interval / 1000} onChange={(e) => handleUpdateBot(bot.id, "interval", Number(e.target.value) * 1000)} placeholder="Sec" min="1" />
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.4rem" }}>
                      <label style={{ fontSize: "0.65rem", color: "var(--text-secondary)" }}>Kelly</label>
                      <input type="checkbox" checked={bot.useKelly || false} onChange={(e) => handleUpdateBot(bot.id, "useKelly", e.target.checked)} />
                    </div>
                    <div className="bot-stats">
                      <span className="bot-stat">Trades: {bot.stats.trades}</span>
                      <span className={`bot-stat ${bot.stats.winRate >= 0.5 ? "positive" : "negative"}`}>WR: {fmtPct(bot.stats.winRate)}</span>
                      <span className={`bot-stat ${bot.stats.pnl >= 0 ? "positive" : "negative"}`}>P&L: {fmt(bot.stats.pnl)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {activeTab === "history" && (
              <div className="history-list">
                {marketHistory.length ? marketHistory.map((m, i) => (
                  <div key={i} className="hist-item">
                    <span style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>#{marketHistory.length - i}</span>
                    <span className={`hist-outcome ${m.result.toLowerCase()}`} style={{ fontWeight: 700 }}>{m.result}</span>
                    <span className="hist-odds">${m.startPrice.toLocaleString()} → ${m.endPrice.toLocaleString()}</span>
                  </div>
                )) : <div className="empty">No completed markets</div>}
              </div>
            )}

            {activeTab === "sessions" && (
              <div className="history-list">
                {sessions.length ? sessions.slice(0, 10).map(s => (
                  <div key={s.id} className="hist-item" style={{ flexDirection: "column", alignItems: "flex-start", gap: "0.25rem" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", width: "100%" }}>
                      <span style={{ fontWeight: 600 }}>{s.bot_name}</span>
                      <span style={{ color: s.total_pnl >= 0 ? "var(--green)" : "var(--red)" }}>{fmt(s.total_pnl)}</span>
                    </div>
                    <div style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>
                      {new Date(s.start_time).toLocaleString()} | {s.total_trades} trades | {fmtPct(s.winning_trades / (s.total_trades || 1))} WR
                    </div>
                  </div>
                )) : <div className="empty">No sessions recorded</div>}
              </div>
            )}
          </div>

          <div className="card">
            <div className="card-header"><span className="card-title">⚡ Live Activity</span></div>
            <div className="feed">
              {events.length ? events.map((e, i) => (
                <div key={i} className={`feed-item ${e.type}`}>
                  <span className="feed-time">{new Date(e.time).toLocaleTimeString()}</span>
                  <span>{e.type === "trade" && `🤖 ${e.bot} bet ${e.outcome} $${e.amount?.toFixed(2)}`}</span>
                  <span>{e.type === "manual_trade" && `👆 Manual ${e.outcome} $${e.amount?.toFixed(2)}`}</span>
                  <span>{e.type === "bot_started" && `▶️ ${e.bot} started`}</span>
                  <span>{e.type === "bot_stopped" && `⏹️ ${e.bot} stopped`}</span>
                  <span>{e.type === "market_settled" && `🎯 Settled: ${e.outcome}`}</span>
                </div>
              )) : <div className="empty">No activity yet</div>}
            </div>
          </div>

          <div className="card">
            <div className="card-header"><span className="card-title">📊 Bot Summary</span></div>
            <div className="summary-grid">
              <div className="summary-item"><div className="summary-label">Trades</div><div className="summary-value">{totalBotTrades}</div></div>
              <div className="summary-item"><div className="summary-label">Wins</div><div className="summary-value green">{totalBotWins}</div></div>
              <div className="summary-item"><div className="summary-label">Win Rate</div><div className="summary-value">{totalBotTrades > 0 ? fmtPct(totalBotWins / totalBotTrades) : "0%"}</div></div>
              <div className="summary-item"><div className="summary-label">Bot P&L</div><div className={`summary-value ${totalBotPnl >= 0 ? "green" : "red"}`}>{fmt(totalBotPnl)}</div></div>
            </div>
          </div>
        </div>
      </div>

      <footer className="footer">
        <div><span className="status-dot"></span>Live | BTC: ${marketData.btcPrice.toLocaleString()} | Source: CoinGecko API</div>
        <div>Balance: {fmt(portfolio?.balance || 0)} | Fee: 2% | ROI: <span style={{ color: (portfolio?.roi || 0) >= 0 ? "var(--green)" : "var(--red)" }}>{fmtPct(portfolio?.roi || 0)}</span></div>
      </footer>
    </div>
  );
}

export default App;

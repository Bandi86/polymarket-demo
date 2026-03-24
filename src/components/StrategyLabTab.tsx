'use client'

import { useState } from "react";
import { FlaskConical, Play, BarChart3, TrendingUp, TrendingDown, Zap } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { MiniEquityCurve } from "@/components/charts/MiniEquityCurve";

interface BacktestResult {
  strategy: string;
  strategyName: string;
  totalTrades: number;
  winRate: number;
  totalReturn: number;
  maxDrawdown: number;
  sharpeRatio: number;
  avgWin: number;
  avgLoss: number;
  profitFactor: number;
  equityCurve: number[];
  startBalance: number;
  endBalance: number;
  calmarRatio: number;
}

const AVAILABLE_STRATEGIES = [
  { id: "momentum_chaser", name: "Momentum Chaser", color: "#f59e0b" },
  { id: "mean_reversion_sniper", name: "Mean Reversion Sniper", color: "#8b5cf6" },
  { id: "sum_to_one_arb", name: "Sum-to-One Arbitrage", color: "#3b82f6" },
  { id: "whale_follower", name: "Whale Follower", color: "#06b6d4" },
  { id: "ta_signal_engine", name: "TA Signal Engine", color: "#22c55e" },
  { id: "market_maker", name: "Market Maker", color: "#ef4444" },
];



export function StrategyLabTab() {
  const [results, setResults] = useState<BacktestResult[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [selectedStrategies, setSelectedStrategies] = useState<Set<string>>(
    new Set(AVAILABLE_STRATEGIES.map(s => s.id))
  );
  const [numMarkets, setNumMarkets] = useState(50);
  const [betSize, setBetSize] = useState(1);
  const [startBalance, setStartBalance] = useState(10);
  const [slippageEnabled, setSlippageEnabled] = useState(true);
  const [expandedResult, setExpandedResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const toggleStrategy = (id: string) => {
    const next = new Set(selectedStrategies);
    if (next.has(id)) {
      if (next.size > 1) next.delete(id);
    } else {
      next.add(id);
    }
    setSelectedStrategies(next);
  };

  const runBacktest = async () => {
    setIsRunning(true);
    setError(null);

    try {
      const res = await fetch("/api/backtest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          strategies: Array.from(selectedStrategies),
          startBalance,
          betSize,
          numMarkets,
          slippageEnabled,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setResults(data.results);
      } else {
        setError(data.error || "Backtest failed");
      }
    } catch (err) {
      setError("Network error — is the server running?");
    } finally {
      setIsRunning(false);
    }
  };

  const bestResult = results.length > 0 ? results[0] : null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      {/* Header */}
      <div className="glass-card" style={{ padding: "1rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.5rem" }}>
          <FlaskConical className="w-5 h-5" style={{ color: "#8b5cf6" }} />
          <h2 style={{ margin: 0, fontSize: "1.125rem", fontWeight: 600 }}>Strategy Backtest Lab</h2>
        </div>
        <p style={{ margin: 0, fontSize: "0.875rem", color: "var(--text-secondary)" }}>
          Run strategies against simulated 5-minute markets with realistic slippage and fees.
          Results use the same strategy logic that powers live bot execution.
        </p>
      </div>

      {/* Config Panel */}
      <div className="glass-card" style={{ padding: "1rem" }}>
        <h3 style={{ margin: "0 0 1rem", fontSize: "0.875rem", fontWeight: 600, color: "var(--text-secondary)" }}>
          Configuration
        </h3>

        {/* Strategy Selection */}
        <div style={{ marginBottom: "1rem" }}>
          <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginBottom: "0.5rem" }}>Strategies</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.375rem" }}>
            {AVAILABLE_STRATEGIES.map(s => (
              <button
                key={s.id}
                onClick={() => toggleStrategy(s.id)}
                style={{
                  padding: "0.375rem 0.75rem",
                  borderRadius: 6,
                  border: selectedStrategies.has(s.id) ? `1px solid ${s.color}` : "1px solid var(--border)",
                  background: selectedStrategies.has(s.id) ? `${s.color}15` : "transparent",
                  color: selectedStrategies.has(s.id) ? s.color : "var(--text-muted)",
                  fontSize: "0.75rem",
                  cursor: "pointer",
                  fontWeight: selectedStrategies.has(s.id) ? 600 : 400,
                  transition: "all 0.2s",
                }}
              >
                {s.name}
              </button>
            ))}
          </div>
        </div>

        {/* Parameters */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: "1rem" }}>
          <div>
            <label style={{ display: "block", fontSize: "0.75rem", color: "var(--text-muted)", marginBottom: "0.25rem" }}>
              Markets to simulate
            </label>
            <input
              type="number"
              value={numMarkets}
              onChange={e => setNumMarkets(Math.max(10, parseInt(e.target.value) || 10))}
              min={10}
              max={500}
              style={{
                width: "100%",
                padding: "0.5rem",
                borderRadius: 6,
                border: "1px solid var(--border)",
                background: "rgba(0,0,0,0.2)",
                color: "var(--text-primary)",
                fontFamily: "ui-monospace, monospace",
                fontSize: "0.875rem",
              }}
            />
          </div>
          <div>
            <label style={{ display: "block", fontSize: "0.75rem", color: "var(--text-muted)", marginBottom: "0.25rem" }}>
              Bet Size ($)
            </label>
            <input
              type="number"
              value={betSize}
              onChange={e => setBetSize(Math.max(0.1, parseFloat(e.target.value) || 0.1))}
              min={0.1}
              max={100}
              step={0.1}
              style={{
                width: "100%",
                padding: "0.5rem",
                borderRadius: 6,
                border: "1px solid var(--border)",
                background: "rgba(0,0,0,0.2)",
                color: "var(--text-primary)",
                fontFamily: "ui-monospace, monospace",
                fontSize: "0.875rem",
              }}
            />
          </div>
          <div>
            <label style={{ display: "block", fontSize: "0.75rem", color: "var(--text-muted)", marginBottom: "0.25rem" }}>
              Starting Balance ($)
            </label>
            <input
              type="number"
              value={startBalance}
              onChange={e => setStartBalance(Math.max(1, parseFloat(e.target.value) || 1))}
              min={1}
              max={10000}
              style={{
                width: "100%",
                padding: "0.5rem",
                borderRadius: 6,
                border: "1px solid var(--border)",
                background: "rgba(0,0,0,0.2)",
                color: "var(--text-primary)",
                fontFamily: "ui-monospace, monospace",
                fontSize: "0.875rem",
              }}
            />
          </div>
          <div style={{ display: "flex", flexDirection: "column", justifyContent: "flex-end" }}>
            <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", cursor: "pointer" }}>
              <input
                type="checkbox"
                checked={slippageEnabled}
                onChange={e => setSlippageEnabled(e.target.checked)}
                style={{ accentColor: "#8b5cf6" }}
              />
              <span style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>
                Slippage & Spread
              </span>
            </label>
          </div>
        </div>
      </div>

      {/* Run Button */}
      <button
        onClick={runBacktest}
        disabled={isRunning}
        style={{
          padding: "1rem",
          borderRadius: 12,
          border: "none",
          background: isRunning ? "var(--glass-bg)" : "linear-gradient(135deg, #8b5cf6, #7c3aed)",
          color: "white",
          fontSize: "1rem",
          fontWeight: 600,
          cursor: isRunning ? "not-allowed" : "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: "0.5rem",
          opacity: isRunning ? 0.7 : 1,
          transition: "all 0.3s",
        }}
      >
        {isRunning ? (
          <>
            <div className="loading-spinner" style={{ width: 16, height: 16 }} />
            Running Backtest ({numMarkets} markets)...
          </>
        ) : (
          <>
            <Play className="w-4 h-4" fill="currentColor" />
            Run Backtest ({selectedStrategies.size} strategies × {numMarkets} markets)
          </>
        )}
      </button>

      {error && (
        <div style={{
          padding: "0.75rem 1rem",
          background: "rgba(239, 68, 68, 0.1)",
          border: "1px solid rgba(239, 68, 68, 0.3)",
          borderRadius: 8,
          color: "#ef4444",
          fontSize: "0.875rem",
        }}>
          {error}
        </div>
      )}

      {/* Results */}
      {results.length > 0 && (
        <>
          {/* Summary Stats */}
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
            gap: "0.75rem",
          }}>
            <div className="glass-card" style={{ padding: "1rem", textAlign: "center" }}>
              <div style={{ fontSize: "0.625rem", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                Best Strategy
              </div>
              <div style={{ fontWeight: 700, fontSize: "1.125rem", color: "#22c55e", marginTop: "0.25rem" }}>
                {bestResult?.strategyName}
              </div>
              <div style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>
                {(bestResult?.winRate || 0) * 100 > 0 ? `${((bestResult?.winRate || 0) * 100).toFixed(0)}% win rate` : ""}
              </div>
            </div>
            <div className="glass-card" style={{ padding: "1rem", textAlign: "center" }}>
              <div style={{ fontSize: "0.625rem", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                Best Return
              </div>
              <div style={{
                fontWeight: 700,
                fontSize: "1.125rem",
                fontFamily: "ui-monospace, monospace",
                color: (bestResult?.totalReturn || 0) >= 0 ? "#22c55e" : "#ef4444",
                marginTop: "0.25rem",
              }}>
                {(bestResult?.totalReturn || 0) >= 0 ? "+" : ""}{formatCurrency(bestResult?.totalReturn || 0)}
              </div>
            </div>
            <div className="glass-card" style={{ padding: "1rem", textAlign: "center" }}>
              <div style={{ fontSize: "0.625rem", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                Total Trades
              </div>
              <div style={{
                fontWeight: 700,
                fontSize: "1.125rem",
                fontFamily: "ui-monospace, monospace",
                marginTop: "0.25rem",
              }}>
                {results.reduce((s, r) => s + r.totalTrades, 0)}
              </div>
            </div>
            <div className="glass-card" style={{ padding: "1rem", textAlign: "center" }}>
              <div style={{ fontSize: "0.625rem", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                Profitable
              </div>
              <div style={{
                fontWeight: 700,
                fontSize: "1.125rem",
                fontFamily: "ui-monospace, monospace",
                marginTop: "0.25rem",
              }}>
                {results.filter(r => r.totalReturn > 0).length}/{results.length}
              </div>
            </div>
          </div>

          {/* Results Table */}
          <div className="glass-card" style={{ padding: "1rem", overflowX: "auto" }}>
            <h3 style={{ margin: "0 0 1rem", fontSize: "0.875rem", fontWeight: 600, display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <BarChart3 className="w-4 h-4" style={{ color: "#8b5cf6" }} />
              Results Ranking
            </h3>

            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.8rem" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid var(--border)" }}>
                  <th style={{ textAlign: "left", padding: "0.5rem", color: "var(--text-muted)", fontWeight: 500, fontSize: "0.7rem" }}>#</th>
                  <th style={{ textAlign: "left", padding: "0.5rem", color: "var(--text-muted)", fontWeight: 500, fontSize: "0.7rem" }}>Strategy</th>
                  <th style={{ textAlign: "center", padding: "0.5rem", color: "var(--text-muted)", fontWeight: 500, fontSize: "0.7rem" }}>Equity</th>
                  <th style={{ textAlign: "right", padding: "0.5rem", color: "var(--text-muted)", fontWeight: 500, fontSize: "0.7rem" }}>Trades</th>
                  <th style={{ textAlign: "right", padding: "0.5rem", color: "var(--text-muted)", fontWeight: 500, fontSize: "0.7rem" }}>Win%</th>
                  <th style={{ textAlign: "right", padding: "0.5rem", color: "var(--text-muted)", fontWeight: 500, fontSize: "0.7rem" }}>Return</th>
                  <th style={{ textAlign: "right", padding: "0.5rem", color: "var(--text-muted)", fontWeight: 500, fontSize: "0.7rem" }}>Sharpe</th>
                  <th style={{ textAlign: "right", padding: "0.5rem", color: "var(--text-muted)", fontWeight: 500, fontSize: "0.7rem" }}>Max DD</th>
                  <th style={{ textAlign: "right", padding: "0.5rem", color: "var(--text-muted)", fontWeight: 500, fontSize: "0.7rem" }}>PF</th>
                </tr>
              </thead>
              <tbody>
                {results.map((result, idx) => {
                  const stratInfo = AVAILABLE_STRATEGIES.find(s => s.id === result.strategy);
                  const isExpanded = expandedResult === result.strategy;

                  return (
                    <>
                      <tr
                        key={result.strategy}
                        onClick={() => setExpandedResult(isExpanded ? null : result.strategy)}
                        style={{
                          borderBottom: "1px solid var(--border)",
                          background: idx === 0 ? "rgba(34, 197, 94, 0.05)" : "transparent",
                          cursor: "pointer",
                          transition: "background 0.2s",
                        }}
                      >
                        <td style={{ padding: "0.5rem", fontWeight: 600 }}>
                          {idx === 0 ? "🏆" : idx + 1}
                        </td>
                        <td style={{ padding: "0.5rem" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                            <div style={{
                              width: 8, height: 8, borderRadius: "50%",
                              background: stratInfo?.color || "#666"
                            }} />
                            <span style={{ fontWeight: idx === 0 ? 600 : 400 }}>
                              {result.strategyName}
                            </span>
                          </div>
                        </td>
                        <td style={{ padding: "0.5rem" }}>
                          <MiniEquityCurve
                            data={result.equityCurve}
                            color={stratInfo?.color || "#666"}
                            size={24}
                          />
                        </td>
                        <td style={{ padding: "0.5rem", textAlign: "right", fontFamily: "ui-monospace, monospace" }}>
                          {result.totalTrades}
                        </td>
                        <td style={{
                          padding: "0.5rem", textAlign: "right",
                          fontFamily: "ui-monospace, monospace",
                          color: result.winRate >= 0.5 ? "#22c55e" : "#ef4444"
                        }}>
                          {(result.winRate * 100).toFixed(0)}%
                        </td>
                        <td style={{
                          padding: "0.5rem", textAlign: "right",
                          fontFamily: "ui-monospace, monospace",
                          fontWeight: 600,
                          color: result.totalReturn >= 0 ? "#22c55e" : "#ef4444"
                        }}>
                          {result.totalReturn >= 0 ? "+" : ""}{formatCurrency(result.totalReturn)}
                        </td>
                        <td style={{
                          padding: "0.5rem", textAlign: "right",
                          fontFamily: "ui-monospace, monospace",
                          color: result.sharpeRatio >= 1 ? "#22c55e" : result.sharpeRatio >= 0 ? "inherit" : "#ef4444"
                        }}>
                          {result.sharpeRatio.toFixed(2)}
                        </td>
                        <td style={{
                          padding: "0.5rem", textAlign: "right",
                          fontFamily: "ui-monospace, monospace",
                          color: result.maxDrawdown > 20 ? "#ef4444" : result.maxDrawdown > 10 ? "#f59e0b" : "inherit"
                        }}>
                          -{result.maxDrawdown.toFixed(1)}%
                        </td>
                        <td style={{
                          padding: "0.5rem", textAlign: "right",
                          fontFamily: "ui-monospace, monospace",
                          color: result.profitFactor >= 1.5 ? "#22c55e" : result.profitFactor >= 1 ? "inherit" : "#ef4444"
                        }}>
                          {result.profitFactor > 10 ? "∞" : result.profitFactor.toFixed(2)}
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr key={`${result.strategy}-detail`}>
                          <td colSpan={9} style={{ padding: "0.75rem", background: "rgba(0,0,0,0.2)" }}>
                            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: "0.75rem", marginBottom: "0.75rem" }}>
                              <div>
                                <div style={{ fontSize: "0.625rem", color: "var(--text-muted)" }}>Start Balance</div>
                                <div style={{ fontFamily: "ui-monospace, monospace", fontWeight: 600 }}>{formatCurrency(result.startBalance)}</div>
                              </div>
                              <div>
                                <div style={{ fontSize: "0.625rem", color: "var(--text-muted)" }}>End Balance</div>
                                <div style={{ fontFamily: "ui-monospace, monospace", fontWeight: 600, color: result.endBalance >= result.startBalance ? "#22c55e" : "#ef4444" }}>
                                  {formatCurrency(result.endBalance)}
                                </div>
                              </div>
                              <div>
                                <div style={{ fontSize: "0.625rem", color: "var(--text-muted)" }}>Avg Win</div>
                                <div style={{ fontFamily: "ui-monospace, monospace", color: "#22c55e" }}>+{formatCurrency(result.avgWin)}</div>
                              </div>
                              <div>
                                <div style={{ fontSize: "0.625rem", color: "var(--text-muted)" }}>Avg Loss</div>
                                <div style={{ fontFamily: "ui-monospace, monospace", color: "#ef4444" }}>-{formatCurrency(result.avgLoss)}</div>
                              </div>
                              <div>
                                <div style={{ fontSize: "0.625rem", color: "var(--text-muted)" }}>Calmar Ratio</div>
                                <div style={{ fontFamily: "ui-monospace, monospace" }}>{result.calmarRatio.toFixed(2)}</div>
                              </div>
                              <div>
                                <div style={{ fontSize: "0.625rem", color: "var(--text-muted)" }}>ROI</div>
                                <div style={{
                                  fontFamily: "ui-monospace, monospace",
                                  fontWeight: 600,
                                  color: result.totalReturn >= 0 ? "#22c55e" : "#ef4444"
                                }}>
                                  {((result.endBalance - result.startBalance) / result.startBalance * 100).toFixed(1)}%
                                </div>
                              </div>
                            </div>

                            {/* Large Equity Curve */}
                            <div style={{ padding: "0.5rem", background: "rgba(0,0,0,0.15)", borderRadius: 8 }}>
                              <div style={{ fontSize: "0.625rem", color: "var(--text-muted)", marginBottom: "0.25rem" }}>Equity Curve</div>
                              <MiniEquityCurve
                                data={result.equityCurve}
                                color={stratInfo?.color || "#666"}
                                size={60}
                              />
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Slippage Notice */}
          <div style={{
            padding: "0.75rem 1rem",
            background: "rgba(139, 92, 246, 0.1)",
            borderRadius: 8,
            border: "1px solid rgba(139, 92, 246, 0.2)",
            display: "flex",
            gap: "0.5rem",
            alignItems: "flex-start",
          }}>
            <Zap className="w-4 h-4" style={{ color: "#8b5cf6", flexShrink: 0, marginTop: "0.125rem" }} />
            <div style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>
              {slippageEnabled ? (
                <>Results include <strong style={{ color: "#8b5cf6" }}>realistic slippage</strong> (1% spread + random slippage + size impact) and 2% fees.</>
              ) : (
                <>Results <strong style={{ color: "#f59e0b" }}>do NOT include slippage</strong> — real performance will be worse. Enable slippage for accurate estimates.</>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
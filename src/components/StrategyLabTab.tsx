import { useState, useEffect, useMemo } from "react";
import { FlaskConical, Play, AlertCircle, ChevronDown, ChevronUp } from "lucide-react";
import { formatCurrency } from "../lib/utils";

interface BacktestResult {
  strategy: string;
  totalTrades: number;
  winRate: number;
  totalReturn: number;
  maxDrawdown: number;
  sharpeRatio: number;
  avgWin: number;
  avgLoss: number;
  profitFactor: number;
}

interface StrategyConfig {
  id: string;
  name: string;
  type: string;
  description: string;
  parameters: {
    name: string;
    type: "number" | "select";
    default: number | string;
    options?: string[];
    min?: number;
    max?: number;
    step?: number;
  }[];
}

const STRATEGIES: StrategyConfig[] = [
  {
    id: "momentum",
    name: "Momentum",
    type: "trend",
    description: "Follows price momentum direction",
    parameters: [
      { name: "threshold", type: "number", default: 0.02, min: 0.01, max: 0.1, step: 0.01 },
      { name: "lookback", type: "number", default: 5, min: 3, max: 20, step: 1 }
    ]
  },
  {
    id: "mean_reversion",
    name: "Mean Reversion",
    type: "mean_reversion",
    description: "Bets against extreme price movements",
    parameters: [
      { name: "threshold", type: "number", default: 0.1, min: 0.05, max: 0.3, step: 0.05 }
    ]
  },
  {
    id: "volatility",
    name: "Volatility",
    type: "other",
    description: "Trades based on price volatility",
    parameters: [
      { name: "minVolatility", type: "number", default: 0.01, min: 0.005, max: 0.05, step: 0.005 }
    ]
  },
  {
    id: "fair_value",
    name: "Fair Value",
    type: "other",
    description: "Exploits price deviations from 0.5",
    parameters: [
      { name: "edge", type: "number", default: 0.05, min: 0.02, max: 0.15, step: 0.01 }
    ]
  },
  {
    id: "contrarian",
    name: "Contrarian",
    type: "mean_reversion",
    description: "Bets against crowd sentiment",
    parameters: [
      { name: "threshold", type: "number", default: 0.7, min: 0.6, max: 0.9, step: 0.05 }
    ]
  }
];

export function StrategyLabTab() {
  const [selectedStrategy, setSelectedStrategy] = useState<StrategyConfig>(STRATEGIES[0]);
  const [parameters, setParameters] = useState<Record<string, Record<string, number | string>>>({});
  const [backtestResults, setBacktestResults] = useState<BacktestResult[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [expandedStrategy, setExpandedStrategy] = useState<string | null>(null);

  // Initialize parameters for each strategy
  useEffect(() => {
    const params: Record<string, Record<string, number | string>> = {};
    STRATEGIES.forEach(s => {
      params[s.id] = {};
      s.parameters.forEach(p => {
        params[s.id][p.name] = p.default;
      });
    });
    setParameters(params);
  }, []);

  // Mock backtest function - in real app would call backend
  const runBacktest = async () => {
    setIsRunning(true);
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1500));

    // Generate mock results
    const results: BacktestResult[] = STRATEGIES.map(s => {
      const winRate = 0.45 + Math.random() * 0.2;
      const totalTrades = Math.floor(50 + Math.random() * 100);
      const avgWin = 1.5 + Math.random() * 0.5;
      const avgLoss = 1 + Math.random() * 0.5;
      const profitFactor = (winRate * avgWin) / ((1 - winRate) * avgLoss);
      const totalReturn = (winRate * totalTrades * avgWin) - ((1 - winRate) * totalTrades * avgLoss);

      return {
        strategy: s.id,
        totalTrades,
        winRate,
        totalReturn,
        maxDrawdown: 5 + Math.random() * 15,
        sharpeRatio: -0.5 + Math.random() * 2,
        avgWin,
        avgLoss,
        profitFactor
      };
    });

    setBacktestResults(results);
    setIsRunning(false);
  };

  const sortedResults = useMemo(() => {
    return [...backtestResults].sort((a, b) => b.totalReturn - a.totalReturn);
  }, [backtestResults]);

  const getStrategyConfig = (id: string) => STRATEGIES.find(s => s.id === id);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      {/* Header */}
      <div className="glass-card" style={{ padding: "1rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.5rem" }}>
          <FlaskConical className="w-5 h-5" style={{ color: "#8b5cf6" }} />
          <h2 style={{ margin: 0, fontSize: "1.125rem", fontWeight: 600 }}>Strategy Lab</h2>
        </div>
        <p style={{ margin: 0, fontSize: "0.875rem", color: "var(--text-secondary)" }}>
          Experiment with different strategies and run backtests to compare performance.
        </p>
      </div>

      {/* Strategy Selector */}
      <div className="glass-card" style={{ padding: "1rem" }}>
        <h3 style={{ margin: "0 0 1rem", fontSize: "0.875rem", fontWeight: 600, color: "var(--text-secondary)" }}>
          Available Strategies
        </h3>
        <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
          {STRATEGIES.map(strategy => {
            const isSelected = selectedStrategy.id === strategy.id;
            const isExpanded = expandedStrategy === strategy.id;

            return (
              <div
                key={strategy.id}
                style={{
                  border: isSelected ? "1px solid #8b5cf6" : "1px solid var(--border)",
                  borderRadius: 8,
                  overflow: "hidden"
                }}
              >
                <div
                  onClick={() => {
                    setSelectedStrategy(strategy);
                    setExpandedStrategy(isExpanded ? null : strategy.id);
                  }}
                  style={{
                    padding: "0.75rem",
                    background: isSelected ? "rgba(139, 92, 246, 0.1)" : "transparent",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between"
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                    <div style={{
                      width: 8,
                      height: 8,
                      borderRadius: "50%",
                      background: strategy.type === "trend" ? "#22c55e" :
                        strategy.type === "mean_reversion" ? "#f59e0b" : "#3b82f6"
                    }} />
                    <span style={{ fontWeight: 500 }}>{strategy.name}</span>
                    <span style={{
                      fontSize: "0.625rem",
                      padding: "0.125rem 0.375rem",
                      borderRadius: 4,
                      background: "rgba(0,0,0,0.2)",
                      color: "var(--text-muted)"
                    }}>
                      {strategy.type}
                    </span>
                  </div>
                  {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </div>

                {isExpanded && (
                  <div style={{
                    padding: "0.75rem",
                    borderTop: "1px solid var(--border)",
                    background: "rgba(0,0,0,0.2)"
                  }}>
                    <p style={{ margin: "0 0 0.75rem", fontSize: "0.75rem", color: "var(--text-secondary)" }}>
                      {strategy.description}
                    </p>
                    {strategy.parameters.length > 0 && (
                      <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                        {strategy.parameters.map(param => (
                          <div key={param.name}>
                            <div style={{
                              display: "flex",
                              justifyContent: "space-between",
                              marginBottom: "0.25rem",
                              fontSize: "0.75rem"
                            }}>
                              <span style={{ color: "var(--text-muted)" }}>{param.name}</span>
                              <span style={{ fontFamily: "ui-monospace, monospace" }}>
                                {parameters[strategy.id]?.[param.name] ?? param.default}
                              </span>
                            </div>
                            {param.type === "number" && (
                              <input
                                type="range"
                                min={param.min}
                                max={param.max}
                                step={param.step}
                                value={parameters[strategy.id]?.[param.name] ?? param.default}
                                onChange={(e) => {
                                  setParameters(prev => ({
                                    ...prev,
                                    [strategy.id]: {
                                      ...prev[strategy.id],
                                      [param.name]: parseFloat(e.target.value)
                                    }
                                  }));
                                }}
                                style={{ width: "100%", accentColor: "#8b5cf6" }}
                              />
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Run Backtest Button */}
      <button
        onClick={runBacktest}
        disabled={isRunning}
        style={{
          padding: "1rem",
          borderRadius: 12,
          border: "none",
          background: isRunning
            ? "var(--glass-bg)"
            : "linear-gradient(135deg, #8b5cf6, #7c3aed)",
          color: "white",
          fontSize: "1rem",
          fontWeight: 600,
          cursor: isRunning ? "not-allowed" : "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: "0.5rem",
          opacity: isRunning ? 0.7 : 1
        }}
      >
        {isRunning ? (
          <>
            <div className="loading-spinner" style={{ width: 16, height: 16 }} />
            Running Backtest...
          </>
        ) : (
          <>
            <Play className="w-4 h-4" fill="currentColor" />
            Run Backtest on All Strategies
          </>
        )}
      </button>

      {/* Results */}
      {backtestResults.length > 0 && (
        <div className="glass-card" style={{ padding: "1rem" }}>
          <h3 style={{ margin: "0 0 1rem", fontSize: "0.875rem", fontWeight: 600, color: "var(--text-secondary)" }}>
            Backtest Results
          </h3>

          {/* Summary */}
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(4, 1fr)",
            gap: "0.5rem",
            marginBottom: "1rem"
          }}>
            <div style={{ padding: "0.75rem", background: "rgba(0,0,0,0.2)", borderRadius: 8, textAlign: "center" }}>
              <div style={{ fontSize: "0.625rem", color: "var(--text-muted)" }}>Best Strategy</div>
              <div style={{ fontWeight: 600, color: "#22c55e" }}>
                {getStrategyConfig(sortedResults[0]?.strategy)?.name || "-"}
              </div>
            </div>
            <div style={{ padding: "0.75rem", background: "rgba(0,0,0,0.2)", borderRadius: 8, textAlign: "center" }}>
              <div style={{ fontSize: "0.625rem", color: "var(--text-muted)" }}>Avg Win Rate</div>
              <div style={{ fontWeight: 600, fontFamily: "ui-monospace, monospace" }}>
                {(backtestResults.reduce((s, r) => s + r.winRate, 0) / backtestResults.length * 100).toFixed(0)}%
              </div>
            </div>
            <div style={{ padding: "0.75rem", background: "rgba(0,0,0,0.2)", borderRadius: 8, textAlign: "center" }}>
              <div style={{ fontSize: "0.625rem", color: "var(--text-muted)" }}>Avg Return</div>
              <div style={{
                fontWeight: 600,
                fontFamily: "ui-monospace, monospace",
                color: backtestResults.reduce((s, r) => s + r.totalReturn, 0) >= 0 ? "#22c55e" : "#ef4444"
              }}>
                {formatCurrency(backtestResults.reduce((s, r) => s + r.totalReturn, 0) / backtestResults.length)}
              </div>
            </div>
            <div style={{ padding: "0.75rem", background: "rgba(0,0,0,0.2)", borderRadius: 8, textAlign: "center" }}>
              <div style={{ fontSize: "0.625rem", color: "var(--text-muted)" }}>Total Trades</div>
              <div style={{ fontWeight: 600, fontFamily: "ui-monospace, monospace" }}>
                {backtestResults.reduce((s, r) => s + r.totalTrades, 0)}
              </div>
            </div>
          </div>

          {/* Results Table */}
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.875rem" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid var(--border)" }}>
                <th style={{ textAlign: "left", padding: "0.5rem", color: "var(--text-muted)", fontWeight: 500 }}>Strategy</th>
                <th style={{ textAlign: "right", padding: "0.5rem", color: "var(--text-muted)", fontWeight: 500 }}>Trades</th>
                <th style={{ textAlign: "right", padding: "0.5rem", color: "var(--text-muted)", fontWeight: 500 }}>Win%</th>
                <th style={{ textAlign: "right", padding: "0.5rem", color: "var(--text-muted)", fontWeight: 500 }}>Return</th>
                <th style={{ textAlign: "right", padding: "0.5rem", color: "var(--text-muted)", fontWeight: 500 }}>Sharpe</th>
                <th style={{ textAlign: "right", padding: "0.5rem", color: "var(--text-muted)", fontWeight: 500 }}>Max DD</th>
              </tr>
            </thead>
            <tbody>
              {sortedResults.map((result, index) => {
                const config = getStrategyConfig(result.strategy);
                return (
                  <tr
                    key={result.strategy}
                    style={{
                      borderBottom: "1px solid var(--border)",
                      background: index === 0 ? "rgba(34, 197, 94, 0.1)" : "transparent"
                    }}
                  >
                    <td style={{ padding: "0.5rem" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                        {index === 0 && <span style={{ color: "#22c55e" }}>🏆</span>}
                        <span style={{ fontWeight: index === 0 ? 600 : 400 }}>{config?.name || result.strategy}</span>
                      </div>
                    </td>
                    <td style={{ padding: "0.5rem", textAlign: "right", fontFamily: "ui-monospace, monospace" }}>
                      {result.totalTrades}
                    </td>
                    <td style={{
                      padding: "0.5rem",
                      textAlign: "right",
                      fontFamily: "ui-monospace, monospace",
                      color: result.winRate >= 0.5 ? "#22c55e" : "#ef4444"
                    }}>
                      {(result.winRate * 100).toFixed(0)}%
                    </td>
                    <td style={{
                      padding: "0.5rem",
                      textAlign: "right",
                      fontFamily: "ui-monospace, monospace",
                      fontWeight: 600,
                      color: result.totalReturn >= 0 ? "#22c55e" : "#ef4444"
                    }}>
                      {result.totalReturn >= 0 ? "+" : ""}{formatCurrency(result.totalReturn)}
                    </td>
                    <td style={{
                      padding: "0.5rem",
                      textAlign: "right",
                      fontFamily: "ui-monospace, monospace",
                      color: result.sharpeRatio >= 1 ? "#22c55e" : result.sharpeRatio >= 0 ? "var(--text-primary)" : "#ef4444"
                    }}>
                      {result.sharpeRatio.toFixed(2)}
                    </td>
                    <td style={{
                      padding: "0.5rem",
                      textAlign: "right",
                      fontFamily: "ui-monospace, monospace",
                      color: result.maxDrawdown > 10 ? "#f59e0b" : "var(--text-primary)"
                    }}>
                      -{result.maxDrawdown.toFixed(1)}%
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Info Box */}
      <div style={{
        padding: "1rem",
        background: "rgba(139, 92, 246, 0.1)",
        borderRadius: 8,
        border: "1px solid rgba(139, 92, 246, 0.2)",
        display: "flex",
        gap: "0.5rem"
      }}>
        <AlertCircle className="w-4 h-4" style={{ color: "#8b5cf6", flexShrink: 0, marginTop: "0.125rem" }} />
        <div style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>
          <strong style={{ color: "#8b5cf6" }}>Coming Soon:</strong> Full backtesting with historical market data,
          custom strategy builder, and AI-powered strategy recommendations based on market conditions.
        </div>
      </div>
    </div>
  );
}
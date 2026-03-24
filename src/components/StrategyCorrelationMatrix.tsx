'use client'

// Strategy Correlation Matrix - Heatmap visualization of strategy correlations
import { useState, useEffect, useCallback } from "react";
import { Info } from "lucide-react";

interface CorrelationMatrix {
  strategies: string[];
  matrix: number[][];
  timestamp: number;
}

export function StrategyCorrelationMatrix() {
  const [matrix, setMatrix] = useState<CorrelationMatrix | null>(null);
  const [loading, setLoading] = useState(true);
  const [hoveredCell, setHoveredCell] = useState<{ row: number; col: number } | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch("/api/analytics/correlation");
      const data = await res.json();
      setMatrix(data);
    } catch (err) {
      console.error("Failed to fetch correlation matrix:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000); // Update every 30s
    return () => clearInterval(interval);
  }, [fetchData]);

  const getCorrelationColor = (value: number): string => {
    // Blue for negative, white for 0, red for positive
    if (value > 0) {
      const intensity = Math.min(value, 1);
      return `rgba(34, 197, 94, ${intensity * 0.8})`; // Green for positive correlation
    } else if (value < 0) {
      const intensity = Math.min(Math.abs(value), 1);
      return `rgba(239, 68, 68, ${intensity * 0.8})`; // Red for negative correlation
    }
    return "rgba(128, 128, 128, 0.2)";
  };

  const getStrategyDisplayName = (strategy: string): string => {
    const names: Record<string, string> = {
      momentum: "MOM",
      mean_reversion: "MR",
      trend: "TRD",
      smart_trend: "SMT",
      contrarian: "CON",
      fair_value: "FV",
      arbitrage: "ARB",
      grid_trading: "GRD",
      binance_signal: "BIN",
      last_seconds_scalp: "LSS",
      random: "RND",
    };
    return names[strategy] || strategy.slice(0, 3).toUpperCase();
  };

  if (loading) {
    return (
      <div className="glass-card" style={{ padding: "1rem" }}>
        <div className="loading-spinner" style={{ margin: "2rem auto" }} />
      </div>
    );
  }

  if (!matrix || matrix.strategies.length === 0) {
    return (
      <div className="glass-card" style={{ padding: "1rem", textAlign: "center" }}>
        <p style={{ color: "var(--text-muted)" }}>No correlation data available. Run some trades first.</p>
      </div>
    );
  }

  const cellSize = Math.max(30, Math.min(50, 400 / matrix.strategies.length));

  return (
    <div className="glass-card" style={{ padding: "1rem" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.75rem" }}>
        <h3 style={{ margin: 0, fontSize: "1rem", fontWeight: 600 }}>Strategy Correlation</h3>
        <div style={{ display: "flex", alignItems: "center", gap: "0.25rem", color: "var(--text-muted)", fontSize: "0.75rem" }}>
          <Info className="w-3 h-3" />
          <span>How strategies move together</span>
        </div>
      </div>

      <div style={{ overflow: "auto" }}>
        <div style={{ display: "flex" }}>
          {/* Left label column */}
          <div style={{ width: 60 }}>
            <div style={{ height: 30 }} /> {/* Top-left corner */}
            {matrix.strategies.map((strategy, i) => (
              <div
                key={strategy}
                style={{
                  height: cellSize,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "flex-end",
                  paddingRight: "0.5rem",
                  fontSize: "0.625rem",
                  color: hoveredCell?.row === i ? "var(--text-primary)" : "var(--text-muted)",
                  fontWeight: hoveredCell?.row === i ? 600 : 400,
                }}
              >
                {getStrategyDisplayName(strategy)}
              </div>
            ))}
          </div>

          {/* Matrix grid */}
          <div>
            {/* Top labels */}
            <div style={{ display: "flex", height: 30 }}>
              {matrix.strategies.map((strategy, j) => (
                <div
                  key={strategy}
                  style={{
                    width: cellSize,
                    display: "flex",
                    alignItems: "flex-end",
                    justifyContent: "center",
                    fontSize: "0.625rem",
                    color: hoveredCell?.col === j ? "var(--text-primary)" : "var(--text-muted)",
                    fontWeight: hoveredCell?.col === j ? 600 : 400,
                    transform: "rotate(-45deg)",
                    transformOrigin: "center bottom",
                    whiteSpace: "nowrap",
                  }}
                >
                  {getStrategyDisplayName(strategy)}
                </div>
              ))}
            </div>

            {/* Matrix cells */}
            {matrix.matrix.map((row, i) => (
              <div key={i} style={{ display: "flex" }}>
                {row.map((value, j) => (
                  <div
                    key={j}
                    style={{
                      width: cellSize,
                      height: cellSize,
                      background: getCorrelationColor(value),
                      border: hoveredCell?.row === i || hoveredCell?.col === j
                        ? "2px solid var(--primary)"
                        : "1px solid var(--border)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: "0.5rem",
                      fontWeight: 600,
                      color: Math.abs(value) > 0.5 ? "white" : "var(--text-primary)",
                      cursor: "pointer",
                    }}
                    onMouseEnter={() => setHoveredCell({ row: i, col: j })}
                    onMouseLeave={() => setHoveredCell(null)}
                    title={`${matrix.strategies[i]} vs ${matrix.strategies[j]}: ${value.toFixed(2)}`}
                  >
                    {i === j ? "1.0" : value.toFixed(1)}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Legend */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "1rem", marginTop: "0.75rem", fontSize: "0.75rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.25rem" }}>
          <div style={{ width: 12, height: 12, background: "rgba(239, 68, 68, 0.6)", borderRadius: 2 }} />
          <span style={{ color: "var(--text-muted)" }}>Opposite</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "0.25rem" }}>
          <div style={{ width: 12, height: 12, background: "rgba(128, 128, 128, 0.2)", borderRadius: 2 }} />
          <span style={{ color: "var(--text-muted)" }}>Neutral</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "0.25rem" }}>
          <div style={{ width: 12, height: 12, background: "rgba(34, 197, 94, 0.6)", borderRadius: 2 }} />
          <span style={{ color: "var(--text-muted)" }}>Aligned</span>
        </div>
      </div>

      {/* Hovered info */}
      {hoveredCell && (
        <div style={{
          marginTop: "0.75rem",
          padding: "0.5rem",
          background: "var(--glass-bg)",
          borderRadius: 6,
          fontSize: "0.75rem",
        }}>
          <span style={{ fontWeight: 500 }}>{matrix.strategies[hoveredCell.row]}</span>
          {" vs "}
          <span style={{ fontWeight: 500 }}>{matrix.strategies[hoveredCell.col]}</span>
          {": "}
          <span style={{
            color: matrix.matrix[hoveredCell.row][hoveredCell.col] > 0 ? "#22c55e" : "#ef4444",
            fontFamily: "ui-monospace, monospace",
            fontWeight: 600,
          }}>
            {matrix.matrix[hoveredCell.row][hoveredCell.col].toFixed(3)}
          </span>
        </div>
      )}
    </div>
  );
}
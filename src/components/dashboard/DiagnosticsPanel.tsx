// DiagnosticsPanel - Shows BTC delta, Binance signal, market price, active strategies

import React from "react";

interface DiagnosticsPanelProps {
  btcDelta?: number;
  btcPrice?: number;
  binanceSignal?: {
    type: "UP" | "DOWN" | "NEUTRAL";
    confidence: number;
    timestamp: number;
  };
  marketPrice?: { yesPrice: number; noPrice: number };
  timeRemaining?: number;
  activeStrategies?: Array<{
    name: string;
    signal: "UP" | "DOWN" | null;
    confidence: number;
    active: boolean;
  }>;
}

export function DiagnosticsPanel({
  btcDelta,
  btcPrice,
  binanceSignal,
  marketPrice,
  timeRemaining,
  activeStrategies,
}: DiagnosticsPanelProps) {
  const signalAge = binanceSignal ? Math.floor((Date.now() - binanceSignal.timestamp) / 1000) : null;
  const signalFresh = signalAge !== null && signalAge < 8;

  return (
    <div style={{
      background: "rgba(0, 0, 0, 0.3)",
      borderRadius: 8,
      padding: "1rem",
    }}>
      <div style={{
        display: "flex",
        alignItems: "center",
        gap: "0.5rem",
        marginBottom: "0.75rem",
      }}>
        <span style={{ fontSize: "0.8rem" }}>📊</span>
        <span style={{ color: "#fff", fontWeight: 600, fontSize: "0.9rem" }}>DIAGNOSTICS</span>
      </div>

      {/* Main metrics */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(3, 1fr)",
        gap: "0.75rem",
        marginBottom: "0.75rem",
      }}>
        {/* BTC Delta */}
        <MetricCard
          label="BTC Delta"
          value={btcDelta !== undefined ? `${btcDelta > 0 ? "+" : ""}${btcDelta.toFixed(3)}%` : "N/A"}
          color={btcDelta && btcDelta > 0 ? "#22c55e" : btcDelta && btcDelta < 0 ? "#ef4444" : "#888"}
        />

        {/* Binance Signal */}
        <MetricCard
          label="Binance Signal"
          value={binanceSignal && binanceSignal.type !== "NEUTRAL" ? binanceSignal.type : "NEUTRAL"}
          subValue={signalFresh ? `fresh ${signalAge}s` : signalAge ? `expired ${signalAge}s` : null}
          color={binanceSignal?.type === "UP" ? "#22c55e" : binanceSignal?.type === "DOWN" ? "#ef4444" : "#888"}
        />

        {/* Market Price */}
        <MetricCard
          label="Market Price"
          value={marketPrice ? `YES ${(marketPrice.yesPrice * 100).toFixed(0)}¢` : "N/A"}
          subValue={marketPrice ? `NO ${(marketPrice.noPrice * 100).toFixed(0)}¢` : null}
          color="#aaa"
        />
      </div>

      {/* Time Remaining */}
      {timeRemaining !== undefined && (
        <div style={{
          padding: "0.5rem",
          borderRadius: 6,
          background: timeRemaining < 60000 ? "rgba(239, 68, 68, 0.2)" :
                      timeRemaining < 180000 ? "rgba(245, 158, 11, 0.2)" : "rgba(59, 130, 246, 0.2)",
          marginBottom: "0.75rem",
        }}>
          <span style={{ color: "#888", fontSize: "0.65rem" }}>Time Left:</span>
          <span style={{
            color: timeRemaining < 60000 ? "#ef4444" :
                   timeRemaining < 180000 ? "#f59e0b" : "#3b82f6",
            fontWeight: 600,
            marginLeft: "0.5rem",
          }}>
            {formatDuration(timeRemaining)}
          </span>
        </div>
      )}

      {/* Active Signals */}
      {activeStrategies && activeStrategies.length > 0 && (
        <div style={{
          padding: "0.5rem",
          borderRadius: 6,
          background: "rgba(0, 0, 0, 0.2)",
        }}>
          <span style={{ color: "#888", fontSize: "0.65rem", marginBottom: "0.5rem", display: "block" }}>
            Active Signals:
          </span>
          {activeStrategies.map((s, i) => (
            <div key={i} style={{
              display: "flex",
              alignItems: "center",
              gap: "0.5rem",
              padding: "0.25rem 0",
            }}>
              <span style={{ color: s.active ? "#22c55e" : "#ef4444", fontSize: "0.7rem" }}>
                {s.active ? "✓" : "✗"}
              </span>
              <span style={{ color: "#aaa", fontSize: "0.75rem" }}>{s.name}:</span>
              {s.signal && (
                <span style={{
                  color: s.signal === "UP" ? "#22c55e" : "#ef4444",
                  fontSize: "0.7rem",
                }}>
                  {s.signal}, conf {(s.confidence * 100).toFixed(0)}%
                </span>
              )}
              {!s.signal && (
                <span style={{ color: "#888", fontSize: "0.7rem" }}>no signal</span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function MetricCard({ label, value, subValue, color }: {
  label: string;
  value: string;
  subValue?: string | null;
  color: string;
}) {
  return (
    <div style={{
      background: "rgba(0, 0, 0, 0.2)",
      padding: "0.5rem",
      borderRadius: 6,
    }}>
      <div style={{ color: "#888", fontSize: "0.65rem" }}>{label}</div>
      <div style={{ color, fontWeight: 600, fontSize: "0.85rem" }}>{value}</div>
      {subValue && <div style={{ color: "#888", fontSize: "0.65rem" }}>{subValue}</div>}
    </div>
  );
}

function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${minutes}m ${secs}s`;
}

export default DiagnosticsPanel;
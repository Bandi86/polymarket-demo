'use client'

import { useState, useEffect } from "react";
import { CheckCircle, XCircle, AlertTriangle, RefreshCw } from "lucide-react";

interface SettlementStats {
  totalSettlements: number;
  correctSettlements: number;
  incorrectSettlements: number;
  accuracy: number;
  lastValidation: {
    marketId: string;
    marketQuestion: string;
    ourResult: string;
    polymarketResult: string;
    matches: boolean;
    discrepancy?: string;
    positionsSettled: number;
    positionsAffected: Array<{
      id: string;
      outcome: string;
      pnl: number | null;
    }>;
    timestamp: number;
  } | null;
}

export function SettlementStats() {
  const [stats, setStats] = useState<SettlementStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);

  const fetchStats = async () => {
    try {
      const res = await fetch('/api/settlement/stats');
      if (!res.ok) {
        console.error('Settlement stats API error:', res.status, res.statusText);
        return;
      }
      const data = await res.json();
      setStats(data);
    } catch (e) {
      console.error('Failed to fetch settlement stats:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
    // Refresh every 30 seconds
    const interval = setInterval(fetchStats, 30000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div style={{
        padding: "0.75rem 1rem",
        background: "rgba(15,23,42,0.5)",
        borderRadius: 10,
        border: "1px solid rgba(255,255,255,0.06)",
        display: "flex",
        alignItems: "center",
        gap: "0.5rem",
      }}>
        <RefreshCw style={{ width: 14, height: 14, color: "var(--text-muted)", animation: "spin 1s linear infinite" }} />
        <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>Loading settlement stats...</span>
      </div>
    );
  }

  if (!stats || stats.totalSettlements === 0) {
    return (
      <div style={{
        padding: "0.75rem 1rem",
        background: "rgba(15,23,42,0.5)",
        borderRadius: 10,
        border: "1px solid rgba(255,255,255,0.06)",
      }}>
        <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
          No settlements yet. Stats will appear after markets resolve.
        </span>
      </div>
    );
  }

  const accuracyPercent = (stats.accuracy * 100).toFixed(1);
  const accuracyColor = stats.accuracy >= 0.95 ? "#22c55e" : stats.accuracy >= 0.8 ? "#f59e0b" : "#ef4444";

  return (
    <div style={{
      background: "rgba(15,23,42,0.5)",
      borderRadius: 10,
      border: `1px solid ${stats.incorrectSettlements > 0 ? "rgba(239, 68, 68, 0.3)" : "rgba(255,255,255,0.06)"}`,
      overflow: "hidden",
    }}>
      {/* Header */}
      <div
        onClick={() => setExpanded(!expanded)}
        style={{
          padding: "0.75rem 1rem",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          cursor: "pointer",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          {stats.incorrectSettlements === 0 ? (
            <CheckCircle style={{ width: 16, height: 16, color: "#22c55e" }} />
          ) : (
            <AlertTriangle style={{ width: 16, height: 16, color: "#f59e0b" }} />
          )}
          <span style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--text-primary)" }}>
            Settlement Validator
          </span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
          {/* Accuracy */}
          <div style={{ display: "flex", alignItems: "center", gap: "0.375rem" }}>
            <span style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>Accuracy:</span>
            <span style={{
              fontSize: "0.85rem",
              fontWeight: 700,
              fontFamily: "ui-monospace, monospace",
              color: accuracyColor,
            }}>
              {accuracyPercent}%
            </span>
          </div>

          {/* Stats */}
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <span style={{ fontSize: "0.7rem", color: "#22c55e" }}>✓{stats.correctSettlements}</span>
            {stats.incorrectSettlements > 0 && (
              <span style={{ fontSize: "0.7rem", color: "#ef4444" }}>✗{stats.incorrectSettlements}</span>
            )}
          </div>

          {/* Expand indicator */}
          <span style={{
            fontSize: "0.65rem",
            color: "var(--text-muted)",
            transform: expanded ? "rotate(180deg)" : "rotate(0deg)",
            transition: "transform 0.2s",
          }}>
            ▼
          </span>
        </div>
      </div>

      {/* Expanded Details */}
      {expanded && stats.lastValidation && (
        <div style={{
          padding: "0.75rem 1rem",
          borderTop: "1px solid rgba(255,255,255,0.06)",
          background: "rgba(0,0,0,0.2)",
        }}>
          {/* Last Validation */}
          <div style={{ marginBottom: "0.5rem" }}>
            <div style={{ fontSize: "0.65rem", color: "var(--text-muted)", marginBottom: "0.25rem" }}>
              Last Settlement:
            </div>
            <div style={{ fontSize: "0.7rem", color: "var(--text-secondary)" }}>
              {stats.lastValidation.marketQuestion}
            </div>
          </div>

          {/* Results Comparison */}
          <div style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: "0.5rem",
            marginBottom: "0.5rem",
          }}>
            <div style={{
              padding: "0.5rem",
              background: "rgba(59, 130, 246, 0.1)",
              borderRadius: 6,
              border: "1px solid rgba(59, 130, 246, 0.2)",
            }}>
              <div style={{ fontSize: "0.6rem", color: "var(--text-muted)" }}>Our Calculation</div>
              <div style={{
                fontSize: "0.85rem",
                fontWeight: 700,
                color: stats.lastValidation.ourResult === "UP" ? "#22c55e" : "#ef4444",
              }}>
                {stats.lastValidation.ourResult}
              </div>
            </div>
            <div style={{
              padding: "0.5rem",
              background: "rgba(139, 92, 246, 0.1)",
              borderRadius: 6,
              border: "1px solid rgba(139, 92, 246, 0.2)",
            }}>
              <div style={{ fontSize: "0.6rem", color: "var(--text-muted)" }}>Polymarket</div>
              <div style={{
                fontSize: "0.85rem",
                fontWeight: 700,
                color: stats.lastValidation.polymarketResult === "UP" ? "#22c55e" : "#ef4444",
              }}>
                {stats.lastValidation.polymarketResult}
              </div>
            </div>
          </div>

          {/* Discrepancy Warning */}
          {!stats.lastValidation.matches && stats.lastValidation.discrepancy && (
            <div style={{
              padding: "0.5rem 0.75rem",
              background: "rgba(239, 68, 68, 0.1)",
              borderRadius: 6,
              border: "1px solid rgba(239, 68, 68, 0.2)",
              marginBottom: "0.5rem",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.375rem", marginBottom: "0.25rem" }}>
                <XCircle style={{ width: 12, height: 12, color: "#ef4444" }} />
                <span style={{ fontSize: "0.7rem", fontWeight: 600, color: "#ef4444" }}>
                  MISMATCH DETECTED
                </span>
              </div>
              <div style={{ fontSize: "0.65rem", color: "var(--text-secondary)" }}>
                {stats.lastValidation.discrepancy}
              </div>
              {stats.lastValidation.positionsAffected.length > 0 && (
                <div style={{ fontSize: "0.6rem", color: "#f59e0b", marginTop: "0.25rem" }}>
                  ⚠ {stats.lastValidation.positionsAffected.length} position(s) affected
                </div>
              )}
            </div>
          )}

          {/* Time */}
          <div style={{ fontSize: "0.6rem", color: "var(--text-muted)" }}>
            {new Date(stats.lastValidation.timestamp).toLocaleString()}
          </div>
        </div>
      )}

      {/* Summary Bar */}
      <div style={{
        padding: "0.5rem 1rem",
        background: "rgba(0,0,0,0.3)",
        borderTop: "1px solid rgba(255,255,255,0.04)",
      }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ fontSize: "0.6rem", color: "var(--text-muted)" }}>
            Total markets settled: {stats.totalSettlements}
          </span>
          <button
            onClick={(e) => { e.stopPropagation(); fetchStats(); }}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.25rem",
              padding: "0.25rem 0.5rem",
              background: "rgba(255,255,255,0.05)",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: 4,
              color: "var(--text-muted)",
              fontSize: "0.6rem",
              cursor: "pointer",
            }}
          >
            <RefreshCw style={{ width: 10, height: 10 }} />
            Refresh
          </button>
        </div>
      </div>
    </div>
  );
}
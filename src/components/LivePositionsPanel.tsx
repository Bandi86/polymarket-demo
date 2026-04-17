'use client'

import { Target, TrendingUp, TrendingDown, RefreshCw, ExternalLink, Gift, Loader2 } from "lucide-react";
import { useState, useEffect } from "react";
import { toast } from "@/components/ui/toast";

interface LivePosition {
  market: string;
  outcome: string;
  shares: number;
  avgPrice: number;
  currentValue: number;
}

interface LivePositionsPanelProps {
  coinColor: string;
  onRefresh?: () => Promise<void>;
}

export function LivePositionsPanel({ coinColor, onRefresh }: LivePositionsPanelProps) {
  const [positions, setPositions] = useState<LivePosition[]>([]);
  const [loading, setLoading] = useState(false);
  const [redeeming, setRedeeming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchPositions = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/orders/positions");
      const data = await res.json();
      if (data.success) {
        setPositions(data.positions || []);
      } else {
        setError(data.error || "Failed to fetch positions");
      }
    } catch (err) {
      setError("Failed to fetch positions");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPositions();
    const interval = setInterval(fetchPositions, 30000); // Refresh every 30s
    return () => clearInterval(interval);
  }, []);

  const handleRedeem = async () => {
    const conditionId = prompt("Enter the Condition ID of the resolved market to redeem:");
    if (!conditionId) return;

    setRedeeming(true);
    try {
      const res = await fetch("/api/account/redeem", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conditionId }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success("Winnings redeemed successfully!", "USDC added to your wallet.");
        fetchPositions();
        onRefresh?.();
      } else {
        toast.error("Failed to redeem winnings", data.error || "Ensure the market is resolved and you have MATIC for gas.");
      }
    } catch (err) {
      toast.error("Network error during redeem");
    } finally {
      setRedeeming(false);
    }
  };

  const totalValue = positions.reduce((sum, p) => sum + p.currentValue, 0);
  const totalPnL = positions.reduce((sum, p) => {
    const pnl = (p.shares * (p.currentValue / p.shares - p.avgPrice));
    return sum + pnl;
  }, 0);

  if (positions.length === 0 && !loading) {
    return (
      <div className="glass-card" style={{ padding: "1rem" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.75rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <Target className="w-4 h-4" style={{ color: coinColor }} />
            <span style={{ fontWeight: 600, fontSize: "0.875rem" }}>Live Positions</span>
            <span style={{
              fontSize: "0.625rem",
              padding: "0.125rem 0.5rem",
              background: "rgba(34, 197, 94, 0.2)",
              color: "#22c55e",
              borderRadius: 4,
            }}>POLYMARKET</span>
          </div>
          <button
            onClick={() => { fetchPositions(); onRefresh?.(); }}
            style={{ background: "transparent", border: "none", cursor: "pointer", padding: "0.25rem" }}
          >
            <RefreshCw className="w-4 h-4" style={{ color: "var(--text-muted)" }} />
          </button>
        </div>
        <div style={{ textAlign: "center", padding: "1.5rem", color: "var(--text-muted)" }}>
          <p style={{ margin: 0, fontSize: "0.875rem" }}>No live positions</p>
          <p style={{ margin: "0.25rem 0 0", fontSize: "0.75rem" }}>Connect wallet and start trading to see positions</p>
        </div>
      </div>
    );
  }

  return (
    <div className="glass-card" style={{ padding: "1rem" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.75rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <Target className="w-4 h-4" style={{ color: coinColor }} />
          <span style={{ fontWeight: 600, fontSize: "0.875rem" }}>Live Positions</span>
          <span style={{
            fontSize: "0.625rem",
            padding: "0.125rem 0.5rem",
            background: "rgba(34, 197, 94, 0.2)",
            color: "#22c55e",
            borderRadius: 4,
          }}>POLYMARKET</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <button
            onClick={handleRedeem}
            disabled={redeeming}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.25rem",
              background: "rgba(59, 130, 246, 0.15)",
              border: "1px solid rgba(59, 130, 246, 0.3)",
              color: "#3b82f6",
              cursor: redeeming ? "wait" : "pointer",
              padding: "0.25rem 0.5rem",
              borderRadius: 6,
              fontSize: "0.75rem",
              fontWeight: 600,
            }}
            title="Redeem winning CTF tokens for USDC. Costs MATIC."
          >
            {redeeming ? <Loader2 className="w-3 h-3 animate-spin" /> : <Gift className="w-3 h-3" />}
            Redeem
          </button>
          <button
            onClick={() => { fetchPositions(); onRefresh?.(); }}
            disabled={loading}
            style={{ background: "transparent", border: "none", cursor: loading ? "wait" : "pointer", padding: "0.25rem" }}
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} style={{ color: "var(--text-muted)" }} />
          </button>
          <span className="badge badge-primary" style={{ fontSize: "0.625rem" }}>{positions.length}</span>
        </div>
      </div>

      {/* Summary */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        gap: "0.75rem",
        marginBottom: "0.75rem",
        padding: "0.75rem",
        background: "var(--glass-bg)",
        borderRadius: 8,
      }}>
        <div>
          <div style={{ fontSize: "0.625rem", color: "var(--text-muted)", textTransform: "uppercase" }}>Total Value</div>
          <div style={{ fontSize: "1rem", fontWeight: 700 }}>${totalValue.toFixed(2)}</div>
        </div>
        <div>
          <div style={{ fontSize: "0.625rem", color: "var(--text-muted)", textTransform: "uppercase" }}>Unrealized P&L</div>
          <div style={{ fontSize: "1rem", fontWeight: 700, color: totalPnL >= 0 ? "var(--green)" : "var(--red)" }}>
            {totalPnL >= 0 ? "+" : ""}${totalPnL.toFixed(2)}
          </div>
        </div>
      </div>

      {/* Positions List */}
      <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
        {positions.map((pos, i) => (
          <div
            key={i}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "0.75rem",
              background: "var(--glass-bg)",
              borderRadius: 8,
              border: "1px solid var(--border)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
              <span className={`badge ${pos.outcome === "YES" || pos.outcome === "Up" ? "badge-green" : "badge-red"}`} style={{ fontSize: "0.625rem" }}>
                {pos.outcome === "YES" || pos.outcome === "Up" ? (
                  <><TrendingUp className="w-3 h-3" style={{ display: "inline" }} /> YES</>
                ) : (
                  <><TrendingDown className="w-3 h-3" style={{ display: "inline" }} /> NO</>
                )}
              </span>
              <div>
                <p style={{ fontWeight: 500, fontSize: "0.75rem", margin: 0 }}>{(pos.shares ?? 0).toFixed(2)} shares</p>
                <p style={{ fontSize: "0.625rem", color: "var(--text-muted)", margin: 0 }}>
                  @ {(pos.avgPrice ?? 0).toFixed(3)} avg
                </p>
              </div>
            </div>
            <div style={{ textAlign: "right" }}>
              <p style={{ fontWeight: 600, fontSize: "0.75rem", margin: 0, color: "var(--text-primary)" }}>
                ${(pos.currentValue ?? 0).toFixed(2)}
              </p>
              <p style={{ fontSize: "0.625rem", color: "var(--text-muted)", margin: 0 }}>
                {pos.market.slice(0, 20)}...
              </p>
            </div>
          </div>
        ))}
      </div>

      {error && (
        <div style={{ marginTop: "0.75rem", padding: "0.5rem", background: "rgba(239, 68, 68, 0.1)", borderRadius: 6, color: "#ef4444", fontSize: "0.75rem" }}>
          {error}
        </div>
      )}
    </div>
  );
}
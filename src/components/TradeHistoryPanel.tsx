import { History, ArrowUpRight, ArrowDownRight, RefreshCw } from "lucide-react";
import { useState, useEffect } from "react";

interface LiveTrade {
  id: string;
  market: string;
  outcome: string;
  side: string;
  size: number;
  price: number;
  timestamp: number;
}

interface TradeHistoryPanelProps {
  coinColor: string;
  onRefresh?: () => Promise<void>;
}

export function TradeHistoryPanel({ coinColor, onRefresh }: TradeHistoryPanelProps) {
  const [trades, setTrades] = useState<LiveTrade[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchTrades = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/orders/trades");
      const data = await res.json();
      if (data.success) {
        setTrades(data.trades || []);
      } else {
        setError(data.error || "Failed to fetch trades");
      }
    } catch (err) {
      setError("Failed to fetch trades");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTrades();
  }, []);

  const formatTime = (ts: number) => {
    const date = new Date(ts * 1000);
    return date.toLocaleString();
  };

  const totalVolume = trades.reduce((sum, t) => sum + t.size * t.price, 0);

  if (trades.length === 0 && !loading) {
    return (
      <div className="glass-card" style={{ padding: "1rem" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.75rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <History className="w-4 h-4" style={{ color: coinColor }} />
            <span style={{ fontWeight: 600, fontSize: "0.875rem" }}>Trade History</span>
          </div>
          <button
            onClick={() => { fetchTrades(); onRefresh?.(); }}
            style={{ background: "transparent", border: "none", cursor: "pointer", padding: "0.25rem" }}
          >
            <RefreshCw className="w-4 h-4" style={{ color: "var(--text-muted)" }} />
          </button>
        </div>
        <div style={{ textAlign: "center", padding: "1.5rem", color: "var(--text-muted)" }}>
          <p style={{ margin: 0, fontSize: "0.875rem" }}>No trades yet</p>
          <p style={{ margin: "0.25rem 0 0", fontSize: "0.75rem" }}>Your Polymarket trade history will appear here</p>
        </div>
      </div>
    );
  }

  return (
    <div className="glass-card" style={{ padding: "1rem" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.75rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <History className="w-4 h-4" style={{ color: coinColor }} />
          <span style={{ fontWeight: 600, fontSize: "0.875rem" }}>Trade History</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <button
            onClick={() => { fetchTrades(); onRefresh?.(); }}
            disabled={loading}
            style={{ background: "transparent", border: "none", cursor: loading ? "wait" : "pointer", padding: "0.25rem" }}
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} style={{ color: "var(--text-muted)" }} />
          </button>
          <span className="badge badge-primary" style={{ fontSize: "0.625rem" }}>{trades.length}</span>
        </div>
      </div>

      {/* Summary */}
      <div style={{
        padding: "0.75rem",
        background: "var(--glass-bg)",
        borderRadius: 8,
        marginBottom: "0.75rem",
      }}>
        <div style={{ fontSize: "0.625rem", color: "var(--text-muted)", textTransform: "uppercase" }}>Total Volume</div>
        <div style={{ fontSize: "1rem", fontWeight: 700 }}>${totalVolume.toFixed(2)}</div>
      </div>

      {/* Trades List */}
      <div style={{ display: "flex", flexDirection: "column", gap: "0.375rem", maxHeight: 300, overflow: "auto" }}>
        {trades.slice(0, 20).map((trade, i) => (
          <div
            key={trade.id || i}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "0.5rem 0.75rem",
              background: "var(--glass-bg)",
              borderRadius: 6,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              {trade.side === "BUY" ? (
                <ArrowUpRight className="w-3 h-3" style={{ color: "#22c55e" }} />
              ) : (
                <ArrowDownRight className="w-3 h-3" style={{ color: "#ef4444" }} />
              )}
              <div>
                <p style={{ fontWeight: 500, fontSize: "0.75rem", margin: 0 }}>
                  {trade.side} {trade.outcome}
                </p>
                <p style={{ fontSize: "0.625rem", color: "var(--text-muted)", margin: 0 }}>
                  {trade.size.toFixed(2)} @ {(trade.price * 100).toFixed(1)}¢
                </p>
              </div>
            </div>
            <div style={{ textAlign: "right" }}>
              <p style={{ fontSize: "0.75rem", fontWeight: 600, margin: 0 }}>
                ${(trade.size * trade.price).toFixed(2)}
              </p>
              <p style={{ fontSize: "0.5rem", color: "var(--text-muted)", margin: 0 }}>
                {formatTime(trade.timestamp)}
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
import { useMemo } from "react";
import { BarChart3 } from "lucide-react";

interface OrderBookProps {
  yesPrice: number;
  noPrice: number;
  coinColor: string;
}

interface OrderLevel {
  price: number;
  size: number;
  total: number;
}

/**
 * Simulated order book visualization based on real market prices.
 * Generates realistic bid/ask levels around the current YES/NO prices.
 */
export function OrderBook({ yesPrice, noPrice, coinColor }: OrderBookProps) {
  const { asks, bids, spread } = useMemo(() => {
    const levels = 6;
    const asks: OrderLevel[] = [];
    const bids: OrderLevel[] = [];

    // Generate ask levels (selling YES tokens — prices above current)
    let askTotal = 0;
    for (let i = 0; i < levels; i++) {
      const price = Math.min(0.99, yesPrice + (i + 1) * 0.01 + Math.random() * 0.005);
      const size = 50 + Math.random() * 200 + (levels - i) * 30;
      askTotal += size;
      asks.push({ price, size, total: askTotal });
    }

    // Generate bid levels (buying YES tokens — prices below current)
    let bidTotal = 0;
    for (let i = 0; i < levels; i++) {
      const price = Math.max(0.01, yesPrice - (i + 1) * 0.01 - Math.random() * 0.005);
      const size = 50 + Math.random() * 200 + (levels - i) * 30;
      bidTotal += size;
      bids.push({ price, size, total: bidTotal });
    }

    const spread = asks.length > 0 && bids.length > 0
      ? ((asks[0].price - bids[0].price) * 100).toFixed(1)
      : "0.0";

    return { asks: asks.reverse(), bids, spread };
  }, [yesPrice, noPrice]);

  const maxTotal = Math.max(
    asks[asks.length - 1]?.total || 0,
    bids[bids.length - 1]?.total || 0
  );

  return (
    <div className="glass-card" style={{ padding: "0.75rem" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.75rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.375rem" }}>
          <BarChart3 className="w-3.5 h-3.5" style={{ color: coinColor }} />
          <span style={{ fontWeight: 600, fontSize: "0.8rem" }}>Order Book</span>
        </div>
        <span style={{
          fontSize: "0.625rem",
          padding: "0.125rem 0.375rem",
          borderRadius: 4,
          background: "rgba(139, 92, 246, 0.15)",
          color: "#8b5cf6",
          fontFamily: "ui-monospace, monospace",
        }}>
          Spread: {spread}¢
        </span>
      </div>

      {/* Header */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "1fr 1fr 1fr",
        fontSize: "0.6rem",
        color: "var(--text-muted)",
        textTransform: "uppercase",
        letterSpacing: "0.05em",
        padding: "0 0.25rem 0.375rem",
        borderBottom: "1px solid var(--border)",
      }}>
        <span>Price</span>
        <span style={{ textAlign: "right" }}>Size</span>
        <span style={{ textAlign: "right" }}>Total</span>
      </div>

      {/* Asks (sell side) */}
      <div style={{ display: "flex", flexDirection: "column" }}>
        {asks.map((level, i) => (
          <div
            key={`ask-${i}`}
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr 1fr",
              fontSize: "0.7rem",
              fontFamily: "ui-monospace, monospace",
              padding: "0.2rem 0.25rem",
              position: "relative",
            }}
          >
            <div style={{
              position: "absolute",
              right: 0,
              top: 0,
              bottom: 0,
              width: `${(level.total / maxTotal) * 100}%`,
              background: "rgba(239, 68, 68, 0.08)",
              borderRadius: 2,
            }} />
            <span style={{ color: "#ef4444", position: "relative" }}>
              {(level.price * 100).toFixed(1)}¢
            </span>
            <span style={{ textAlign: "right", position: "relative" }}>
              ${level.size.toFixed(0)}
            </span>
            <span style={{ textAlign: "right", color: "var(--text-muted)", position: "relative" }}>
              ${level.total.toFixed(0)}
            </span>
          </div>
        ))}
      </div>

      {/* Spread indicator */}
      <div style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "0.375rem",
        margin: "0.25rem 0",
        background: "rgba(0,0,0,0.2)",
        borderRadius: 4,
        fontSize: "0.75rem",
        fontFamily: "ui-monospace, monospace",
        fontWeight: 600,
      }}>
        <span style={{ color: "#22c55e" }}>{(yesPrice * 100).toFixed(1)}¢</span>
        <span style={{ margin: "0 0.5rem", color: "var(--text-muted)", fontSize: "0.625rem" }}>│</span>
        <span style={{ color: "#ef4444" }}>{(noPrice * 100).toFixed(1)}¢</span>
      </div>

      {/* Bids (buy side) */}
      <div style={{ display: "flex", flexDirection: "column" }}>
        {bids.map((level, i) => (
          <div
            key={`bid-${i}`}
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr 1fr",
              fontSize: "0.7rem",
              fontFamily: "ui-monospace, monospace",
              padding: "0.2rem 0.25rem",
              position: "relative",
            }}
          >
            <div style={{
              position: "absolute",
              right: 0,
              top: 0,
              bottom: 0,
              width: `${(level.total / maxTotal) * 100}%`,
              background: "rgba(34, 197, 94, 0.08)",
              borderRadius: 2,
            }} />
            <span style={{ color: "#22c55e", position: "relative" }}>
              {(level.price * 100).toFixed(1)}¢
            </span>
            <span style={{ textAlign: "right", position: "relative" }}>
              ${level.size.toFixed(0)}
            </span>
            <span style={{ textAlign: "right", color: "var(--text-muted)", position: "relative" }}>
              ${level.total.toFixed(0)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

import { useState } from "react";
import { Target, TrendingUp, TrendingDown, Wallet } from "lucide-react";
import { formatCurrency } from "../lib/utils";
import type { Portfolio } from "../types";

interface TradingPanelProps {
  portfolio: Portfolio | null;
  yesPrice: number;
  noPrice: number;
  coinColor: string;
  onTrade: (direction: "YES" | "NO", amount: number) => Promise<void>;
}

export function TradingPanel({ portfolio, yesPrice, noPrice, coinColor, onTrade }: TradingPanelProps) {
  const [tradeAmount, setTradeAmount] = useState(1);
  const [tradeDirection, setTradeDirection] = useState<"YES" | "NO">("YES");
  const [tradeSuccess, setTradeSuccess] = useState<string | null>(null);
  const [isTrading, setIsTrading] = useState(false);

  const fee = tradeAmount * 0.02;
  const yesPayout = tradeAmount / yesPrice;
  const noPayout = tradeAmount / noPrice;

  const handleTrade = async () => {
    if (isTrading) return;
    setIsTrading(true);
    try {
      await onTrade(tradeDirection, tradeAmount);
      setTradeSuccess(`Bought ${tradeDirection} for $${tradeAmount}`);
      setTimeout(() => setTradeSuccess(null), 3000);
    } catch (err) {
      console.error("Trade failed:", err);
    } finally {
      setIsTrading(false);
    }
  };

  const canTrade = (portfolio?.balance || 0) >= tradeAmount + fee;

  return (
    <div className="glass-card" style={{ padding: "1rem" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "1rem" }}>
        <Target className="w-4 h-4" style={{ color: coinColor }} />
        <span style={{ fontWeight: 600 }}>Manual Trade</span>
      </div>

      {/* Direction Selection */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem", marginBottom: "1rem" }}>
        <button
          onClick={() => setTradeDirection("YES")}
          className="trade-btn up"
          style={{
            opacity: tradeDirection === "YES" ? 1 : 0.6,
            boxShadow: tradeDirection === "YES" ? "0 0 0 2px var(--green)" : undefined
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.25rem" }}>
            <span style={{ display: "flex", alignItems: "center", gap: "0.25rem" }}>
              <TrendingUp className="w-4 h-4" />
              UP
            </span>
            <span style={{ fontFamily: "monospace" }}>{(yesPrice * 100).toFixed(1)}¢</span>
          </div>
          <p style={{ fontSize: "0.75rem", opacity: 0.8 }}>
            Return: {formatCurrency(yesPayout)}
          </p>
        </button>

        <button
          onClick={() => setTradeDirection("NO")}
          className="trade-btn down"
          style={{
            opacity: tradeDirection === "NO" ? 1 : 0.6,
            boxShadow: tradeDirection === "NO" ? "0 0 0 2px var(--red)" : undefined
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.25rem" }}>
            <span style={{ display: "flex", alignItems: "center", gap: "0.25rem" }}>
              <TrendingDown className="w-4 h-4" />
              DOWN
            </span>
            <span style={{ fontFamily: "monospace" }}>{(noPrice * 100).toFixed(1)}¢</span>
          </div>
          <p style={{ fontSize: "0.75rem", opacity: 0.8 }}>
            Return: {formatCurrency(noPayout)}
          </p>
        </button>
      </div>

      {/* Amount Input */}
      <div style={{ marginBottom: "1rem" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.5rem" }}>
          <span style={{ fontSize: "0.875rem", color: "var(--text-secondary)" }}>Amount</span>
          <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
            Balance: <span style={{ fontFamily: "monospace", color: "var(--text)" }}>{formatCurrency(portfolio?.balance || 0)}</span>
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.5rem" }}>
          <span style={{ fontSize: "1.25rem", color: "var(--text-muted)" }}>$</span>
          <input
            type="number"
            value={tradeAmount}
            onChange={(e) => setTradeAmount(Math.max(0.01, parseFloat(e.target.value) || 0))}
            min={0.01}
            step={0.1}
            className="input"
            style={{ flex: 1 }}
          />
        </div>
        <div className="quick-amounts">
          {[1, 5, 10, 25, 50, 100].map((amt) => (
            <button
              key={amt}
              onClick={() => setTradeAmount(amt)}
              className={`quick-btn ${tradeAmount === amt ? "active" : ""}`}
            >
              +${amt}
            </button>
          ))}
        </div>
      </div>

      {/* Trade Summary */}
      <div style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "0.75rem 0",
        borderTop: "1px solid var(--border)",
        borderBottom: "1px solid var(--border)",
        marginBottom: "1rem"
      }}>
        <span style={{ fontSize: "0.875rem", color: "var(--text-secondary)" }}>Potential Return</span>
        <span style={{ fontFamily: "monospace", fontWeight: 700, fontSize: "1.125rem" }}>
          {formatCurrency(tradeDirection === "YES" ? yesPayout : noPayout)}
        </span>
      </div>

      {/* Trade Button */}
      <button
        onClick={handleTrade}
        disabled={!canTrade || isTrading}
        style={{
          width: "100%",
          padding: "0.875rem",
          borderRadius: 10,
          fontWeight: 600,
          color: "white",
          border: "none",
          cursor: !canTrade || isTrading ? "not-allowed" : "pointer",
          opacity: !canTrade || isTrading ? 0.5 : 1,
          background: tradeDirection === "YES" ? "var(--green)" : "var(--red)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: "0.5rem"
        }}
      >
        {isTrading ? (
          <span>Processing...</span>
        ) : (
          <>
            {tradeDirection === "YES" ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
            Buy {tradeDirection === "YES" ? "UP" : "DOWN"}
          </>
        )}
      </button>

      {tradeSuccess && (
        <div style={{
          marginTop: "0.75rem",
          padding: "0.5rem",
          background: "var(--green-muted)",
          borderRadius: 8,
          textAlign: "center",
          color: "var(--green)",
          fontSize: "0.875rem",
          animation: "fadeIn 0.3s"
        }}>
          {tradeSuccess}
        </div>
      )}

      {!canTrade && (
        <div style={{
          marginTop: "0.75rem",
          padding: "0.5rem",
          background: "rgba(239, 68, 68, 0.1)",
          borderRadius: 8,
          textAlign: "center",
          color: "var(--red)",
          fontSize: "0.875rem"
        }}>
          Insufficient balance for this trade
        </div>
      )}
    </div>
  );
}

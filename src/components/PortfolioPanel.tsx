import { Wallet, Target, LineChart, TrendingUp, TrendingDown, RefreshCw } from "lucide-react";
import { formatCurrency, formatPercentage } from "../lib/utils";
import { PnLChart } from "./pnl-chart";
import type { Portfolio } from "../types";
import type { Position } from "../hooks/useTradingData";

interface PortfolioPanelProps {
  portfolio: Portfolio | null;
  coinColor: string;
  pnlHistory: { time: number; pnl: number }[];
  onClosePosition: (positionId: string) => Promise<void>;
  onReset: () => Promise<void>;
  compact?: boolean;
}

export function PortfolioPanel({ portfolio, coinColor, pnlHistory, onClosePosition, onReset, compact }: PortfolioPanelProps) {
  const openPositions = portfolio?.openPositions as Position[] || [];

  const handleReset = async () => {
    if (confirm("Are you sure you want to reset your portfolio? This cannot be undone.")) {
      await onReset();
    }
  };

  // Compact mode - horizontal stats bar
  if (compact) {
    const pnl = portfolio?.totalPnL || 0;
    const roi = portfolio?.roi || 0;
    return (
      <div className="glass-card" style={{
        padding: "0.75rem 1rem",
        display: "flex",
        alignItems: "center",
        gap: "2rem",
        flexWrap: "wrap"
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <Wallet className="w-4 h-4" style={{ color: coinColor }} />
          <span style={{ fontWeight: 600, fontSize: "0.875rem" }}>Portfolio</span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "1.5rem" }}>
          <div style={{ textAlign: "center" }}>
            <span style={{ fontSize: "0.625rem", color: "var(--text-muted)", display: "block", textTransform: "uppercase", letterSpacing: "0.05em" }}>Balance</span>
            <span style={{ fontFamily: "ui-monospace, monospace", fontWeight: 600, fontSize: "0.875rem" }}>{formatCurrency(portfolio?.balance || 0)}</span>
          </div>

          <div style={{ textAlign: "center" }}>
            <span style={{ fontSize: "0.625rem", color: "var(--text-muted)", display: "block", textTransform: "uppercase", letterSpacing: "0.05em" }}>P&L</span>
            <span style={{
              fontFamily: "ui-monospace, monospace",
              fontWeight: 600,
              fontSize: "0.875rem",
              color: pnl >= 0 ? "var(--green)" : "var(--red)"
            }}>
              {pnl >= 0 ? "+" : ""}{formatCurrency(pnl)}
            </span>
          </div>

          <div style={{ textAlign: "center" }}>
            <span style={{ fontSize: "0.625rem", color: "var(--text-muted)", display: "block", textTransform: "uppercase", letterSpacing: "0.05em" }}>ROI</span>
            <span style={{
              fontFamily: "ui-monospace, monospace",
              fontWeight: 600,
              fontSize: "0.875rem",
              color: roi >= 0 ? "var(--green)" : "var(--red)"
            }}>
              {roi >= 0 ? "+" : ""}{formatPercentage(roi / 100)}
            </span>
          </div>

          <div style={{ textAlign: "center" }}>
            <span style={{ fontSize: "0.625rem", color: "var(--text-muted)", display: "block", textTransform: "uppercase", letterSpacing: "0.05em" }}>Win Rate</span>
            <span style={{ fontFamily: "ui-monospace, monospace", fontWeight: 600, fontSize: "0.875rem" }}>{formatPercentage(portfolio?.winRate || 0)}</span>
          </div>

          <div style={{ textAlign: "center" }}>
            <span style={{ fontSize: "0.625rem", color: "var(--text-muted)", display: "block", textTransform: "uppercase", letterSpacing: "0.05em" }}>Trades</span>
            <span style={{ fontFamily: "ui-monospace, monospace", fontWeight: 600, fontSize: "0.875rem" }}>{portfolio?.totalTrades || 0}</span>
          </div>

          <div style={{ textAlign: "center" }}>
            <span style={{ fontSize: "0.625rem", color: "var(--text-muted)", display: "block", textTransform: "uppercase", letterSpacing: "0.05em" }}>Positions</span>
            <span style={{ fontFamily: "ui-monospace, monospace", fontWeight: 600, fontSize: "0.875rem" }}>{openPositions.length}</span>
          </div>
        </div>

        <button
          onClick={handleReset}
          className="quick-btn"
          style={{ marginLeft: "auto", fontSize: "0.75rem" }}
        >
          <RefreshCw className="w-3 h-3" />
        </button>
      </div>
    );
  }

  // Full mode - detailed view
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
      {/* Portfolio Stats */}
      <div className="glass-card" style={{ padding: "1rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "1rem" }}>
          <Wallet className="w-4 h-4" style={{ color: coinColor }} />
          <span style={{ fontWeight: 600 }}>Portfolio</span>
        </div>

        <div className="stats-grid">
          <div className="stat-item">
            <span className="stat-label">Balance</span>
            <span className="stat-value">{formatCurrency(portfolio?.balance || 0)}</span>
          </div>
          <div className="stat-item">
            <span className="stat-label">Total P&L</span>
            <span className="stat-value" style={{ color: (portfolio?.totalPnL || 0) >= 0 ? "var(--green)" : "var(--red)" }}>
              {formatCurrency(portfolio?.totalPnL || 0)}
            </span>
          </div>
          <div className="stat-item">
            <span className="stat-label">Win Rate</span>
            <span className="stat-value">{formatPercentage(portfolio?.winRate || 0)}</span>
          </div>
          <div className="stat-item">
            <span className="stat-label">Trades</span>
            <span className="stat-value">{portfolio?.totalTrades || 0}</span>
          </div>
        </div>

        {/* Additional Metrics */}
        <div style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr 1fr",
          gap: "0.5rem",
          marginTop: "1rem",
          padding: "0.75rem",
          background: "var(--glass-bg)",
          borderRadius: 8
        }}>
          <div style={{ textAlign: "center" }}>
            <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", display: "block" }}>ROI</span>
            <span style={{
              fontFamily: "monospace",
              fontWeight: 600,
              color: (portfolio?.roi || 0) >= 0 ? "var(--green)" : "var(--red)"
            }}>
              {formatPercentage((portfolio?.roi || 0) / 100)}
            </span>
          </div>
          <div style={{ textAlign: "center" }}>
            <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", display: "block" }}>Max Drawdown</span>
            <span style={{ fontFamily: "monospace", fontWeight: 600, color: "var(--red)" }}>
              {formatPercentage(portfolio?.maxDrawdown || 0)}
            </span>
          </div>
          <div style={{ textAlign: "center" }}>
            <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", display: "block" }}>Sharpe Ratio</span>
            <span style={{ fontFamily: "monospace", fontWeight: 600 }}>
              {(portfolio?.sharpeRatio || 0).toFixed(2)}
            </span>
          </div>
        </div>

        {/* PnL Chart */}
        {pnlHistory.length > 1 && (
          <div style={{ marginTop: "1rem", padding: "0.75rem", background: "var(--glass-bg)", borderRadius: 8 }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.5rem" }}>
              <LineChart className="w-3 h-3" style={{ color: "var(--text-muted)" }} />
              <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>P&L History</span>
            </div>
            <PnLChart data={pnlHistory} height={80} />
          </div>
        )}
      </div>

      {/* Open Positions */}
      <div className="glass-card" style={{ padding: "1rem" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.75rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <Target className="w-4 h-4" style={{ color: coinColor }} />
            <span style={{ fontWeight: 600 }}>Positions</span>
          </div>
          <span className="badge badge-primary">{openPositions.length}</span>
        </div>

        {openPositions.length > 0 ? (
          <div style={{ maxHeight: 200, overflowY: "auto" }}>
            {openPositions.map((pos) => (
              <div key={pos.id} className="position-item">
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                  <span className={`badge ${pos.outcome === "YES" ? "badge-green" : "badge-red"}`}>
                    {pos.outcome === "YES" ? (
                      <><TrendingUp className="w-3 h-3" style={{ display: "inline" }} /> UP</>
                    ) : (
                      <><TrendingDown className="w-3 h-3" style={{ display: "inline" }} /> DOWN</>
                    )}
                  </span>
                  <div>
                    <p style={{ fontWeight: 500, fontSize: "0.875rem" }}>{formatCurrency(pos.amount)}</p>
                    <p style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>@{pos.odds.toFixed(3)}</p>
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                  <span style={{
                    fontFamily: "monospace",
                    fontSize: "0.875rem",
                    color: (pos.unrealizedPnl || 0) >= 0 ? "var(--green)" : "var(--red)"
                  }}>
                    {formatCurrency(pos.unrealizedPnl || 0)}
                  </span>
                  <button
                    onClick={() => onClosePosition(pos.id)}
                    className="quick-btn"
                    style={{ fontSize: "0.75rem" }}
                  >
                    Close
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ textAlign: "center", padding: "1.5rem", color: "var(--text-muted)" }}>
            <Target className="w-6 h-6" style={{ margin: "0 auto 0.5rem", opacity: 0.5 }} />
            <p style={{ fontSize: "0.875rem" }}>No open positions</p>
            <p style={{ fontSize: "0.75rem", marginTop: "0.25rem" }}>
              Place a trade to get started
            </p>
          </div>
        )}
      </div>

      {/* Reset */}
      <button
        onClick={handleReset}
        style={{
          width: "100%",
          padding: "0.5rem",
          fontSize: "0.875rem",
          color: "var(--text-muted)",
          background: "transparent",
          border: "none",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: "0.5rem"
        }}
      >
        <RefreshCw className="w-3 h-3" />
        Reset Portfolio
      </button>
    </div>
  );
}
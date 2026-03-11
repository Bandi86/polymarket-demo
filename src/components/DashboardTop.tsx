import { useMemo } from "react";
import { Wallet, TrendingUp, TrendingDown, Clock, Bot, Target, DollarSign, Activity, Info } from "lucide-react";
import { formatCurrency, formatPercentage } from "../lib/utils";
import type { Portfolio, MarketData, BotData } from "../hooks/useTradingData";

interface DashboardTopProps {
  portfolio: Portfolio | null;
  marketData: MarketData | null;
  bots: BotData[];
  yesPrice: number;
  noPrice: number;
  pnlHistory: { time: number; pnl: number }[];
  coinColor: string;
}

export function DashboardTop({ portfolio, marketData, bots, yesPrice, noPrice, pnlHistory, coinColor }: DashboardTopProps) {
  const timeRemaining = marketData?.timeRemaining || 0;
  const minutes = Math.floor(timeRemaining / 60000);
  const seconds = Math.floor((timeRemaining % 60000) / 1000);
  const isUrgent = timeRemaining < 60000 && timeRemaining > 0;

  // Bot stats
  const activeBots = bots.filter(b => b.enabled).length;
  const totalBotTrades = bots.reduce((s, b) => s + b.stats.trades, 0);
  const totalBotPnl = bots.reduce((s, b) => s + b.stats.pnl, 0);

  // Calculate total value (balance + open positions value)
  const balance = portfolio?.balance || 0;
  const totalPnL = portfolio?.totalPnL || 0;
  const winRate = portfolio?.winRate || 0;

  // Price display helpers
  const yesPercent = (yesPrice * 100).toFixed(1);
  const noPercent = (noPrice * 100).toFixed(1);

  return (
    <div style={{
      background: "linear-gradient(135deg, hsl(222, 47%, 7%) 0%, hsl(222, 47%, 12%) 100%)",
      borderRadius: 16,
      padding: "1.25rem",
      border: "1px solid hsl(217, 33%, 17%)"
    }}>
      {/* Main Stats Row */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: "1rem" }}>
        {/* Portfolio Balance */}
        <div style={{ 
          padding: "1rem", 
          background: "hsl(222, 47%, 7%)", 
          borderRadius: 12,
          border: "1px solid hsl(217, 33%, 20%)"
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.5rem" }}>
            <Wallet className="w-4 h-4" style={{ color: coinColor }} />
            <span style={{ fontSize: "0.75rem", color: "hsl(215, 20%, 65%)", fontWeight: 500 }}>Balance</span>
          </div>
          <div style={{ fontSize: "1.5rem", fontWeight: 700, fontFamily: "ui-monospace, monospace" }}>
            {formatCurrency(balance)}
          </div>
          <div style={{ fontSize: "0.625rem", color: "hsl(215, 20%, 50%)", marginTop: "0.25rem" }}>
            Virtual money for trading
          </div>
        </div>

        {/* Total P&L */}
        <div style={{ 
          padding: "1rem", 
          background: "hsl(222, 47%, 7%)", 
          borderRadius: 12,
          border: "1px solid hsl(217, 33%, 20%)"
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.5rem" }}>
            {totalPnL >= 0 ? (
              <TrendingUp className="w-4 h-4" style={{ color: "#22c55e" }} />
            ) : (
              <TrendingDown className="w-4 h-4" style={{ color: "#ef4444" }} />
            )}
            <span style={{ fontSize: "0.75rem", color: "hsl(215, 20%, 65%)", fontWeight: 500 }}>Total P&L</span>
          </div>
          <div style={{ 
            fontSize: "1.5rem", 
            fontWeight: 700, 
            fontFamily: "ui-monospace, monospace",
            color: totalPnL >= 0 ? "#22c55e" : "#ef4444"
          }}>
            {totalPnL >= 0 ? "+" : ""}{formatCurrency(totalPnL)}
          </div>
          <div style={{ fontSize: "0.625rem", color: "hsl(215, 20%, 50%)", marginTop: "0.25rem" }}>
            Your profit or loss
          </div>
        </div>

        {/* Win Rate */}
        <div style={{ 
          padding: "1rem", 
          background: "hsl(222, 47%, 7%)", 
          borderRadius: 12,
          border: "1px solid hsl(217, 33%, 20%)"
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.5rem" }}>
            <Target className="w-4 h-4" style={{ color: "#3b82f6" }} />
            <span style={{ fontSize: "0.75rem", color: "hsl(215, 20%, 65%)", fontWeight: 500 }}>Win Rate</span>
          </div>
          <div style={{ fontSize: "1.5rem", fontWeight: 700, fontFamily: "ui-monospace, monospace" }}>
            {formatPercentage(winRate)}
          </div>
          <div style={{ fontSize: "0.625rem", color: "hsl(215, 20%, 50%)", marginTop: "0.25rem" }}>
            Trades that made money
          </div>
        </div>

        {/* Timer */}
        <div style={{ 
          padding: "1rem", 
          background: isUrgent ? "hsla(0, 84%, 60%, 0.15)" : "hsl(222, 47%, 7%)", 
          borderRadius: 12,
          border: isUrgent ? "1px solid hsla(0, 84%, 60%, 0.5)" : "1px solid hsl(217, 33%, 20%)"
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.5rem" }}>
            <Clock className="w-4 h-4" style={{ color: isUrgent ? "#ef4444" : "#f59e0b" }} />
            <span style={{ fontSize: "0.75rem", color: "hsl(215, 20%, 65%)", fontWeight: 500 }}>Time Left</span>
          </div>
          <div style={{ 
            fontSize: "1.5rem", 
            fontWeight: 700, 
            fontFamily: "ui-monospace, monospace",
            color: isUrgent ? "#ef4444" : "#f59e0b"
          }}>
            {minutes}:{seconds.toString().padStart(2, '0')}
          </div>
          <div style={{ fontSize: "0.625rem", color: "hsl(215, 20%, 50%)", marginTop: "0.25rem" }}>
            Until market settles
          </div>
        </div>

        {/* Current Prices */}
        <div style={{ 
          padding: "1rem", 
          background: "hsl(222, 47%, 7%)", 
          borderRadius: 12,
          border: "1px solid hsl(217, 33%, 20%)",
          gridColumn: "span 2"
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.5rem" }}>
            <Activity className="w-4 h-4" style={{ color: "#3b82f6" }} />
            <span style={{ fontSize: "0.75rem", color: "hsl(215, 20%, 65%)", fontWeight: 500 }}>Market Odds</span>
          </div>
          <div style={{ display: "flex", gap: "1rem", marginTop: "0.25rem" }}>
            <div style={{ flex: 1 }}>
              <div style={{ 
                display: "inline-flex",
                alignItems: "center",
                gap: "0.25rem",
                padding: "0.25rem 0.5rem",
                background: "rgba(34, 197, 94, 0.15)",
                borderRadius: 6,
                marginBottom: "0.25rem"
              }}>
                <TrendingUp className="w-3 h-3" style={{ color: "#22c55e" }} />
                <span style={{ fontSize: "0.625rem", fontWeight: 600, color: "#22c55e" }}>UP</span>
              </div>
              <div style={{ fontSize: "1.25rem", fontWeight: 700, fontFamily: "ui-monospace, monospace" }}>
                {yesPercent}%
              </div>
            </div>
            <div style={{ width: 1, background: "hsl(217, 33%, 20%)" }} />
            <div style={{ flex: 1 }}>
              <div style={{ 
                display: "inline-flex",
                alignItems: "center",
                gap: "0.25rem",
                padding: "0.25rem 0.5rem",
                background: "rgba(239, 68, 68, 0.15)",
                borderRadius: 6,
                marginBottom: "0.25rem"
              }}>
                <TrendingDown className="w-3 h-3" style={{ color: "#ef4444" }} />
                <span style={{ fontSize: "0.625rem", fontWeight: 600, color: "#ef4444" }}>DOWN</span>
              </div>
              <div style={{ fontSize: "1.25rem", fontWeight: 700, fontFamily: "ui-monospace, monospace" }}>
                {noPercent}%
              </div>
            </div>
          </div>
          <div style={{ fontSize: "0.625rem", color: "hsl(215, 20%, 50%)", marginTop: "0.5rem", display: "flex", alignItems: "center", gap: "0.25rem" }}>
            <Info className="w-3 h-3" />
            Higher % = more people betting that outcome
          </div>
        </div>
      </div>

      {/* Bot Summary Row */}
      <div style={{ 
        display: "flex", 
        alignItems: "center", 
        gap: "1.5rem", 
        marginTop: "1rem", 
        padding: "0.75rem 1rem",
        background: "hsl(222, 47%, 5%)",
        borderRadius: 8
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <Bot className="w-4 h-4" style={{ color: "#3b82f6" }} />
          <span style={{ fontSize: "0.875rem", color: "hsl(210, 40%, 98%)" }}>
            <strong>{activeBots}</strong> of {bots.length} bots active
          </span>
        </div>
        <div style={{ width: 1, height: 20, background: "hsl(217, 33%, 20%)" }} />
        <div style={{ fontSize: "0.875rem", color: "hsl(215, 20%, 65%)" }}>
          Bot trades: <strong style={{ color: "hsl(210, 40%, 98%)" }}>{totalBotTrades}</strong>
        </div>
        <div style={{ width: 1, height: 20, background: "hsl(217, 33%, 20%)" }} />
        <div style={{ fontSize: "0.875rem", color: "hsl(215, 20%, 65%)" }}>
          Bot P&L: <strong style={{ color: totalBotPnl >= 0 ? "#22c55e" : "#ef4444" }}>
            {totalBotPnl >= 0 ? "+" : ""}{formatCurrency(totalBotPnl)}
          </strong>
        </div>
      </div>
    </div>
  );
}
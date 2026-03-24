'use client'

import { useState, useEffect } from "react";
import { X, Save, RotateCcw, Info } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import type { BotData } from "@/hooks/useTradingData";

interface BotConfigPanelProps {
  bot: BotData;
  onClose: () => void;
  onSave: (botId: string, config: Partial<BotData>) => Promise<void>;
}

const STRATEGY_DESCRIPTIONS: Record<string, string> = {
  random: "Randomly buys YES or NO based on market conditions",
  momentum: "Follows price momentum - buys in direction of recent price movement",
  mean_reversion: "Bets against extreme price movements - expects price to revert",
  trend: "Identifies and follows established trends",
  smart_trend: "Enhanced trend following with multiple confirmations",
  contrarian: "Bets against the crowd when sentiment is extreme",
  volatility: "Trades based on price volatility patterns",
  fair_value: "Bets when price deviates significantly from fair value (0.5)",
  anomaly: "Detects and exploits pricing anomalies",
  momentum_burst: "Looks for sudden momentum spikes",
  grid_trading: "Places orders at fixed intervals around current price",
  market_making: "Provides liquidity by posting both sides",
  arbitrage: "Exploits price discrepancies",
  binance_signal: "Uses Binance BTC price movements as signals",
  last_seconds_scalp: "Quick scalps in final seconds of market",
};

export function BotConfigPanel({ bot, onClose, onSave }: BotConfigPanelProps) {
  const [betSize, setBetSize] = useState(bot.betSize);
  const [interval, setInterval] = useState(bot.interval);
  const [useKelly, setUseKelly] = useState(bot.useKelly ?? true);
  const [kellyFraction, setKellyFraction] = useState(bot.kellyFraction ?? 0.5);
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    setHasChanges(
      betSize !== bot.betSize ||
      interval !== bot.interval ||
      useKelly !== (bot.useKelly ?? true) ||
      kellyFraction !== (bot.kellyFraction ?? 0.5)
    );
  }, [betSize, interval, useKelly, kellyFraction, bot.betSize, bot.interval, bot.useKelly, bot.kellyFraction]);

  const handleSave = async () => {
    if (isSaving || !hasChanges) return;
    setIsSaving(true);
    try {
      await onSave(bot.id, { betSize, interval, useKelly, kellyFraction });
      onClose();
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = () => {
    setBetSize(bot.betSize);
    setInterval(bot.interval);
    setUseKelly(bot.useKelly ?? true);
    setKellyFraction(bot.kellyFraction ?? 0.5);
  };

  // Calculate potential outcomes
  const tradesPerMinute = 60 / interval;
  const potentialRiskPerMinute = tradesPerMinute * betSize;

  return (
    <div
      className="glass-card"
      style={{
        position: "fixed",
        top: "50%",
        left: "50%",
        transform: "translate(-50%, -50%)",
        width: "90%",
        maxWidth: 400,
        padding: "1.5rem",
        zIndex: 1000,
        boxShadow: "0 20px 60px rgba(0,0,0,0.5)"
      }}
    >
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1.5rem" }}>
        <div>
          <h3 style={{ margin: 0, fontSize: "1.125rem", fontWeight: 600 }}>{bot.name}</h3>
          <span style={{
            fontSize: "0.75rem",
            padding: "0.125rem 0.5rem",
            borderRadius: 4,
            background: "rgba(59, 130, 246, 0.2)",
            color: "#3b82f6"
          }}>
            {bot.strategy}
          </span>
        </div>
        <button
          onClick={onClose}
          style={{
            padding: "0.25rem",
            background: "transparent",
            border: "none",
            cursor: "pointer",
            color: "var(--text-muted)"
          }}
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Strategy Info */}
      <div style={{
        padding: "0.75rem",
        background: "rgba(0,0,0,0.2)",
        borderRadius: 8,
        marginBottom: "1.5rem",
        display: "flex",
        gap: "0.5rem"
      }}>
        <Info className="w-4 h-4" style={{ color: "#3b82f6", flexShrink: 0, marginTop: "0.125rem" }} />
        <p style={{ margin: 0, fontSize: "0.75rem", color: "var(--text-secondary)" }}>
          {STRATEGY_DESCRIPTIONS[bot.strategy] || "Custom trading strategy"}
        </p>
      </div>

      {/* Bet Size Slider */}
      <div style={{ marginBottom: "1.5rem" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.5rem" }}>
          <label style={{ fontSize: "0.875rem", fontWeight: 500 }}>Bet Size</label>
          <span style={{ fontFamily: "ui-monospace, monospace", fontSize: "0.875rem", fontWeight: 600 }}>
            {formatCurrency(betSize)}
          </span>
        </div>
        <input
          type="range"
          min={0.5}
          max={5}
          step={0.25}
          value={betSize}
          onChange={(e) => setBetSize(parseFloat(e.target.value))}
          style={{
            width: "100%",
            accentColor: "var(--primary)"
          }}
        />
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.625rem", color: "var(--text-muted)" }}>
          <span>$0.50</span>
          <span>$5.00</span>
        </div>
      </div>

      {/* Interval Slider */}
      <div style={{ marginBottom: "1.5rem" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.5rem" }}>
          <label style={{ fontSize: "0.875rem", fontWeight: 500 }}>Interval</label>
          <span style={{ fontFamily: "ui-monospace, monospace", fontSize: "0.875rem", fontWeight: 600 }}>
            {interval}s
          </span>
        </div>
        <input
          type="range"
          min={5}
          max={60}
          step={5}
          value={interval}
          onChange={(e) => setInterval(parseInt(e.target.value))}
          style={{
            width: "100%",
            accentColor: "var(--primary)"
          }}
        />
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.625rem", color: "var(--text-muted)" }}>
          <span>5s (Aggressive)</span>
          <span>60s (Conservative)</span>
        </div>
      </div>

      {/* Kelly Criterion Toggle */}
      <div style={{
        padding: "1rem",
        background: useKelly ? "rgba(34, 197, 94, 0.1)" : "rgba(0,0,0,0.2)",
        borderRadius: 8,
        marginBottom: "1.5rem",
        border: useKelly ? "1px solid rgba(34, 197, 94, 0.3)" : "1px solid transparent"
      }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: useKelly ? "1rem" : "0" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <label style={{ fontSize: "0.875rem", fontWeight: 500 }}>Kelly Criterion</label>
            <span style={{
              fontSize: "0.625rem",
              padding: "0.125rem 0.375rem",
              borderRadius: 4,
              background: useKelly ? "rgba(34, 197, 94, 0.2)" : "rgba(107, 114, 128, 0.2)",
              color: useKelly ? "#22c55e" : "var(--text-muted)"
            }}>
              {useKelly ? "Active" : "Fixed"}
            </span>
          </div>
          <button
            onClick={() => setUseKelly(!useKelly)}
            style={{
              width: 44,
              height: 24,
              borderRadius: 12,
              border: "none",
              background: useKelly ? "#22c55e" : "var(--glass-border)",
              cursor: "pointer",
              position: "relative",
              transition: "background 0.2s"
            }}
          >
            <div style={{
              width: 20,
              height: 20,
              borderRadius: "50%",
              background: "white",
              position: "absolute",
              top: 2,
              left: useKelly ? 22 : 2,
              transition: "left 0.2s"
            }} />
          </button>
        </div>

        {useKelly && (
          <>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.5rem" }}>
              <label style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>Kelly Fraction</label>
              <span style={{ fontFamily: "ui-monospace, monospace", fontSize: "0.75rem", fontWeight: 600, color: "#22c55e" }}>
                {(kellyFraction * 100).toFixed(0)}% (Half-Kelly)
              </span>
            </div>
            <input
              type="range"
              min={0.1}
              max={1}
              step={0.1}
              value={kellyFraction}
              onChange={(e) => setKellyFraction(parseFloat(e.target.value))}
              style={{
                width: "100%",
                accentColor: "#22c55e"
              }}
            />
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.625rem", color: "var(--text-muted)" }}>
              <span>10% (Conservative)</span>
              <span>100% (Full Kelly)</span>
            </div>
            <p style={{ margin: "0.5rem 0 0", fontSize: "0.625rem", color: "var(--text-muted)" }}>
              Kelly dynamically adjusts bet size based on your edge and bankroll. Half-Kelly is recommended for safety.
            </p>
          </>
        )}
      </div>

      {/* Preview Stats */}
      <div style={{
        padding: "1rem",
        background: "rgba(0,0,0,0.2)",
        borderRadius: 8,
        marginBottom: "1.5rem"
      }}>
        <div style={{ fontSize: "0.75rem", fontWeight: 600, marginBottom: "0.75rem", color: "var(--text-secondary)" }}>
          Estimated Activity
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "0.5rem" }}>
          <div>
            <div style={{ fontSize: "0.625rem", color: "var(--text-muted)" }}>Trades/min</div>
            <div style={{ fontFamily: "ui-monospace, monospace", fontWeight: 600 }}>
              {tradesPerMinute.toFixed(1)}
            </div>
          </div>
          <div>
            <div style={{ fontSize: "0.625rem", color: "var(--text-muted)" }}>Risk/min</div>
            <div style={{
              fontFamily: "ui-monospace, monospace",
              fontWeight: 600,
              color: potentialRiskPerMinute > 5 ? "#f59e0b" : "var(--text-primary)"
            }}>
              {formatCurrency(potentialRiskPerMinute)}
            </div>
          </div>
        </div>
      </div>

      {/* Current Stats */}
      <div style={{
        padding: "1rem",
        background: "rgba(59, 130, 246, 0.1)",
        borderRadius: 8,
        marginBottom: "1.5rem",
        border: "1px solid rgba(59, 130, 246, 0.2)"
      }}>
        <div style={{ fontSize: "0.75rem", fontWeight: 600, marginBottom: "0.5rem", color: "#3b82f6" }}>
          Current Performance
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "0.5rem" }}>
          <div>
            <div style={{ fontSize: "0.625rem", color: "var(--text-muted)" }}>Balance</div>
            <div style={{ fontFamily: "ui-monospace, monospace", fontWeight: 600 }}>
              {formatCurrency(bot.portfolio.balance)}
            </div>
          </div>
          <div>
            <div style={{ fontSize: "0.625rem", color: "var(--text-muted)" }}>Trades</div>
            <div style={{ fontFamily: "ui-monospace, monospace" }}>{bot.stats.trades}</div>
          </div>
          <div>
            <div style={{ fontSize: "0.625rem", color: "var(--text-muted)" }}>Win Rate</div>
            <div style={{
              fontFamily: "ui-monospace, monospace",
              color: bot.stats.winRate >= 0.5 ? "#22c55e" : "#ef4444"
            }}>
              {(bot.stats.winRate * 100).toFixed(0)}%
            </div>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div style={{ display: "flex", gap: "0.5rem" }}>
        <button
          onClick={handleReset}
          disabled={!hasChanges}
          style={{
            flex: 1,
            padding: "0.75rem",
            borderRadius: 8,
            border: "1px solid var(--border)",
            background: "transparent",
            color: "var(--text-secondary)",
            fontSize: "0.875rem",
            cursor: hasChanges ? "pointer" : "not-allowed",
            opacity: hasChanges ? 1 : 0.5,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "0.5rem"
          }}
        >
          <RotateCcw className="w-4 h-4" />
          Reset
        </button>
        <button
          onClick={handleSave}
          disabled={!hasChanges || isSaving}
          style={{
            flex: 2,
            padding: "0.75rem",
            borderRadius: 8,
            border: "none",
            background: hasChanges
              ? "linear-gradient(135deg, #3b82f6, #2563eb)"
              : "var(--glass-bg)",
            color: "white",
            fontSize: "0.875rem",
            fontWeight: 600,
            cursor: hasChanges && !isSaving ? "pointer" : "not-allowed",
            opacity: hasChanges ? 1 : 0.5,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "0.5rem"
          }}
        >
          <Save className="w-4 h-4" />
          {isSaving ? "Saving..." : "Save Changes"}
        </button>
      </div>
    </div>
  );
}
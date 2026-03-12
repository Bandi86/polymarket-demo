// Strategy Recommendation - Auto-strategy selection based on market conditions
import { useState, useEffect, useCallback } from "react";
import { Zap, TrendingUp, TrendingDown, Activity, Target, ArrowRight, RefreshCw } from "lucide-react";

interface MarketRecommendation {
  phase: "trending_up" | "trending_down" | "ranging" | "volatile";
  confidence: number;
  recommendedStrategy: string;
  alternativeStrategies: string[];
  reason: string;
  metrics: {
    trendStrength: number;
    volatilityLevel: number;
    pricePosition: number;
  };
}

const PHASE_CONFIG: Record<MarketRecommendation["phase"], { icon: typeof Activity; color: string; label: string }> = {
  trending_up: { icon: TrendingUp, color: "#22c55e", label: "Trending Up" },
  trending_down: { icon: TrendingDown, color: "#ef4444", label: "Trending Down" },
  ranging: { icon: Activity, color: "#3b82f6", label: "Ranging" },
  volatile: { icon: Zap, color: "#f59e0b", label: "Volatile" },
};

export function StrategyRecommendation() {
  const [recommendation, setRecommendation] = useState<MarketRecommendation | null>(null);
  const [loading, setLoading] = useState(true);
  const [switching, setSwitching] = useState(false);

  const fetchRecommendation = useCallback(async () => {
    try {
      const res = await fetch("/api/analytics/recommendation");
      const data = await res.json();
      setRecommendation(data);
    } catch (err) {
      console.error("Failed to fetch recommendation:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRecommendation();
    const interval = setInterval(fetchRecommendation, 5000);
    return () => clearInterval(interval);
  }, [fetchRecommendation]);

  const switchToRecommended = async () => {
    if (!recommendation) return;

    setSwitching(true);
    try {
      // Stop all bots first
      await fetch("/api/bots/stop-all", { method: "POST" });

      // Enable only the recommended strategy
      const bots = await fetch("/api/bots").then(r => r.json());
      const targetBot = bots.find((b: { strategy: string }) => b.strategy === recommendation.recommendedStrategy);

      if (targetBot) {
        await fetch(`/api/bots/${targetBot.id}/toggle`, { method: "POST" });
      }

      // Refresh recommendation
      await fetchRecommendation();
    } catch (err) {
      console.error("Failed to switch strategy:", err);
    } finally {
      setSwitching(false);
    }
  };

  const getStrategyDisplayName = (strategy: string): string => {
    const names: Record<string, string> = {
      momentum: "Momentum",
      mean_reversion: "Mean Reversion",
      trend: "Trend",
      smart_trend: "Smart Trend",
      contrarian: "Contrarian",
      fair_value: "Fair Value",
      arbitrage: "Arbitrage",
      grid_trading: "Grid Trading",
      binance_signal: "Binance Signal",
      last_seconds_scalp: "Last Seconds Scalp",
      momentum_burst: "Momentum Burst",
      random: "Random",
    };
    return names[strategy] || strategy;
  };

  if (loading) {
    return (
      <div className="glass-card" style={{ padding: "1rem" }}>
        <div className="loading-spinner" style={{ margin: "1rem auto" }} />
      </div>
    );
  }

  if (!recommendation) {
    return (
      <div className="glass-card" style={{ padding: "1rem", textAlign: "center" }}>
        <p style={{ color: "var(--text-muted)" }}>No recommendation available. Need more market data.</p>
      </div>
    );
  }

  const phaseConfig = PHASE_CONFIG[recommendation.phase];
  const PhaseIcon = phaseConfig.icon;

  return (
    <div className="glass-card" style={{ padding: "1rem" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <Target className="w-5 h-5" style={{ color: "var(--primary)" }} />
          <span style={{ fontWeight: 600, fontSize: "1.125rem" }}>Strategy Recommendation</span>
        </div>
        <button
          onClick={fetchRecommendation}
          className="quick-btn"
          style={{ display: "flex", alignItems: "center", gap: "0.25rem" }}
        >
          <RefreshCw className="w-3 h-3" />
          Refresh
        </button>
      </div>

      {/* Market Phase Badge */}
      <div style={{
        display: "flex",
        alignItems: "center",
        gap: "0.75rem",
        padding: "0.75rem",
        background: `${phaseConfig.color}15`,
        borderRadius: 8,
        border: `1px solid ${phaseConfig.color}30`,
        marginBottom: "1rem",
      }}>
        <div style={{
          width: 40,
          height: 40,
          borderRadius: "50%",
          background: `${phaseConfig.color}20`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}>
          <PhaseIcon className="w-5 h-5" style={{ color: phaseConfig.color }} />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 600, color: phaseConfig.color }}>{phaseConfig.label}</div>
          <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>{recommendation.reason}</div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: "0.625rem", color: "var(--text-muted)" }}>Confidence</div>
          <div style={{ fontFamily: "ui-monospace, monospace", fontWeight: 600 }}>
            {(recommendation.confidence * 100).toFixed(0)}%
          </div>
        </div>
      </div>

      {/* Recommended Strategy */}
      <div style={{
        padding: "1rem",
        background: "linear-gradient(135deg, rgba(59, 130, 246, 0.1), rgba(99, 102, 241, 0.1))",
        borderRadius: 8,
        border: "1px solid rgba(59, 130, 246, 0.2)",
        marginBottom: "1rem",
      }}>
        <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginBottom: "0.25rem" }}>
          Recommended Strategy
        </div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ fontWeight: 600, fontSize: "1.25rem" }}>
            {getStrategyDisplayName(recommendation.recommendedStrategy)}
          </span>
          <button
            onClick={switchToRecommended}
            disabled={switching}
            className="trade-btn up"
            style={{ display: "flex", alignItems: "center", gap: "0.25rem", padding: "0.375rem 0.75rem", fontSize: "0.875rem" }}
          >
            {switching ? (
              <>
                <RefreshCw className="w-3 h-3 animate-spin" />
                Switching...
              </>
            ) : (
              <>
                Switch <ArrowRight className="w-3 h-3" />
              </>
            )}
          </button>
        </div>
      </div>

      {/* Alternative Strategies */}
      {recommendation.alternativeStrategies.length > 0 && (
        <div>
          <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginBottom: "0.5rem" }}>
            Also good for this market
          </div>
          <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
            {recommendation.alternativeStrategies.map((strategy) => (
              <span
                key={strategy}
                style={{
                  padding: "0.25rem 0.75rem",
                  background: "var(--glass-bg)",
                  borderRadius: 9999,
                  fontSize: "0.75rem",
                  border: "1px solid var(--border)",
                }}
              >
                {getStrategyDisplayName(strategy)}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Metrics */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(3, 1fr)",
        gap: "0.5rem",
        marginTop: "1rem",
        padding: "0.75rem",
        background: "var(--glass-bg)",
        borderRadius: 6,
      }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: "0.625rem", color: "var(--text-muted)" }}>Trend Strength</div>
          <div style={{
            fontFamily: "ui-monospace, monospace",
            fontWeight: 600,
            color: recommendation.metrics.trendStrength > 0 ? "#22c55e" : "#ef4444",
          }}>
            {(recommendation.metrics.trendStrength * 100).toFixed(1)}%
          </div>
        </div>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: "0.625rem", color: "var(--text-muted)" }}>Volatility</div>
          <div style={{ fontFamily: "ui-monospace, monospace", fontWeight: 600 }}>
            {(recommendation.metrics.volatilityLevel * 100).toFixed(2)}%
          </div>
        </div>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: "0.625rem", color: "var(--text-muted)" }}>Price Position</div>
          <div style={{ fontFamily: "ui-monospace, monospace", fontWeight: 600 }}>
            {(recommendation.metrics.pricePosition * 100).toFixed(0)}%
          </div>
        </div>
      </div>
    </div>
  );
}
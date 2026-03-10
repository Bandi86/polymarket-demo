import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  BarChart,
  Bar,
  Cell,
} from "recharts";
import {
  TrendingUp,
  TrendingDown,
  Target,
  Activity,
  DollarSign,
  Percent,
  Clock,
} from "lucide-react";
import type { Position, Portfolio } from "../types";

interface PortfolioAnalyticsProps {
  portfolio: Portfolio | null;
  pnlHistory: Array<{ time: number; pnl: number }>;
  positions: Position[];
}

export function PortfolioAnalytics({
  portfolio,
  pnlHistory,
  positions,
}: PortfolioAnalyticsProps) {
  const [timeframe, setTimeframe] = useState<"1h" | "24h" | "7d" | "30d" | "all">("24h");

  const filteredPnL = useMemo(() => {
    const now = Date.now();
    const timeframes = {
      "1h": 60 * 60 * 1000,
      "24h": 24 * 60 * 60 * 1000,
      "7d": 7 * 24 * 60 * 60 * 1000,
      "30d": 30 * 24 * 60 * 60 * 1000,
      all: Infinity,
    };

    return pnlHistory.filter((p) => now - p.time <= timeframes[timeframe]);
  }, [pnlHistory, timeframe]);

  const winLossDistribution = useMemo(() => {
    const settled = positions.filter((p) => p.status === "settled" || p.status === "closed");
    const wins = settled.filter((p) => (p.pnl || 0) > 0).length;
    const losses = settled.filter((p) => (p.pnl || 0) <= 0).length;
    return [
      { type: "Wins", count: wins, fill: "#22c55e" },
      { type: "Losses", count: losses, fill: "#ef4444" },
    ];
  }, [positions]);

  const pnlByOutcome = useMemo(() => {
    const byOutcome: Record<string, number> = { YES: 0, NO: 0 };
    positions
      .filter((p) => p.status === "settled" || p.status === "closed")
      .forEach((p) => {
        byOutcome[p.outcome] = (byOutcome[p.outcome] || 0) + (p.pnl || 0);
      });
    return [
      { outcome: "YES", pnl: byOutcome.YES, fill: "#22c55e" },
      { outcome: "NO", pnl: byOutcome.NO, fill: "#ef4444" },
    ];
  }, [positions]);

  const stats = useMemo(() => {
    if (!portfolio) return null;

    const settled = positions.filter((p) => p.status === "settled" || p.status === "closed");
    const winningTrades = settled.filter((p) => (p.pnl || 0) > 0);
    const losingTrades = settled.filter((p) => (p.pnl || 0) <= 0);

    const avgWin = winningTrades.length > 0
      ? winningTrades.reduce((s, p) => s + (p.pnl || 0), 0) / winningTrades.length
      : 0;
    const avgLoss = losingTrades.length > 0
      ? Math.abs(losingTrades.reduce((s, p) => s + (p.pnl || 0), 0) / losingTrades.length)
      : 0;

    const profitFactor = avgLoss > 0 ? avgWin / avgLoss : avgWin > 0 ? Infinity : 0;
    const expectancy = portfolio.totalTrades > 0
      ? (portfolio.winRate * avgWin) - ((1 - portfolio.winRate) * avgLoss)
      : 0;

    return {
      profitFactor,
      expectancy,
      avgWin,
      avgLoss,
      maxDrawdown: portfolio.maxDrawdown,
      sharpeRatio: portfolio.sharpeRatio,
    };
  }, [portfolio, positions]);

  if (!portfolio) return null;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-medium text-[var(--color-text-primary)]">
          <Activity className="w-4 h-4" />
          Portfolio Analytics
        </div>

        {/* Timeframe Selector */}
        <div className="flex gap-1">
          {(["1h", "24h", "7d", "30d", "all"] as const).map((tf) => (
            <button
              key={tf}
              onClick={() => setTimeframe(tf)}
              className={`px-2 py-1 text-xs rounded transition-colors ${
                timeframe === tf
                  ? "bg-[var(--color-primary)] text-white"
                  : "bg-[var(--color-surface)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
              }`}
            >
              {tf}
            </button>
          ))}
        </div>
      </div>

      {/* P&L Chart */}
      <div className="h-48">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart
            data={filteredPnL}
            margin={{ top: 5, right: 5, left: 0, bottom: 0 }}
          >
            <defs>
              <linearGradient id="pnlGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="pnlGradientNeg" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
            <XAxis
              dataKey="time"
              tickFormatter={(v) => new Date(v).toLocaleTimeString()}
              stroke="var(--color-text-muted)"
              fontSize={10}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              stroke="var(--color-text-muted)"
              fontSize={10}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v) => `$${v.toFixed(0)}`}
            />
            <Tooltip
              contentStyle={{
                background: "var(--color-card)",
                border: "1px solid var(--color-border)",
                borderRadius: "8px",
                fontSize: "11px",
              }}
              formatter={(v) => [`$${Number(v).toFixed(2)}`, "P&L"]}
            />
            <Area
              type="monotone"
              dataKey="pnl"
              stroke="#22c55e"
              strokeWidth={2}
              fill="url(#pnlGradient)"
              isAnimationActive
              animationDuration={500}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-2 gap-3">
        <MetricCard
          icon={Target}
          label="Profit Factor"
          value={stats?.profitFactor?.toFixed(2) || "-"}
          color={stats?.profitFactor && stats.profitFactor >= 1.5 ? "text-emerald-400" : "text-[var(--color-text-primary)]"}
        />
        <MetricCard
          icon={DollarSign}
          label="Expectancy"
          value={`$${stats?.expectancy?.toFixed(2) || "0.00"}`}
          color={stats?.expectancy && stats.expectancy >= 0 ? "text-emerald-400" : "text-red-400"}
        />
        <MetricCard
          icon={TrendingDown}
          label="Max Drawdown"
          value={`${((stats?.maxDrawdown || 0) * 100).toFixed(1)}%`}
          color="text-red-400"
        />
        <MetricCard
          icon={Activity}
          label="Sharpe Ratio"
          value={stats?.sharpeRatio?.toFixed(2) || "-"}
          color={stats?.sharpeRatio && stats.sharpeRatio >= 1 ? "text-emerald-400" : "text-[var(--color-text-primary)]"}
        />
      </div>

      {/* Win/Loss Distribution */}
      <div className="grid grid-cols-2 gap-3">
        <div className="p-3 rounded-lg bg-[var(--color-surface)]">
          <div className="text-xs text-[var(--color-text-secondary)] mb-2">Win/Loss</div>
          <div className="h-24">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={winLossDistribution}>
                <XAxis dataKey="type" hide />
                <Tooltip
                  contentStyle={{
                    background: "var(--color-card)",
                    border: "1px solid var(--color-border)",
                    borderRadius: "8px",
                    fontSize: "11px",
                  }}
                  cursor={{ fill: "transparent" }}
                />
                <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                  {winLossDistribution.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="p-3 rounded-lg bg-[var(--color-surface)]">
          <div className="text-xs text-[var(--color-text-secondary)] mb-2">P&L by Outcome</div>
          <div className="h-24">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={pnlByOutcome}>
                <XAxis dataKey="outcome" hide />
                <Tooltip
                  contentStyle={{
                    background: "var(--color-card)",
                    border: "1px solid var(--color-border)",
                    borderRadius: "8px",
                    fontSize: "11px",
                  }}
                  formatter={(v) => [`$${Number(v).toFixed(2)}`, "P&L"]}
                />
                <Bar dataKey="pnl" radius={[4, 4, 0, 0]}>
                  {pnlByOutcome.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Additional Stats */}
      <div className="p-3 rounded-lg bg-[var(--color-surface)] space-y-2">
        <div className="flex justify-between text-sm">
          <span className="text-[var(--color-text-secondary)]">Avg Win</span>
          <span className="text-emerald-400 font-medium">
            +${stats?.avgWin?.toFixed(2) || "0.00"}
          </span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-[var(--color-text-secondary)]">Avg Loss</span>
          <span className="text-red-400 font-medium">
            -${stats?.avgLoss?.toFixed(2) || "0.00"}
          </span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-[var(--color-text-secondary)]">Total Trades</span>
          <span className="text-[var(--color-text-primary)] font-medium">
            {portfolio.totalTrades}
          </span>
        </div>
      </div>
    </div>
  );
}

function MetricCard({
  icon: Icon,
  label,
  value,
  color,
}: {
  icon: typeof Target;
  label: string;
  value: string;
  color: string;
}) {
  return (
    <div className="p-3 rounded-lg bg-[var(--color-surface)]">
      <div className="flex items-center gap-2 mb-1">
        <Icon className="w-3.5 h-3.5 text-[var(--color-text-muted)]" />
        <span className="text-xs text-[var(--color-text-secondary)]">{label}</span>
      </div>
      <div className={`text-lg font-semibold ${color}`}>{value}</div>
    </div>
  );
}

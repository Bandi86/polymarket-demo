import { useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { TrendingUp, Activity, Target, DollarSign, BarChart3 } from 'lucide-react';
import { cn, formatCurrency } from '@/lib/utils';
import { getStrategyColor, getStrategyName } from '@/lib/design-tokens';

interface BotStats {
  trades: number;
  wins: number;
  pnl: number;
  winRate: number;
}

interface BotData {
  id: string;
  name: string;
  strategy: string;
  enabled: boolean;
  stats: BotStats;
}

interface PerformanceDashboardProps {
  bots: BotData[];
  className?: string;
}

export function PerformanceDashboard({ bots, className }: PerformanceDashboardProps) {
  const stats = useMemo(() => {
    const totalPnl = bots.reduce((sum, b) => sum + b.stats.pnl, 0);
    const totalTrades = bots.reduce((sum, b) => sum + b.stats.trades, 0);
    const totalWins = bots.reduce((sum, b) => sum + b.stats.wins, 0);
    const avgWinRate = totalTrades > 0 ? totalWins / totalTrades : 0;
    const activeBots = bots.filter(b => b.enabled).length;

    return {
      totalPnl,
      totalTrades,
      totalWins,
      totalLosses: totalTrades - totalWins,
      avgWinRate,
      activeBots,
      totalBots: bots.length,
    };
  }, [bots]);

  const strategyData = useMemo(() => {
    return bots.map(bot => ({
      name: getStrategyName(bot.strategy),
      shortName: bot.strategy.split('_')[0].slice(0, 3).toUpperCase(),
      pnl: bot.stats.pnl,
      trades: bot.stats.trades,
      winRate: bot.stats.winRate * 100,
      color: getStrategyColor(bot.strategy),
    }));
  }, [bots]);

  const winLossData = useMemo(() => [
    { name: 'Wins', value: stats.totalWins, color: 'hsl(142 71% 45%)' },
    { name: 'Losses', value: stats.totalLosses, color: 'hsl(0 84% 60%)' },
  ], [stats]);

  const pnlHistory = useMemo(() => {
    // Simulated PnL history (in production, would track actual history)
    let cumulative = 0;
    return bots.flatMap(bot => {
      const avgPnlPerTrade = bot.stats.trades > 0 ? bot.stats.pnl / bot.stats.trades : 0;
      return Array.from({ length: Math.min(bot.stats.trades, 10) }, (_, i) => {
        cumulative += avgPnlPerTrade * (0.8 + Math.random() * 0.4);
        return { trade: i + 1, pnl: cumulative };
      });
    }).sort((a, b) => a.trade - b.trade);
  }, [bots]);

  return (
    <div className={cn('p-4 rounded-xl bg-card border border-border', className)}>
      <div className="flex items-center gap-2 mb-4">
        <BarChart3 className="w-4 h-4 text-primary" />
        <h3 className="font-semibold">Performance Metrics</h3>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <div className="p-3 rounded-lg bg-surface-elevated">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
            <DollarSign className="w-3 h-3" />
            Total P&L
          </div>
          <div className={cn(
            'text-lg font-bold font-mono',
            stats.totalPnl >= 0 ? 'text-success' : 'text-danger'
          )}>
            {stats.totalPnl >= 0 ? '+' : ''}{formatCurrency(stats.totalPnl)}
          </div>
        </div>

        <div className="p-3 rounded-lg bg-surface-elevated">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
            <Activity className="w-3 h-3" />
            Trades
          </div>
          <div className="text-lg font-bold font-mono">{stats.totalTrades}</div>
        </div>

        <div className="p-3 rounded-lg bg-surface-elevated">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
            <Target className="w-3 h-3" />
            Win Rate
          </div>
          <div className={cn(
            'text-lg font-bold font-mono',
            stats.avgWinRate >= 0.5 ? 'text-success' : 'text-warning'
          )}>
            {(stats.avgWinRate * 100).toFixed(1)}%
          </div>
        </div>

        <div className="p-3 rounded-lg bg-surface-elevated">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
            <TrendingUp className="w-3 h-3" />
            Active
          </div>
          <div className="text-lg font-bold font-mono">
            {stats.activeBots}/{stats.totalBots}
          </div>
        </div>
      </div>

      {/* Strategy Performance Bar Chart */}
      {strategyData.length > 0 && (
        <div className="mb-4">
          <div className="text-xs text-muted-foreground mb-2">Strategy P&L</div>
          <div className="h-32">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={strategyData} layout="vertical">
                <XAxis type="number" tickFormatter={(v) => `$${v.toFixed(0)}`} tick={{ fontSize: 10 }} />
                <YAxis type="category" dataKey="shortName" tick={{ fontSize: 10 }} width={30} />
                <Tooltip
                  formatter={(value) => value !== undefined ? [`$${Number(value).toFixed(2)}`, 'P&L'] : ['', 'P&L']}
                  contentStyle={{ background: 'hsl(222 47% 7%)', border: '1px solid hsl(217 33% 17%)', borderRadius: '8px' }}
                />
                <Bar dataKey="pnl" radius={[0, 4, 4, 0]}>
                  {strategyData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.pnl >= 0 ? 'hsl(142 71% 45%)' : 'hsl(0 84% 60%)'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Win/Loss Pie Chart */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <div className="text-xs text-muted-foreground mb-2">Win/Loss Ratio</div>
          <div className="h-24">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={winLossData}
                  cx="50%"
                  cy="50%"
                  innerRadius={25}
                  outerRadius={40}
                  paddingAngle={2}
                  dataKey="value"
                >
                  {winLossData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value) => value !== undefined ? [Number(value), ''] : [0, '']}
                  contentStyle={{ background: 'hsl(222 47% 7%)', border: '1px solid hsl(217 33% 17%)', borderRadius: '8px' }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="flex justify-center gap-3 text-xs">
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-success" />
              Wins: {stats.totalWins}
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-danger" />
              Losses: {stats.totalLosses}
            </span>
          </div>
        </div>

        {/* Win Rate by Strategy */}
        <div>
          <div className="text-xs text-muted-foreground mb-2">Win Rates</div>
          <div className="space-y-1.5">
            {strategyData.slice(0, 4).map((s, i) => (
              <div key={i} className="flex items-center gap-2">
                <span className="text-[10px] w-8 truncate text-muted-foreground">{s.shortName}</span>
                <div className="flex-1 h-1.5 bg-surface rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{ width: `${s.winRate}%`, background: s.color }}
                  />
                </div>
                <span className="text-[10px] font-mono w-8 text-right">{s.winRate.toFixed(0)}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
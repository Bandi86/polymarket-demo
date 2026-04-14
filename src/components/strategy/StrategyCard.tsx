'use client'

import { cn } from '@/lib/utils';
import { getStrategyColor, getStrategyName } from '@/lib/design-tokens';
import { Sparkline } from '@/components/charts/Sparkline';
import { ProgressRing } from '@/components/ui/ProgressRing';
import type { StrategyType, BotStats } from '@/types';

interface StrategyCardProps {
  strategy: StrategyType;
  name?: string;
  stats: BotStats;
  enabled?: boolean;
  pnlHistory?: number[];
  className?: string;
  onClick?: () => void;
}

export function StrategyCard({
  strategy,
  name,
  stats,
  enabled = true,
  pnlHistory,
  className,
  onClick,
}: StrategyCardProps) {
  const strategyName = name || getStrategyName(strategy);
  const strategyColor = getStrategyColor(strategy);

  const pnlValue = stats.pnl ?? 0;
  const winRateValue = stats.winRate ?? 0;
  const pnlPercent = pnlValue >= 0
    ? `+${pnlValue.toFixed(2)}`
    : `${pnlValue.toFixed(2)}`;

  return (
    <div
      className={cn(
        'p-4 rounded-lg border border-border bg-card hover:bg-surface-hover transition-all cursor-pointer',
        enabled && 'hover:border-primary/50',
        className
      )}
      onClick={onClick}
      style={{ borderLeftColor: strategyColor, borderLeftWidth: '3px' }}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <div
            className={cn(
              'w-2 h-2 rounded-full',
              enabled ? 'bg-success animate-pulse' : 'bg-muted-foreground'
            )}
          />
          <span className="font-semibold text-sm">{strategyName}</span>
        </div>
        <span
          className={cn(
            'text-sm font-mono font-semibold',
            pnlValue >= 0 ? 'text-success' : 'text-danger'
          )}
        >
          {pnlPercent}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-3">
        <div className="flex items-center gap-2">
          <ProgressRing value={winRateValue * 100} size={32} strokeWidth={3} />
          <div>
            <div className="text-xs text-muted-foreground">Win Rate</div>
            <div className="text-sm font-mono font-semibold">
              {(winRateValue * 100).toFixed(1)}%
            </div>
          </div>
        </div>

        <div>
          <div className="text-xs text-muted-foreground">Trades</div>
          <div className="text-sm font-mono font-semibold">{stats.trades}</div>
        </div>
      </div>

      {pnlHistory && pnlHistory.length >= 2 && (
        <div className="mt-2">
          <Sparkline
            data={pnlHistory}
            width={180}
            height={24}
            trend={pnlValue >= 0 ? 'up' : 'down'}
          />
        </div>
      )}

      <div className="grid grid-cols-2 gap-2 mt-3 text-xs text-muted-foreground">
        <div>
          <span className="text-success">W:</span> {stats.wins}
        </div>
        <div>
          <span className="text-danger">L:</span> {stats.losses}
        </div>
      </div>
    </div>
  );
}
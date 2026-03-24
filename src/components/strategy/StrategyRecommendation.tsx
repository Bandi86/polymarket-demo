'use client'

import { cn } from '@/lib/utils';
import { getStrategyColor, getStrategyName } from '@/lib/design-tokens';
import { ProgressRing } from '@/components/ui/ProgressRing';
import type { StrategyType } from '@/types';

interface StrategyRecommendationProps {
  strategy: StrategyType;
  action: 'BUY_YES' | 'BUY_NO' | 'SELL' | 'HOLD' | 'STRONG_BUY' | 'STRONG_SELL';
  confidence: number;
  reason: string;
  priceTarget?: number;
  currentPrice?: number;
  className?: string;
}

export function StrategyRecommendation({
  strategy,
  action,
  confidence,
  reason,
  priceTarget,
  currentPrice,
  className,
}: StrategyRecommendationProps) {
  const strategyName = getStrategyName(strategy);
  const strategyColor = getStrategyColor(strategy);

  const getActionStyle = () => {
    switch (action) {
      case 'BUY_YES':
      case 'STRONG_BUY':
        return {
          bg: 'bg-success/10',
          text: 'text-success',
          label: action === 'STRONG_BUY' ? 'STRONG BUY YES' : 'BUY YES',
        };
      case 'BUY_NO':
        return {
          bg: 'bg-primary/10',
          text: 'text-primary',
          label: 'BUY NO',
        };
      case 'SELL':
      case 'STRONG_SELL':
        return {
          bg: 'bg-danger/10',
          text: 'text-danger',
          label: action === 'STRONG_SELL' ? 'STRONG SELL' : 'SELL',
        };
      default:
        return {
          bg: 'bg-muted/10',
          text: 'text-muted-foreground',
          label: 'HOLD',
        };
    }
  };

  const actionStyle = getActionStyle();

  return (
    <div
      className={cn(
        'p-4 rounded-lg border border-border bg-card',
        className
      )}
      style={{ borderLeftColor: strategyColor, borderLeftWidth: '3px' }}
    >
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-semibold" style={{ color: strategyColor }}>
          {strategyName}
        </span>
        <span
          className={cn(
            'px-2 py-0.5 rounded text-xs font-bold',
            actionStyle.bg,
            actionStyle.text
          )}
        >
          {actionStyle.label}
        </span>
      </div>

      <div className="flex items-center gap-3 mb-3">
        <ProgressRing value={confidence * 100} size={40} strokeWidth={3} />
        <div className="flex-1">
          <div className="text-xs text-muted-foreground mb-1">Confidence</div>
          <div className={cn('text-sm font-mono font-semibold', actionStyle.text)}>
            {(confidence * 100).toFixed(0)}%
          </div>
        </div>
      </div>

      <p className="text-xs text-muted-foreground mb-3">{reason}</p>

      {priceTarget !== undefined && currentPrice !== undefined && (
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="p-2 rounded bg-surface-elevated">
            <div className="text-muted-foreground mb-0.5">Current</div>
            <div className="font-mono font-semibold">{(currentPrice * 100).toFixed(1)}¢</div>
          </div>
          <div className="p-2 rounded bg-surface-elevated">
            <div className="text-muted-foreground mb-0.5">Target</div>
            <div className="font-mono font-semibold text-success">
              {(priceTarget * 100).toFixed(1)}¢
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
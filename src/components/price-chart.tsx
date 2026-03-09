import { Activity, TrendingUp, TrendingDown } from "lucide-react";
import { cn } from "../lib/utils";
import type { PricePoint } from "../types";

interface PriceChartProps {
  data: PricePoint[];
  height?: number;
  isProbability?: boolean;
}

export function PriceChart({ data, height = 200, isProbability = false }: PriceChartProps) {
  if (data.length < 2) {
    return (
      <div className="flex items-center justify-center h-[200px] text-[var(--color-text-muted)] text-sm">
        <Activity className="w-4 h-4 mr-2 animate-pulse" />
        Collecting price data...
      </div>
    );
  }

  const prices = data.map((d) => d.price);
  const minPrice = isProbability ? 0 : Math.min(...prices);
  const maxPrice = isProbability ? 1 : Math.max(...prices);
  const range = maxPrice - minPrice || 1;

  const points = data.map((d, i) => {
    const x = (i / (data.length - 1)) * 100;
    const y = 100 - ((d.price - minPrice) / range) * 100;
    return `${x},${y}`;
  }).join(" ");

  const areaPoints = `0,100 ${points} 100,100`;

  const firstPrice = data[0]?.price || 0;
  const lastPrice = data[data.length - 1]?.price || 0;
  const prevPrice = data.length > 1 ? data[data.length - 2]?.price || lastPrice : lastPrice;
  const isUp = lastPrice >= firstPrice;
  const isRecentlyUp = lastPrice >= prevPrice;
  const priceChange = ((lastPrice - firstPrice) / firstPrice * 100).toFixed(2);

  return (
    <div className="relative" style={{ height }}>
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="w-full h-full">
        <defs>
          <linearGradient id="chartGradient" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor={isUp ? "var(--color-success)" : "var(--color-danger)"} stopOpacity="0.4" />
            <stop offset="100%" stopColor={isUp ? "var(--color-success)" : "var(--color-danger)"} stopOpacity="0.02" />
          </linearGradient>
          <filter id="glow">
            <feGaussianBlur stdDeviation="0.5" result="coloredBlur"/>
            <feMerge>
              <feMergeNode in="coloredBlur"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
        </defs>
        <polygon fill="url(#chartGradient)" points={areaPoints} />
        <polyline
          fill="none"
          stroke={isUp ? "var(--color-success)" : "var(--color-danger)"}
          strokeWidth="0.8"
          points={points}
          filter="url(#glow)"
          className="drop-shadow-lg"
        />
        {/* Current price indicator */}
        <circle
          cx="100"
          cy={100 - ((lastPrice - minPrice) / range) * 100}
          r="1.5"
          fill={isRecentlyUp ? "var(--color-success)" : "var(--color-danger)"}
          className="animate-pulse"
        />
      </svg>

      {/* Price labels */}
      <div className="absolute left-2 top-2 text-xs text-[var(--color-text-muted)] font-mono">
        {isProbability ? '100¢' : `$${maxPrice.toLocaleString()}`}
      </div>
      <div className="absolute left-2 bottom-2 text-xs text-[var(--color-text-muted)] font-mono">
        {isProbability ? '0¢' : `$${minPrice.toLocaleString()}`}
      </div>

      {/* Current price badge */}
      <div className={cn(
        "absolute right-2 top-2 flex items-center gap-1 px-2 py-1 rounded-full text-xs font-bold",
        isUp
          ? "bg-green-500/20 text-[var(--color-success)]"
          : "bg-red-500/20 text-[var(--color-danger)]"
      )}>
        {isUp ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
        {isProbability ? `${(lastPrice * 100).toFixed(1)}¢` : `$${lastPrice.toFixed(2)}`}
      </div>

      {/* Price change badge */}
      <div className={cn(
        "absolute right-2 bottom-2 text-[10px] font-mono",
        isUp ? "text-[var(--color-success)]" : "text-[var(--color-danger)]"
      )}>
        {isUp ? "+" : ""}{priceChange}%
      </div>
    </div>
  );
}

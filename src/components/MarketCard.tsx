import { TrendingUp, TrendingDown, Clock, Volume2, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { AnimatedCounter } from "@/components/ui/AnimatedCounter";
import { Sparkline } from "@/components/charts/Sparkline";
import type { MarketData } from "../hooks/useTradingData";

interface MarketCardProps {
  marketData: MarketData | null;
  yesPrice: number;
  noPrice: number;
  yesPriceDirection: "up" | "down" | null;
  noPriceDirection: "up" | "down" | null;
  coinColor: string;
  selectedAsset: string;
  selectedTimeframe?: string;
  priceHistory?: number[];
}

function formatCountdown(ms: number): string {
  if (ms <= 0) return "Expired";
  const minutes = Math.floor(ms / 60_000);
  const seconds = Math.floor((ms % 60_000) / 1_000);
  if (minutes > 0) return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  return `0:${seconds.toString().padStart(2, "0")}`;
}

export function MarketCard({
  marketData,
  yesPrice,
  noPrice,
  yesPriceDirection,
  noPriceDirection,
  coinColor,
  selectedAsset,
  selectedTimeframe: _selectedTimeframe,
  priceHistory,
}: MarketCardProps) {
  const timeRemaining = marketData?.timeRemaining || 0;
  const market = marketData?.market;

  const isUrgent = timeRemaining < 60000;
  const isWarning = timeRemaining < 300000;

  const yesRoi = yesPrice > 0 ? ((1 / yesPrice - 1) * 100) : 0;
  const noRoi = noPrice > 0 ? ((1 / noPrice - 1) * 100) : 0;

  return (
    <div className="glass-card p-5 rounded-xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-bold">
            <span style={{ color: coinColor }}>{selectedAsset}</span>
            <span className="text-muted-foreground font-normal ml-2">Up/Down</span>
          </h2>
          <p className="text-xs text-muted-foreground max-w-[250px] truncate">
            {market?.question || `Will ${selectedAsset} go up or down?`}
          </p>
        </div>
        <div
          className={cn(
            "flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-sm font-medium",
            isUrgent && "bg-danger/15 text-danger",
            isWarning && !isUrgent && "bg-warning/15 text-warning",
            !isWarning && !isUrgent && "bg-surface-elevated text-muted-foreground"
          )}
        >
          <Clock className="w-3.5 h-3.5" />
          <span className="font-mono">{formatCountdown(timeRemaining)}</span>
        </div>
      </div>

      {/* Price History Sparkline */}
      {priceHistory && priceHistory.length >= 2 && (
        <div className="mb-4">
          <Sparkline
            data={priceHistory}
            width={280}
            height={40}
            trend={yesPriceDirection || undefined}
          />
        </div>
      )}

      {/* Price Display */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        {/* UP / YES */}
        <div
          className={cn(
            "p-4 rounded-lg border transition-all duration-300",
            yesPriceDirection === "up" && "ring-2 ring-success/30",
            "bg-success/5 border-success/20"
          )}
        >
          <div className="flex items-center gap-1.5 mb-2">
            <TrendingUp className="w-4 h-4 text-success" />
            <span className="text-xs font-semibold text-success tracking-wider">UP</span>
          </div>
          <div
            className={cn(
              "text-2xl font-bold font-mono text-success transition-all duration-300",
              yesPriceDirection === "up" && "scale-105",
              yesPriceDirection === "down" && "opacity-75"
            )}
          >
            <AnimatedCounter
              value={yesPrice * 100}
              format="number"
              decimals={1}
            />
            <span className="text-base">¢</span>
          </div>
          <div className="text-xs text-muted-foreground mt-1">
            ROI: <span className="text-success font-medium">{yesRoi.toFixed(0)}%</span>
          </div>
        </div>

        {/* DOWN / NO */}
        <div
          className={cn(
            "p-4 rounded-lg border transition-all duration-300",
            noPriceDirection === "up" && "ring-2 ring-danger/30",
            "bg-danger/5 border-danger/20"
          )}
        >
          <div className="flex items-center gap-1.5 mb-2">
            <TrendingDown className="w-4 h-4 text-danger" />
            <span className="text-xs font-semibold text-danger tracking-wider">DOWN</span>
          </div>
          <div
            className={cn(
              "text-2xl font-bold font-mono text-danger transition-all duration-300",
              noPriceDirection === "up" && "scale-105",
              noPriceDirection === "down" && "opacity-75"
            )}
          >
            <AnimatedCounter
              value={noPrice * 100}
              format="number"
              decimals={1}
            />
            <span className="text-base">¢</span>
          </div>
          <div className="text-xs text-muted-foreground mt-1">
            ROI: <span className="text-danger font-medium">{noRoi.toFixed(0)}%</span>
          </div>
        </div>
      </div>

      {/* Probability Bar */}
      <div className="mb-4">
        <div className="flex justify-between text-xs font-semibold mb-1.5">
          <span className="text-success">{(yesPrice * 100).toFixed(1)}%</span>
          <span className="text-danger">{(noPrice * 100).toFixed(1)}%</span>
        </div>
        <div className="h-1.5 rounded-full bg-danger overflow-hidden flex">
          <div
            className="h-full bg-success transition-all duration-500 ease-out"
            style={{ width: `${yesPrice * 100}%` }}
          />
        </div>
      </div>

      {/* Market Info */}
      <div className="grid grid-cols-2 gap-3 text-xs">
        <div className="flex items-center gap-1.5 text-muted-foreground">
          <Volume2 className="w-3.5 h-3.5" />
          <span>Vol:</span>
          <span className="font-mono text-foreground">
            ${((market?.volumeNum || market?.liquidity || 0) / 1000).toFixed(1)}K
          </span>
        </div>
        <div className="flex items-center gap-1.5 text-muted-foreground">
          <RefreshCw className="w-3.5 h-3.5 animate-spin" style={{ animationDuration: "3s" }} />
          <span>Status:</span>
          <span className="text-success font-medium">Live</span>
        </div>
      </div>
    </div>
  );
}
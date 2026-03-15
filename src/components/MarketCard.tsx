import { TrendingUp, TrendingDown, Clock, DollarSign, Activity } from "lucide-react";
import { cn } from "@/lib/utils";
import { AnimatedCounter } from "@/components/ui/AnimatedCounter";
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
  btcPrice?: number;
  priceToBeat?: number;
}

function formatCountdown(ms: number): string {
  if (ms <= 0) return "Expired";
  const minutes = Math.floor(ms / 60_000);
  const seconds = Math.floor((ms % 60_000) / 1_000);
  if (minutes > 0) return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  return `0:${seconds.toString().padStart(2, "0")}`;
}

function formatPrice(price: number): string {
  if (price >= 1000) {
    return price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  return price.toFixed(4);
}

export function MarketCard({
  marketData,
  yesPrice,
  noPrice,
  yesPriceDirection,
  noPriceDirection,
  coinColor,
  selectedAsset,
  selectedTimeframe,
  btcPrice,
  priceToBeat,
}: MarketCardProps) {
  const timeRemaining = marketData?.timeRemaining || 0;
  const market = marketData?.market;

  const isUrgent = timeRemaining < 60000;
  const isWarning = timeRemaining < 120000;

  // Calculate price change from price to beat
  const priceChange = btcPrice && priceToBeat
    ? ((btcPrice - priceToBeat) / priceToBeat) * 100
    : 0;
  const isUp = priceChange >= 0;

  return (
    <div className="glass-card rounded-xl overflow-hidden">
      {/* Header with countdown */}
      <div className="flex items-center justify-between p-4 border-b border-white/5">
        <div className="flex items-center gap-2">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center"
            style={{ backgroundColor: `${coinColor}20` }}
          >
            <span className="font-bold text-sm" style={{ color: coinColor }}>
              {selectedAsset}
            </span>
          </div>
          <div>
            <h2 className="font-semibold text-sm">
              {selectedAsset} Up or Down
            </h2>
            <p className="text-xs text-muted-foreground">
              {selectedTimeframe === "5" ? "5 minute" : selectedTimeframe === "15" ? "15 minute" : selectedTimeframe === "60" ? "1 hour" : selectedTimeframe === "240" ? "4 hour" : `${selectedTimeframe}m`} market
            </p>
          </div>
        </div>
        <div
          className={cn(
            "flex items-center gap-1.5 px-3 py-2 rounded-lg font-mono text-sm font-bold transition-all",
            isUrgent && "bg-red-500/20 text-red-400 animate-pulse",
            isWarning && !isUrgent && "bg-amber-500/20 text-amber-400",
            !isWarning && !isUrgent && "bg-white/5 text-muted-foreground"
          )}
        >
          <Clock className="w-4 h-4" />
          <span>{formatCountdown(timeRemaining)}</span>
        </div>
      </div>

      {/* Price Info Section */}
      <div className="p-4 space-y-3">
        {/* Price to Beat */}
        {priceToBeat && (
          <div className="flex items-center justify-between p-3 rounded-lg bg-white/5">
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Price to Beat</span>
            </div>
            <span className="font-mono font-semibold">
              ${formatPrice(priceToBeat)}
            </span>
          </div>
        )}

        {/* Current BTC Price */}
        {btcPrice && (
          <div className="flex items-center justify-between p-3 rounded-lg bg-white/5">
            <div className="flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Current Price</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-mono font-semibold">
                ${formatPrice(btcPrice)}
              </span>
              {priceToBeat && (
                <span className={cn(
                  "text-xs font-medium px-1.5 py-0.5 rounded",
                  isUp ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"
                )}>
                  {isUp ? "+" : ""}{priceChange.toFixed(3)}%
                </span>
              )}
            </div>
          </div>
        )}
      </div>

      {/* UP/DOWN Buttons - Polymarket style */}
      <div className="p-4 pt-0">
        <div className="grid grid-cols-2 gap-3">
          {/* UP Button */}
          <button
            className={cn(
              "relative overflow-hidden rounded-xl p-4 transition-all duration-200",
              "bg-gradient-to-br from-green-500/10 to-green-600/5",
              "border-2 border-green-500/30 hover:border-green-500/60",
              "hover:from-green-500/20 hover:to-green-600/10",
              yesPriceDirection === "up" && "scale-[1.02] border-green-400 shadow-lg shadow-green-500/20"
            )}
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5">
                <TrendingUp className="w-5 h-5 text-green-400" />
                <span className="font-bold text-green-400">UP</span>
              </div>
              <span className="text-xs text-muted-foreground">
                {(yesPrice * 100).toFixed(1)}%
              </span>
            </div>
            <div
              className={cn(
                "text-3xl font-bold font-mono text-green-400 transition-all duration-300",
                yesPriceDirection === "up" && "scale-110",
                yesPriceDirection === "down" && "opacity-60"
              )}
            >
              <AnimatedCounter
                value={yesPrice * 100}
                format="number"
                decimals={1}
              />
              <span className="text-lg ml-0.5">¢</span>
            </div>
            <div className="text-xs text-muted-foreground mt-1.5">
              Win ${(100 / (yesPrice * 100)).toFixed(0)} on $1
            </div>
            {/* Price flash effect */}
            {yesPriceDirection === "up" && (
              <div className="absolute inset-0 bg-green-400/10 animate-ping rounded-xl" />
            )}
          </button>

          {/* DOWN Button */}
          <button
            className={cn(
              "relative overflow-hidden rounded-xl p-4 transition-all duration-200",
              "bg-gradient-to-br from-red-500/10 to-red-600/5",
              "border-2 border-red-500/30 hover:border-red-500/60",
              "hover:from-red-500/20 hover:to-red-600/10",
              noPriceDirection === "up" && "scale-[1.02] border-red-400 shadow-lg shadow-red-500/20"
            )}
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5">
                <TrendingDown className="w-5 h-5 text-red-400" />
                <span className="font-bold text-red-400">DOWN</span>
              </div>
              <span className="text-xs text-muted-foreground">
                {(noPrice * 100).toFixed(1)}%
              </span>
            </div>
            <div
              className={cn(
                "text-3xl font-bold font-mono text-red-400 transition-all duration-300",
                noPriceDirection === "up" && "scale-110",
                noPriceDirection === "down" && "opacity-60"
              )}
            >
              <AnimatedCounter
                value={noPrice * 100}
                format="number"
                decimals={1}
              />
              <span className="text-lg ml-0.5">¢</span>
            </div>
            <div className="text-xs text-muted-foreground mt-1.5">
              Win ${(100 / (noPrice * 100)).toFixed(0)} on $1
            </div>
            {/* Price flash effect */}
            {noPriceDirection === "up" && (
              <div className="absolute inset-0 bg-red-400/10 animate-ping rounded-xl" />
            )}
          </button>
        </div>
      </div>

      {/* Probability Bar */}
      <div className="px-4 pb-4">
        <div className="h-2 rounded-full bg-red-500/30 overflow-hidden flex">
          <div
            className="h-full bg-green-500 transition-all duration-300 ease-out"
            style={{ width: `${yesPrice * 100}%` }}
          />
        </div>
        <div className="flex justify-between mt-2 text-xs font-medium">
          <span className="text-green-400">UP {(yesPrice * 100).toFixed(1)}%</span>
          <span className="text-red-400">DOWN {(noPrice * 100).toFixed(1)}%</span>
        </div>
      </div>

      {/* Market Info Footer */}
      <div className="px-4 pb-4 flex items-center justify-between text-xs text-muted-foreground">
        <div className="flex items-center gap-1">
          <span>Vol:</span>
          <span className="font-mono text-foreground">
            ${((market?.volumeNum || 0) / 1000).toFixed(1)}K
          </span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
          <span>Live on Polymarket</span>
        </div>
      </div>
    </div>
  );
}
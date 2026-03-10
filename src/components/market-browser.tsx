import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, Star, Clock, TrendingUp, Filter, ChevronDown } from "lucide-react";
import type { Market } from "../types";

interface MarketBrowserProps {
  markets: Market[];
  selectedMarketId?: string;
  onSelectMarket: (marketId: string) => void;
  favorites?: Set<string>;
  onToggleFavorite?: (marketId: string) => void;
}

type FilterAsset = "all" | "BTC" | "ETH" | "SOL" | "XRP";
type FilterTimeframe = "all" | "5" | "15" | "60" | "240" | "1440";
type SortBy = "timeRemaining" | "volume" | "liquidity";

export function MarketBrowser({
  markets,
  selectedMarketId,
  onSelectMarket,
  favorites = new Set(),
  onToggleFavorite,
}: MarketBrowserProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [assetFilter, setAssetFilter] = useState<FilterAsset>("all");
  const [timeframeFilter, setTimeframeFilter] = useState<FilterTimeframe>("all");
  const [sortBy, setSortBy] = useState<SortBy>("timeRemaining");
  const [showFilters, setShowFilters] = useState(false);

  // Filter and sort markets
  const filteredMarkets = useMemo(() => {
    let result = [...markets];

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (m) =>
          m.question.toLowerCase().includes(query) ||
          m.category?.toLowerCase().includes(query)
      );
    }

    // Asset filter
    if (assetFilter !== "all") {
      result = result.filter(
        (m) =>
          m.category?.includes(assetFilter) ||
          (m as any).asset === assetFilter
      );
    }

    // Timeframe filter
    if (timeframeFilter !== "all") {
      result = result.filter((m) => {
        const duration = m.endTime - m.startTime;
        const minutes = duration / (1000 * 60);
        return Math.floor(minutes).toString() === timeframeFilter;
      });
    }

    // Sort
    result.sort((a, b) => {
      if (sortBy === "timeRemaining") {
        return a.endTime - b.endTime;
      } else if (sortBy === "volume") {
        return (b.volumeNum || 0) - (a.volumeNum || 0);
      } else if (sortBy === "liquidity") {
        return (b.liquidity || 0) - (a.liquidity || 0);
      }
      return 0;
    });

    return result;
  }, [markets, searchQuery, assetFilter, timeframeFilter, sortBy]);

  const formatTimeRemaining = (endTime: number) => {
    const remaining = endTime - Date.now();
    if (remaining <= 0) return "Ended";
    const minutes = Math.floor(remaining / (1000 * 60));
    const seconds = Math.floor((remaining % (1000 * 60)) / 1000);
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  };

  const getYesPrice = (market: Market) => {
    return parseFloat(market.outcomePrices?.yes || "0.5");
  };

  return (
    <div className="flex flex-col h-full">
      {/* Search and Filter Header */}
      <div className="p-3 border-b border-[var(--color-border)] space-y-2">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-text-muted)]" />
          <input
            type="text"
            placeholder="Search markets..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 rounded-lg bg-[var(--color-surface)] border border-[var(--color-border)] text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
          />
        </div>

        {/* Filter Toggle */}
        <button
          onClick={() => setShowFilters(!showFilters)}
          className="flex items-center gap-2 text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors"
        >
          <Filter className="w-4 h-4" />
          Filters
          <ChevronDown
            className={`w-4 h-4 transition-transform ${showFilters ? "rotate-180" : ""}`}
          />
        </button>

        {/* Filter Panel */}
        <AnimatePresence>
          {showFilters && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="grid grid-cols-3 gap-2 pt-2">
                {/* Asset Filter */}
                <select
                  value={assetFilter}
                  onChange={(e) => setAssetFilter(e.target.value as FilterAsset)}
                  className="px-2 py-1.5 rounded bg-[var(--color-surface)] border border-[var(--color-border)] text-xs text-[var(--color-text-primary)]"
                >
                  <option value="all">All Assets</option>
                  <option value="BTC">BTC</option>
                  <option value="ETH">ETH</option>
                  <option value="SOL">SOL</option>
                  <option value="XRP">XRP</option>
                </select>

                {/* Timeframe Filter */}
                <select
                  value={timeframeFilter}
                  onChange={(e) => setTimeframeFilter(e.target.value as FilterTimeframe)}
                  className="px-2 py-1.5 rounded bg-[var(--color-surface)] border border-[var(--color-border)] text-xs text-[var(--color-text-primary)]"
                >
                  <option value="all">All Times</option>
                  <option value="5">5m</option>
                  <option value="15">15m</option>
                  <option value="60">1h</option>
                  <option value="240">4h</option>
                  <option value="1440">1d</option>
                </select>

                {/* Sort */}
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as SortBy)}
                  className="px-2 py-1.5 rounded bg-[var(--color-surface)] border border-[var(--color-border)] text-xs text-[var(--color-text-primary)]"
                >
                  <option value="timeRemaining">Time Left</option>
                  <option value="volume">Volume</option>
                  <option value="liquidity">Liquidity</option>
                </select>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Market List */}
      <div className="flex-1 overflow-y-auto">
        <AnimatePresence>
          {filteredMarkets.map((market, index) => {
            const yesPrice = getYesPrice(market);
            const isSelected = market.id === selectedMarketId;
            const isFavorite = favorites.has(market.id);

            return (
              <motion.div
                key={market.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ delay: index * 0.02 }}
                onClick={() => onSelectMarket(market.id)}
                className={`
                  p-3 border-b border-[var(--color-border)] cursor-pointer
                  transition-colors duration-200
                  ${isSelected ? "bg-[var(--color-primary)]/10 border-l-2 border-l-[var(--color-primary)]" : "hover:bg-[var(--color-surface-hover)]"}
                `}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    {/* Market Question */}
                    <p className="text-sm font-medium text-[var(--color-text-primary)] truncate">
                      {market.question}
                    </p>

                    {/* Meta Info */}
                    <div className="flex items-center gap-3 mt-1 text-xs text-[var(--color-text-secondary)]">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {formatTimeRemaining(market.endTime)}
                      </span>
                      {market.volumeNum && (
                        <span className="flex items-center gap-1">
                          <TrendingUp className="w-3 h-3" />
                          ${(market.volumeNum / 1e6).toFixed(1)}M
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Price & Favorite */}
                  <div className="flex flex-col items-end gap-1">
                    <motion.span
                      className={`text-lg font-bold tabular-nums ${
                        yesPrice >= 0.5 ? "text-emerald-400" : "text-red-400"
                      }`}
                      key={yesPrice}
                      initial={{ scale: 1.1 }}
                      animate={{ scale: 1 }}
                    >
                      {(yesPrice * 100).toFixed(0)}¢
                    </motion.span>

                    {onToggleFavorite && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onToggleFavorite(market.id);
                        }}
                        className="p-0.5"
                      >
                        <Star
                          className={`w-3.5 h-3.5 transition-colors ${
                            isFavorite
                              ? "text-yellow-400 fill-yellow-400"
                              : "text-[var(--color-text-muted)]"
                          }`}
                        />
                      </button>
                    )}
                  </div>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>

        {filteredMarkets.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 text-[var(--color-text-muted)]">
            <Search className="w-8 h-8 mb-2 opacity-50" />
            <p className="text-sm">No markets found</p>
          </div>
        )}
      </div>

      {/* Market Count */}
      <div className="p-2 text-center text-xs text-[var(--color-text-muted)] border-t border-[var(--color-border)]">
        {filteredMarkets.length} market{filteredMarkets.length !== 1 ? "s" : ""} available
      </div>
    </div>
  );
}

// Compact market card for grid views
interface MarketCardProps {
  market: Market;
  isSelected?: boolean;
  onClick: () => void;
}

export function MarketCard({ market, isSelected, onClick }: MarketCardProps) {
  const yesPrice = parseFloat(market.outcomePrices?.yes || "0.5");
  const noPrice = parseFloat(market.outcomePrices?.no || "0.5");
  const timeRemaining = market.endTime - Date.now();
  const minutesRemaining = Math.max(0, Math.floor(timeRemaining / (1000 * 60)));

  const getUrgencyColor = () => {
    if (minutesRemaining <= 1) return "border-red-500";
    if (minutesRemaining <= 5) return "border-amber-500";
    return "border-transparent";
  };

  return (
    <motion.div
      onClick={onClick}
      className={`
        p-4 rounded-xl cursor-pointer
        bg-[var(--color-card)] border-2
        ${isSelected ? "border-[var(--color-primary)]" : getUrgencyColor()}
        hover:bg-[var(--color-surface-hover)]
        transition-colors
      `}
      whileHover={{ y: -2 }}
      whileTap={{ scale: 0.98 }}
    >
      <div className="flex justify-between items-start mb-3">
        <span className="text-xs text-[var(--color-text-muted)]">
          {market.category || "Crypto"}
        </span>
        <span className={`text-xs font-medium ${minutesRemaining <= 1 ? "text-red-400" : "text-[var(--color-text-secondary)]"}`}>
          {minutesRemaining}m left
        </span>
      </div>

      <p className="text-sm font-medium text-[var(--color-text-primary)] line-clamp-2 mb-3">
        {market.question}
      </p>

      <div className="flex justify-between items-center">
        <div className="flex gap-2">
          <span className="text-xs px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400">
            YES {(yesPrice * 100).toFixed(0)}¢
          </span>
          <span className="text-xs px-2 py-0.5 rounded bg-red-500/20 text-red-400">
            NO {(noPrice * 100).toFixed(0)}¢
          </span>
        </div>
        {market.volumeNum && (
          <span className="text-xs text-[var(--color-text-muted)]">
            ${(market.volumeNum / 1e6).toFixed(1)}M vol
          </span>
        )}
      </div>
    </motion.div>
  );
}
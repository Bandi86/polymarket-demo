import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  TrendingUp,
  TrendingDown,
  Minus,
  ArrowRightLeft,
  Filter,
  Download,
  ChevronDown,
} from "lucide-react";
import type { TradeEvent } from "../hooks/useTradingData";

interface TradeFeedProps {
  trades: TradeEvent[];
  maxItems?: number;
  showFilters?: boolean;
  showExport?: boolean;
}

export function TradeFeed({
  trades,
  maxItems = 50,
  showFilters = true,
  showExport = true,
}: TradeFeedProps) {
  const [filter, setFilter] = useState<"all" | "buy" | "sell" | "settle">("all");
  const [showAll, setShowAll] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const filteredTrades = useMemo(() => {
    let result = [...trades];

    if (filter !== "all") {
      result = result.filter((t) => t.type.toLowerCase() === filter);
    }

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (t) =>
          t.botName?.toLowerCase().includes(query) ||
          t.outcome?.toLowerCase().includes(query)
      );
    }

    return result.slice(0, showAll ? undefined : maxItems);
  }, [trades, filter, searchQuery, showAll, maxItems]);

  const exportToCSV = () => {
    const headers = ["Time", "Type", "Outcome", "Amount", "Price", "PnL", "Bot"];
    const rows = filteredTrades.map((t) => [
      new Date(t.time).toISOString(),
      t.type,
      t.outcome || "-",
      t.amount?.toFixed(2) || "-",
      t.price?.toFixed(3) || "-",
      t.pnl?.toFixed(2) || "-",
      t.botName || "Manual",
    ]);

    const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `trades-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ArrowRightLeft className="w-4 h-4 text-[var(--color-text-secondary)]" />
          <span className="text-sm font-medium text-[var(--color-text-primary)]">
            Recent Trades
          </span>
          <span className="text-xs text-[var(--color-text-muted)]">
            ({filteredTrades.length})
          </span>
        </div>

        <div className="flex items-center gap-2">
          {showExport && (
            <button
              onClick={exportToCSV}
              className="p-1.5 rounded hover:bg-[var(--color-surface)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors"
              title="Export to CSV"
            >
              <Download className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Filters */}
      {showFilters && (
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="Search trades..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="flex-1 px-3 py-1.5 text-xs rounded-lg bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)]"
          />
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value as typeof filter)}
            className="px-2 py-1.5 text-xs rounded-lg bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-text-primary)]"
          >
            <option value="all">All Types</option>
            <option value="buy">Buy</option>
            <option value="sell">Sell</option>
            <option value="settle">Settle</option>
          </select>
        </div>
      )}

      {/* Trade List */}
      <div className="space-y-1 max-h-64 overflow-y-auto">
        <AnimatePresence>
          {filteredTrades.map((trade, index) => (
            <motion.div
              key={trade.id}
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ delay: index * 0.02 }}
              className="flex items-center justify-between p-2 rounded-lg bg-[var(--color-surface)] hover:bg-[var(--color-surface-hover)] transition-colors"
            >
              <div className="flex items-center gap-2">
                <TradeIcon type={trade.type} outcome={trade.outcome} />
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-medium text-[var(--color-text-primary)]">
                      {trade.type}
                    </span>
                    {trade.outcome && (
                      <span
                        className={`text-xs px-1.5 py-0.5 rounded ${
                          trade.outcome === "YES"
                            ? "bg-emerald-500/20 text-emerald-400"
                            : "bg-red-500/20 text-red-400"
                        }`}
                      >
                        {trade.outcome}
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-[var(--color-text-muted)]">
                    {trade.botName || "Manual"} · {new Date(trade.time).toLocaleTimeString()}
                  </div>
                </div>
              </div>

              <div className="text-right">
                <div className="text-sm font-medium text-[var(--color-text-primary)]">
                  ${trade.amount?.toFixed(2) || "-"}
                </div>
                {trade.pnl !== undefined && (
                  <div
                    className={`text-xs font-medium ${
                      trade.pnl >= 0 ? "text-emerald-400" : "text-red-400"
                    }`}
                  >
                    {trade.pnl >= 0 ? "+" : ""}${trade.pnl.toFixed(2)}
                  </div>
                )}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {filteredTrades.length === 0 && (
          <div className="text-center py-8 text-[var(--color-text-muted)] text-sm">
            No trades found
          </div>
        )}
      </div>

      {/* Show More/Less */}
      {trades.length > maxItems && (
        <button
          onClick={() => setShowAll(!showAll)}
          className="w-full py-2 text-xs text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors flex items-center justify-center gap-1"
        >
          {showAll ? "Show Less" : `Show All (${trades.length} trades)`}
          <ChevronDown
            className={`w-3 h-3 transition-transform ${showAll ? "rotate-180" : ""}`}
          />
        </button>
      )}
    </div>
  );
}

function TradeIcon({ type, outcome }: { type: string; outcome?: string }) {
  const isPositive = outcome === "YES" || (type === "SETTLE" && outcome === "YES");

  if (type === "BUY") {
    return (
      <div className="w-8 h-8 rounded-full bg-emerald-500/20 flex items-center justify-center">
        <TrendingUp className="w-4 h-4 text-emerald-400" />
      </div>
    );
  }

  if (type === "SELL") {
    return (
      <div className="w-8 h-8 rounded-full bg-red-500/20 flex items-center justify-center">
        <TrendingDown className="w-4 h-4 text-red-400" />
      </div>
    );
  }

  if (type === "SETTLE") {
    return (
      <div
        className={`w-8 h-8 rounded-full flex items-center justify-center ${
          isPositive ? "bg-emerald-500/20" : "bg-red-500/20"
        }`}
      >
        {isPositive ? (
          <TrendingUp className="w-4 h-4 text-emerald-400" />
        ) : (
          <TrendingDown className="w-4 h-4 text-red-400" />
        )}
      </div>
    );
  }

  return (
    <div className="w-8 h-8 rounded-full bg-[var(--color-surface-elevated)] flex items-center justify-center">
      <Minus className="w-4 h-4 text-[var(--color-text-muted)]" />
    </div>
  );
}

// Market Sentiment Indicator
interface MarketSentimentProps {
  yesPrice: number;
  noPrice: number;
  yesVolume: number;
  noVolume: number;
}

export function MarketSentiment({
  yesPrice,
  noPrice,
  yesVolume,
  noVolume,
}: MarketSentimentProps) {
  const totalVolume = yesVolume + noVolume;
  const yesRatio = totalVolume > 0 ? yesVolume / totalVolume : 0.5;
  const noRatio = 1 - yesRatio;

  const sentiment = yesRatio > 0.6 ? "bullish" : yesRatio < 0.4 ? "bearish" : "neutral";

  const sentimentConfig = {
    bullish: {
      label: "Bullish",
      color: "text-emerald-400",
      bgColor: "bg-emerald-500/20",
      description: "Most traders are betting YES",
    },
    bearish: {
      label: "Bearish",
      color: "text-red-400",
      bgColor: "bg-red-500/20",
      description: "Most traders are betting NO",
    },
    neutral: {
      label: "Neutral",
      color: "text-amber-400",
      bgColor: "bg-amber-500/20",
      description: "Market is evenly split",
    },
  };

  const config = sentimentConfig[sentiment];

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <TrendingUp className="w-4 h-4 text-[var(--color-text-secondary)]" />
        <span className="text-sm font-medium text-[var(--color-text-primary)]">
          Market Sentiment
        </span>
      </div>

      <div className="p-4 rounded-xl bg-[var(--color-card)] border border-[var(--color-border)]">
        <div className="flex items-center justify-between mb-4">
          <div className={`text-lg font-semibold ${config.color}`}>{config.label}</div>
          <div className={`px-2 py-1 rounded text-xs ${config.bgColor} ${config.color}`}>
            {config.description}
          </div>
        </div>

        {/* Sentiment Bar */}
        <div className="relative h-4 rounded-full overflow-hidden bg-[var(--color-surface)]">
          <motion.div
            className="absolute left-0 top-0 h-full bg-emerald-500"
            initial={{ width: 0 }}
            animate={{ width: `${yesRatio * 100}%` }}
            transition={{ duration: 0.5 }}
          />
          <motion.div
            className="absolute right-0 top-0 h-full bg-red-500"
            initial={{ width: 0 }}
            animate={{ width: `${noRatio * 100}%` }}
            transition={{ duration: 0.5 }}
          />
        </div>

        <div className="flex justify-between mt-2 text-sm">
          <div className="text-emerald-400">
            YES {(yesRatio * 100).toFixed(1)}%
          </div>
          <div className="text-red-400">
            NO {(noRatio * 100).toFixed(1)}%
          </div>
        </div>

        {/* Price Info */}
        <div className="grid grid-cols-2 gap-4 mt-4 pt-4 border-t border-[var(--color-border)]">
          <div className="text-center">
            <div className="text-xs text-[var(--color-text-muted)] mb-1">YES Price</div>
            <div className="text-lg font-semibold text-emerald-400">
              {(yesPrice * 100).toFixed(1)}¢
            </div>
            <div className="text-xs text-[var(--color-text-muted)]">
              Vol: {yesVolume.toFixed(2)}
            </div>
          </div>
          <div className="text-center">
            <div className="text-xs text-[var(--color-text-muted)] mb-1">NO Price</div>
            <div className="text-lg font-semibold text-red-400">
              {(noPrice * 100).toFixed(1)}¢
            </div>
            <div className="text-xs text-[var(--color-text-muted)]">
              Vol: {noVolume.toFixed(2)}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

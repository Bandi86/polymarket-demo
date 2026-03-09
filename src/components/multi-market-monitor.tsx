// Multi-Market Signal Monitor - Display signals across all active crypto markets
import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Badge } from "./ui/badge";
import { cn } from "../lib/utils";

interface MarketSignal {
  id: string;
  question: string;
  category: string;
  endTime: number;
  timeRemaining: number;
  yesPrice: number;
  noPrice: number;
  yesRoi: number;
  noRoi: number;
  volume: number;
  liquidity: number;
  signal: {
    recommendation: string;
    confidence: number;
    reason: string;
    inScalpWindow: boolean;
  };
  is5Min: boolean;
}

interface MarketsSignalsData {
  markets: MarketSignal[];
  btcPrice: number;
  lastSignal: {
    type: string;
    changePercent: number;
    confidence: number;
    timestamp: number;
  } | null;
  signalStats: {
    totalKlines: number;
    totalSignals: number;
    upSignals: number;
    downSignals: number;
    avgChange: number;
  };
  timestamp: number;
}

export function MultiMarketMonitor() {
  const [data, setData] = useState<MarketsSignalsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "5min" | "scalp">("all");

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await fetch("/api/markets/signals");
        if (!response.ok) throw new Error("Failed to fetch market signals");
        const result = await response.json();
        setData(result);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown error");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
    const interval = setInterval(fetchData, 1000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <Card className="bg-gray-900 border-gray-800">
        <CardHeader>
          <CardTitle className="text-white text-lg">Market Signals</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse text-gray-400">Loading market signals...</div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="bg-gray-900 border-gray-800">
        <CardHeader>
          <CardTitle className="text-white text-lg">Market Signals</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-red-400">Error: {error}</div>
        </CardContent>
      </Card>
    );
  }

  const { markets, btcPrice, lastSignal, signalStats } = data || { markets: [], btcPrice: 0, lastSignal: null, signalStats: { totalKlines: 0, totalSignals: 0, upSignals: 0, downSignals: 0, avgChange: 0 } };

  // Filter markets
  const filteredMarkets = markets.filter((m) => {
    if (filter === "5min") return m.is5Min;
    if (filter === "scalp") return m.signal.inScalpWindow;
    return true;
  });

  // Sort by time remaining
  const sortedMarkets = [...filteredMarkets].sort((a, b) => a.timeRemaining - b.timeRemaining);

  const formatTime = (ms: number) => {
    if (ms <= 0) return "Expired";
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
  };

  const getRecommendationColor = (rec: string) => {
    switch (rec) {
      case "YES":
        return "text-green-400 bg-green-500/20";
      case "NO":
        return "text-red-400 bg-red-500/20";
      default:
        return "text-gray-400 bg-gray-500/20";
    }
  };

  return (
    <Card className="bg-gray-900 border-gray-800">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-white text-lg">Market Signals</CardTitle>
          <div className="flex gap-2">
            <button
              onClick={() => setFilter("all")}
              className={cn(
                "px-2 py-1 text-xs rounded transition-colors",
                filter === "all" ? "bg-blue-500 text-white" : "bg-gray-800 text-gray-400 hover:bg-gray-700"
              )}
            >
              All
            </button>
            <button
              onClick={() => setFilter("5min")}
              className={cn(
                "px-2 py-1 text-xs rounded transition-colors",
                filter === "5min" ? "bg-blue-500 text-white" : "bg-gray-800 text-gray-400 hover:bg-gray-700"
              )}
            >
              5-Min
            </button>
            <button
              onClick={() => setFilter("scalp")}
              className={cn(
                "px-2 py-1 text-xs rounded transition-colors",
                filter === "scalp" ? "bg-blue-500 text-white" : "bg-gray-800 text-gray-400 hover:bg-gray-700"
              )}
            >
              Scalp
            </button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Global Signal Status */}
        <div className="bg-gray-800 rounded-lg p-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-gray-400 text-sm">BTC Price</span>
            <span className="text-white font-mono">${btcPrice?.toLocaleString() || "Loading..."}</span>
          </div>
          {lastSignal && lastSignal.type !== "NEUTRAL" && (
            <div className="flex items-center gap-2">
              <span className="text-gray-400 text-sm">Last Signal:</span>
              <Badge className={getRecommendationColor(lastSignal.type === "UP" ? "YES" : "NO")}>
                {lastSignal.type} {lastSignal.changePercent >= 0 ? "+" : ""}
                {lastSignal.changePercent.toFixed(4)}%
              </Badge>
            </div>
          )}
          <div className="grid grid-cols-3 gap-2 mt-2 text-center text-xs">
            <div className="bg-gray-700 rounded p-1">
              <span className="text-green-400">{signalStats.upSignals}</span> UP
            </div>
            <div className="bg-gray-700 rounded p-1">
              <span className="text-red-400">{signalStats.downSignals}</span> DOWN
            </div>
            <div className="bg-gray-700 rounded p-1">
              <span className="text-white">{signalStats.totalKlines}</span> Candles
            </div>
          </div>
        </div>

        {/* Markets List */}
        <div className="space-y-2 max-h-[400px] overflow-y-auto">
          {sortedMarkets.length === 0 ? (
            <div className="text-center text-gray-400 py-4">
              No markets found for the selected filter
            </div>
          ) : (
            sortedMarkets.map((market) => (
              <div
                key={market.id}
                className={cn(
                  "bg-gray-800 rounded-lg p-3 transition-all",
                  market.signal.inScalpWindow && "ring-2 ring-yellow-500/50"
                )}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-white text-sm font-medium truncate max-w-[200px]">
                      {market.question}
                    </span>
                    {market.is5Min && (
                      <Badge variant="info" className="text-xs">5M</Badge>
                    )}
                  </div>
                  <span
                    className={cn(
                      "font-mono text-sm",
                      market.timeRemaining < 60000 ? "text-red-400" : "text-gray-400"
                    )}
                  >
                    {formatTime(market.timeRemaining)}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex gap-4 text-xs">
                    <div>
                      <span className="text-green-400 font-mono">
                        YES: {(market.yesPrice * 100).toFixed(1)}¢
                      </span>
                      <span className="text-gray-500 ml-1">
                        (+{market.yesRoi.toFixed(0)}%)
                      </span>
                    </div>
                    <div>
                      <span className="text-red-400 font-mono">
                        NO: {(market.noPrice * 100).toFixed(1)}¢
                      </span>
                      <span className="text-gray-500 ml-1">
                        (+{market.noRoi.toFixed(0)}%)
                      </span>
                    </div>
                  </div>

                  {market.signal.recommendation !== "HOLD" && (
                    <Badge className={getRecommendationColor(market.signal.recommendation)}>
                      {market.signal.recommendation}
                      <span className="ml-1 opacity-70">
                        {(market.signal.confidence * 100).toFixed(0)}%
                      </span>
                    </Badge>
                  )}
                </div>

                {market.signal.inScalpWindow && (
                  <div className="mt-2 text-xs text-yellow-400 flex items-center gap-1">
                    <span className="inline-block w-2 h-2 bg-yellow-500 rounded-full animate-pulse" />
                    SCALP WINDOW - Last {(market.timeRemaining / 1000).toFixed(0)}s
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}
// Signal Panel - Real-time Binance signal display for predictive trading
// Shows the 4-12 second oracle delay exploitation opportunity

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Badge } from "./ui/badge";
import { Progress } from "./ui/progress";
import { cn } from "../lib/utils";

interface Kline {
  startTime: number;
  endTime: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  isClosed: boolean;
}

interface KlineSignal {
  type: "UP" | "DOWN" | "NEUTRAL";
  changePercent: number;
  threshold: number;
  confidence: number;
  timestamp: number;
  kline: Kline;
  predictedOutcome: "YES" | "NO" | null;
}

interface SignalStats {
  totalKlines: number;
  totalSignals: number;
  upSignals: number;
  downSignals: number;
  avgChange: number;
}

interface SignalData {
  currentKline: Kline | null;
  previousKline: Kline | null;
  lastSignal: KlineSignal | null;
  signalHistory: KlineSignal[];
  stats: SignalStats;
  threshold: number;
}

interface MarketData {
  question: string;
  outcomePrices: { yes: string; no: string };
  endTime: number;
}

interface SignalPanelProps {
  market?: MarketData | null;
  timeRemaining?: number;
  btcPrice?: number;
}

export function SignalPanel({ market, timeRemaining = 0, btcPrice = 0 }: SignalPanelProps) {
  const [signalData, setSignalData] = useState<SignalData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchSignal = async () => {
      try {
        const response = await fetch("/api/signal");
        if (!response.ok) throw new Error("Failed to fetch signal");
        const data = await response.json();
        setSignalData(data);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown error");
      } finally {
        setLoading(false);
      }
    };

    fetchSignal();
    const interval = setInterval(fetchSignal, 500); // Fast polling for real-time signal
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <Card className="bg-gray-900 border-gray-800">
        <CardHeader>
          <CardTitle className="text-white text-lg">Binance Signal</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse text-gray-400">Loading signal data...</div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="bg-gray-900 border-gray-800">
        <CardHeader>
          <CardTitle className="text-white text-lg">Binance Signal</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-red-400">Error: {error}</div>
        </CardContent>
      </Card>
    );
  }

  const { lastSignal, stats, threshold } = signalData || {};
  const signalAge = lastSignal ? Date.now() - lastSignal.timestamp : null;
  const isSignalFresh = signalAge !== null && signalAge < 8000;

  // Format time remaining
  const formatTime = (ms: number) => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
  };

  // Get signal color
  const getSignalColor = (type: string) => {
    switch (type) {
      case "UP":
        return "bg-green-500";
      case "DOWN":
        return "bg-red-500";
      default:
        return "bg-gray-500";
    }
  };

  // Get signal text color
  const getSignalTextColor = (type: string) => {
    switch (type) {
      case "UP":
        return "text-green-400";
      case "DOWN":
        return "text-red-400";
      default:
        return "text-gray-400";
    }
  };

  return (
    <Card className="bg-gray-900 border-gray-800">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-white text-lg">Binance Signal</CardTitle>
          <Badge variant="info" className="text-xs">
            Threshold: {threshold}%
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Current Signal */}
        <div className="bg-gray-800 rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-gray-400 text-sm">Current Signal</span>
            {lastSignal && (
              <span className={`text-xs ${isSignalFresh ? "text-green-400" : "text-yellow-400"}`}>
                {isSignalFresh ? "LIVE" : `${Math.floor((signalAge || 0) / 1000)}s ago`}
              </span>
            )}
          </div>

          {lastSignal && lastSignal.type !== "NEUTRAL" ? (
            <div className="flex items-center gap-3">
              <div
                className={`w-12 h-12 rounded-lg flex items-center justify-center ${getSignalColor(
                  lastSignal.type
                )}`}
              >
                <span className="text-white text-xl font-bold">
                  {lastSignal.type === "UP" ? "↑" : "↓"}
                </span>
              </div>
              <div>
                <div className={`text-2xl font-bold ${getSignalTextColor(lastSignal.type)}`}>
                  {lastSignal.type === "UP" ? "PRICE UP" : "PRICE DOWN"}
                </div>
                <div className="text-gray-400 text-sm">
                  {lastSignal.changePercent >= 0 ? "+" : ""}
                  {lastSignal.changePercent.toFixed(4)}% change
                </div>
              </div>
              <div className="ml-auto text-right">
                <div className="text-white font-medium">
                  Predicted: {lastSignal.predictedOutcome}
                </div>
                <div className="text-gray-400 text-sm">
                  Confidence: {(lastSignal.confidence * 100).toFixed(0)}%
                </div>
              </div>
            </div>
          ) : (
            <div className="text-gray-400 text-center py-4">
              No active signal - waiting for {threshold}%+ move
            </div>
          )}
        </div>

        {/* Market Info */}
        {market && (
          <div className="bg-gray-800 rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-gray-400 text-sm">Market</span>
              <span className="text-white text-sm font-mono">{formatTime(timeRemaining)}</span>
            </div>
            <div className="text-white text-sm truncate mb-2">{market.question}</div>
            <div className="flex gap-4">
              <div>
                <span className="text-green-400 font-mono">
                  YES: {parseFloat(market.outcomePrices?.yes || "0.5").toFixed(3)}
                </span>
              </div>
              <div>
                <span className="text-red-400 font-mono">
                  NO: {parseFloat(market.outcomePrices?.no || "0.5").toFixed(3)}
                </span>
              </div>
            </div>
            <Progress
              value={(timeRemaining / 300000) * 100}
              className="mt-2 h-1"
            />
          </div>
        )}

        {/* BTC Price */}
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-400">BTC Price</span>
          <span className="text-white font-mono">
            ${btcPrice?.toLocaleString() || "Loading..."}
          </span>
        </div>

        {/* Signal Stats */}
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="bg-gray-800 rounded p-2">
            <div className="text-green-400 font-bold">{stats?.upSignals || 0}</div>
            <div className="text-gray-500 text-xs">UP Signals</div>
          </div>
          <div className="bg-gray-800 rounded p-2">
            <div className="text-red-400 font-bold">{stats?.downSignals || 0}</div>
            <div className="text-gray-500 text-xs">DOWN Signals</div>
          </div>
          <div className="bg-gray-800 rounded p-2">
            <div className="text-white font-bold">{stats?.totalKlines || 0}</div>
            <div className="text-gray-500 text-xs">Candles</div>
          </div>
        </div>

        {/* Recent Signals */}
        {signalData?.signalHistory && signalData.signalHistory.length > 0 && (
          <div className="bg-gray-800 rounded-lg p-4">
            <div className="text-gray-400 text-sm mb-2">Recent Signals</div>
            <div className="space-y-1 max-h-32 overflow-y-auto">
              {signalData.signalHistory.slice(-5).map((sig, i) => (
                <div key={i} className="flex items-center justify-between text-sm">
                  <span className={getSignalTextColor(sig.type)}>
                    {sig.type} {sig.changePercent >= 0 ? "+" : ""}
                    {sig.changePercent.toFixed(4)}%
                  </span>
                  <span className="text-gray-500">
                    {new Date(sig.timestamp).toLocaleTimeString()}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Oracle Delay Info */}
        <div className="text-xs text-gray-500 border-t border-gray-800 pt-2">
          <div className="flex items-center gap-1">
            <span className="inline-block w-2 h-2 bg-yellow-500 rounded-full animate-pulse" />
            Exploits 4-12s Chainlink oracle delay
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
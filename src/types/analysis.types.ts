// === Analysis Types ===

import type { StrategyType, Trade } from "./index";

export interface StrategyAnalysis {
  fairValue: {
    action: "BUY_YES" | "BUY_NO" | "HOLD";
    fairValue: number;
    edge: number;
    confidence: number;
  };
  anomaly: {
    action: "BUY_BOTH" | "SELL_BOTH" | "HOLD";
    sum: number;
    confidence: number;
    arbProfit: number;
  };
  momentum: {
    action: "BUY_YES" | "BUY_NO" | "HOLD";
    momentum: number;
    confidence: number;
    trend: "up" | "down" | "sideways";
  };
  volatility: {
    value: number;
    regime: "low" | "normal" | "high" | "extreme";
    forecast: number;
  };
  technical: {
    rsi: number;
    macd: number;
    signal: number;
    histogram: number;
    support: number;
    resistance: number;
  };
  marketPrice: {
    yesPrice: number;
    noPrice: number;
    spread: number;
    imbalance: number;
  };
  recommendation: {
    action: "STRONG_BUY" | "BUY" | "HOLD" | "SELL" | "STRONG_SELL";
    confidence: number;
    reasons: string[];
  };
}

export interface BacktestResult {
  strategy: StrategyType;
  startDate: number;
  endDate: number;
  totalTrades: number;
  winRate: number;
  profitFactor: number;
  totalReturn: number;
  maxDrawdown: number;
  sharpeRatio: number;
  trades: Trade[];
  equityCurve: { timestamp: number; value: number }[];
}
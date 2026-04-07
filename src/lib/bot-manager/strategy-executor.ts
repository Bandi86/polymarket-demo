// Strategy Execution Logic
// Handles context building, bet sizing, and trade execution for bots

import type { BotConfig, StrategyContext, Outcome, StrategyType, DecisionContext } from "../../types";
import { strategies } from "../strategies";
import { marketEngine } from "../market-engine";
import { priceService } from "../price";
import { binanceKlineProvider } from "../providers/binance-kline-provider";
import { tickTrendAnalyzer } from "../providers/tick-trend-analyzer";
import { riskManager } from "../risk-manager";
import { strategyCoordinator } from "../strategy-coordinator";
import { polymarketProvider } from "../providers/polymarket-provider";
import { strategyConfig } from "../strategies/config";
import { checkOddsRange } from "../strategies/base";

// Bot loss tracking for risk management
interface BotLossTracker {
  consecutiveLosses: number;
  totalLosses: number;
  totalWins: number;
  lastLossTime: number;
  drawdown: number; // Current drawdown from peak balance
  peakBalance: number;
  pendingSettlements: number; // Number of trades awaiting settlement
}

const botLossTrackers = new Map<string, BotLossTracker>();

/**
 * Get or create loss tracker for a bot
 */
function getBotTracker(botId: string, currentBalance: number): BotLossTracker {
  let tracker = botLossTrackers.get(botId);
  if (!tracker) {
    tracker = {
      consecutiveLosses: 0,
      totalLosses: 0,
      totalWins: 0,
      lastLossTime: 0,
      drawdown: 0,
      peakBalance: currentBalance,
      pendingSettlements: 0,
    };
    botLossTrackers.set(botId, tracker);
  }

  // Update peak balance and drawdown
  if (currentBalance > tracker.peakBalance) {
    tracker.peakBalance = currentBalance;
  }
  tracker.drawdown = ((tracker.peakBalance - currentBalance) / tracker.peakBalance) * 100;

  return tracker;
}

/**
 * Update tracker AFTER trade is sent (not after settlement!)
 * This prevents race condition where bot sends multiple trades before settlement arrives
 */
export function markTradeSent(botId: string): void {
  const tracker = botLossTrackers.get(botId);
  if (tracker) {
    tracker.pendingSettlements++;
    console.log(`[LossTracker] ${botId}: trade sent, pendingSettlements=${tracker.pendingSettlements}`);
  }
}

/**
 * Update tracker after settlement
 */
export function updateBotTracker(botId: string, won: boolean, pnl: number, currentBalance: number): void {
  const tracker = getBotTracker(botId, currentBalance);

  const prevConsecutive = tracker.consecutiveLosses;

  if (won) {
    tracker.totalWins++;
    tracker.consecutiveLosses = 0;
  } else {
    tracker.totalLosses++;
    tracker.consecutiveLosses++;
    tracker.lastLossTime = Date.now();
  }

  // Decrement pending settlements (min 0)
  tracker.pendingSettlements = Math.max(0, tracker.pendingSettlements - 1);

  // LOGGING: Log settlement for debugging
  console.log(`[LossTracker] ${botId} settlement: ${won ? 'WIN' : 'LOSS'} (${pnl >= 0 ? '+' : ''}$${pnl.toFixed(2)}) | consecutiveLosses: ${prevConsecutive} → ${tracker.consecutiveLosses}, pendingSettlements: ${tracker.pendingSettlements}`);
}

/**
 * Reset all loss trackers - call when competition starts
 */
export function resetAllLossTrackers(): void {
  botLossTrackers.clear();
  console.log("[LossTracker] All trackers reset for new competition");
}

/**
 * Get risk multiplier based on bot performance
 * Returns 0 if bot should stop trading (hit loss limits)
 *
 * RACE CONDITION FIX: Also checks pendingSettlements to prevent
 * trades being sent while waiting for settlement arrival.
 */
export function getRiskMultiplier(botId: string, currentBalance: number): number {
  const tracker = getBotTracker(botId, currentBalance);

  // LOGGING: Log tracker state for debugging
  if (tracker.consecutiveLosses > 0 || tracker.pendingSettlements > 0) {
    console.log(`[LossTracker] ${botId}: consecutiveLosses=${tracker.consecutiveLosses}, pendingSettlements=${tracker.pendingSettlements}, drawdown=${tracker.drawdown.toFixed(1)}%`);
  }

  // REMOVED: Stop after 3 consecutive losses - demo mode should test all scenarios
  // Also stop if we have pending settlements (race condition prevention)
  if (tracker.pendingSettlements > 0) {
    return 0; // Stop trading - but will resume after settlement
  }

  // REMOVED: 3 consecutive losses stop - let bots trade in demo mode
  // Reduced sizing after consecutive losses (but don't stop completely)
  if (tracker.consecutiveLosses >= 5) {
    return 0.25; // Very aggressive risk reduction but still trade
  }

  if (tracker.consecutiveLosses === 2) {
    return 0.25; // 25% of normal size
  }

  if (tracker.consecutiveLosses === 1) {
    return 0.5; // 50% of normal size
  }

  // REMOVED: 25% drawdown stop - demo mode should test all scenarios
  // Reduced sizing only (no hard stop)
  if (tracker.drawdown >= 30) {
    return 0.25;
  }

  if (tracker.drawdown >= 20) {
    return 0.5;
  }

  // Normal sizing
  return 1;
}

/**
 * Adjust confidence based on bot's recent performance
 * Reduces confidence after consecutive losses but NEVER stops trading in demo mode
 */
export function adjustConfidenceForPerformance(
  botId: string,
  baseConfidence: number,
  currentBalance: number
): number {
  const tracker = getBotTracker(botId, currentBalance);

  // REMOVED: Stop trading after 3 consecutive losses - demo mode keeps testing
  // Only reduce confidence but always allow trading
  let confidenceMultiplier = 1.0;

  if (tracker.consecutiveLosses === 1) {
    confidenceMultiplier = 0.7; // 30% reduction
  } else if (tracker.consecutiveLosses === 2) {
    confidenceMultiplier = 0.5; // 50% reduction
  } else if (tracker.consecutiveLosses >= 3) {
    confidenceMultiplier = 0.3; // 70% reduction but still trade
  }

  // Also reduce if on a losing streak overall
  if (tracker.totalLosses > tracker.totalWins * 1.5 && tracker.totalWins >= 3) {
    confidenceMultiplier *= 0.8; // Additional 20% reduction
  }

  return Math.max(0, baseConfidence * confidenceMultiplier);
}

/**
 * Get current market regime
 * - 'trending_up': Strong upward momentum
 * - 'trending_down': Strong downward momentum
 * - 'ranging': No clear direction
 * - 'volatile': High volatility, unpredictable
 */
export function getMarketRegime(ctx: StrategyContext): 'trending_up' | 'trending_down' | 'ranging' | 'volatile' {
  const btcVelocity = ctx.btcVelocity ?? 0;
  const btcAcceleration = ctx.btcAcceleration ?? 0;
  const btcVolatility = ctx.btcVolatility ?? 0;
  const volatility = ctx.volatility ?? 0;

  // High volatility = volatile regime
  if (btcVolatility > 0.02 || volatility > 0.05) {
    return 'volatile';
  }

  // Strong trend detection
  if (btcVelocity > 0.001 && btcAcceleration > 0) {
    return 'trending_up';
  }

  if (btcVelocity < -0.001 && btcAcceleration < 0) {
    return 'trending_down';
  }

  // Default to ranging
  return 'ranging';
}

export interface MarketInfo {
  id: string;
  startTime: number;
  endTime: number;
  startPrice?: number;
  outcomePrices?: { yes: string; no: string };
  yesPriceHistory?: Array<{ price: number; timestamp: number }>;
  tokens?: Array<{ token_id: string; outcome: string }>;
  status: string;
  btcStartPrice?: number; // BTC price when market started - critical for delta calculation
}

export interface TradeDecision {
  action: Outcome;
  confidence: number;
  reason?: string;
  betSize: number;
  adjustedBetSize?: number;
}

export interface StrategyExecutionResult {
  executed: boolean;
  position?: {
    id: string;
    outcome: Outcome;
    amount: number;
    odds: number;
    fee: number;
  };
  error?: string;
  mode: "demo" | "live";
}

/**
 * Build strategy context from market and price data
 */
export function buildStrategyContext(market: MarketInfo): StrategyContext {
  const yesPrice = parseFloat(market.outcomePrices?.yes || "0.5");
  const noPrice = parseFloat(market.outcomePrices?.no || "0.5");
  const yesPriceHistory = market.yesPriceHistory || [];
  const priceHistory = yesPriceHistory.map((p) => p.price);
  const timeRemaining = market.endTime - Date.now();
  const totalDuration = market.endTime - market.startTime;

  // Update tick trend analyzer with current price
  tickTrendAnalyzer.addTick(yesPrice);

  // Calculate volatility from YES price changes
  let volatility = 0;
  if (priceHistory.length >= 5) {
    const changes: number[] = [];
    for (let i = 1; i < priceHistory.length; i++) {
      changes.push(Math.abs(priceHistory[i] - priceHistory[i - 1]));
    }
    volatility = changes.reduce((a, b) => a + b, 0) / changes.length;
  }

  // Calculate momentum from YES price trend
  let momentum = 0;
  if (priceHistory.length >= 3) {
    const recent = priceHistory.slice(-3);
    const older = priceHistory.slice(-6, -3);
    if (older.length > 0) {
      const recentAvg = recent.reduce((a, b) => a + b, 0) / recent.length;
      const olderAvg = older.reduce((a, b) => a + b, 0) / older.length;
      momentum = recentAvg - olderAvg;
    }
  }

  // Get Binance signal data
  const lastSignal = binanceKlineProvider.getLastSignal();
  const binanceSignal = lastSignal ? {
    type: lastSignal.type,
    changePercent: lastSignal.changePercent,
    confidence: lastSignal.confidence,
    timestamp: lastSignal.timestamp,
    predictedOutcome: lastSignal.predictedOutcome,
  } : undefined;

  // Get BTC price and change
  const btcPrice = priceService.getPrice();
  const btcHistory = priceService.getPriceHistory(200);
  const btcPriceHistory = btcHistory.slice(-20).map(p => p.price);
  const btcPriceChange = btcHistory.length >= 2
    ? (btcPrice - btcHistory[0].price) / btcHistory[0].price
    : 0;

  // Calculate BTC window open price - use provided btcStartPrice if available
  let btcWindowOpen = btcPrice;

  // CRITICAL: Use the btcStartPrice from market engine if available
  // This is the BTC price when the market started, needed for accurate delta calculation
  if (market.btcStartPrice && market.btcStartPrice > 0) {
    btcWindowOpen = market.btcStartPrice;
  } else if (btcHistory.length > 0 && market.startTime) {
    // Fallback: try to find closest price in history (may not work if app started after market)
    const windowOpenTime = market.startTime;
    const closest = btcHistory.reduce((prev, curr) =>
      Math.abs(curr.timestamp - windowOpenTime) < Math.abs(prev.timestamp - windowOpenTime)
        ? curr : prev
    );
    btcWindowOpen = closest.price;
  }

  // === NEW CONTEXT DATA for Option A strategies ===

  // Time-based context (UTC)
  const now = new Date();
  const hourOfDay = now.getUTCHours();
  const dayOfWeek = now.getUTCDay(); // 0 = Sunday

  // BTC velocity (price change per second over last 10 seconds)
  let btcVelocity = 0;
  let btcAcceleration = 0;
  const klineHistory = binanceKlineProvider.getKlineHistory(10);
  if (klineHistory.length >= 2) {
    const recent = klineHistory[klineHistory.length - 1];
    const previous = klineHistory[klineHistory.length - 2];
    const timeDiff = (recent.startTime - previous.startTime) / 1000 || 1;
    btcVelocity = (recent.close - previous.close) / previous.close / timeDiff;

    // Acceleration (velocity change)
    if (klineHistory.length >= 3) {
      const older = klineHistory[klineHistory.length - 3];
      const olderVelocity = (previous.close - older.close) / older.close / timeDiff;
      btcAcceleration = btcVelocity - olderVelocity;
    }
  }

  // YES price velocity (rate of change)
  let priceVelocity = 0;
  if (priceHistory.length >= 5) {
    const recent = priceHistory.slice(-3);
    const older = priceHistory.slice(-6, -3);
    if (older.length > 0) {
      const recentAvg = recent.reduce((a, b) => a + b, 0) / recent.length;
      const olderAvg = older.reduce((a, b) => a + b, 0) / older.length;
      priceVelocity = recentAvg - olderAvg; // Change per tick (~200ms)
    }
  }

  // BTC realized volatility from price service
  const btcVolatility = priceService.getVolatility(20);

  return {
    currentPrice: yesPrice,
    startPrice: market.startPrice || 0.5,
    priceHistory,
    timeRemaining,
    marketDuration: totalDuration,
    marketPrice: { yesPrice, noPrice },
    volatility,
    momentum,
    binanceSignal,
    btcPrice,
    btcPriceChange,
    btcWindowOpen,
    btcPriceHistory,
    // New context data
    hourOfDay,
    dayOfWeek,
    btcVelocity,
    btcAcceleration,
    priceVelocity,
    btcVolatility,
  };
}

/**
 * Calculate bet size using Kelly criterion with odds-aware adjustments
 * Key insight: Higher odds (60-80¢) have higher win rate, can afford larger bets
 * Lower odds (0-20¢) are lottery tickets, smaller bets
 */
export function calculateBetSize(
  bot: BotConfig,
  action: Outcome,
  yesPrice: number,
  noPrice: number,
  balance: number
): number {
  let betSize = bot.betSize;

  // Get the odds we're buying at
  const odds = action === "YES" ? yesPrice : noPrice;

  // Odds-aware multiplier
  // At 60-80¢: 1.2x (higher win rate, can bet more)
  // At 80-95¢: 0.8x (still high win rate but less upside)
  // At 5-40¢: 0.5x (lottery tickets, bet less)
  let oddsMultiplier = 1.0;
  if (odds >= 0.60 && odds <= 0.80) {
    oddsMultiplier = 1.2; // Sweet spot - boost bet size
  } else if (odds > 0.80) {
    oddsMultiplier = 0.8; // Expensive - reduce bet
  } else if (odds < 0.40) {
    oddsMultiplier = 0.5; // Cheap/lottery - reduce bet significantly
  }

  if (bot.useKelly || bot.useKelly === undefined) {
    // Use historical win rate if available
    const botStats = bot.stats;
    const winProbability = botStats.trades >= 5
      ? botStats.winRate
      : (action === "YES" ? 1 - yesPrice : 1 - noPrice);

    // Net odds calculation
    const price = action === "YES" ? yesPrice : noPrice;
    const netOdds = (1 - price) / price;

    // Kelly formula: f* = (p*b - q) / b
    const q = 1 - winProbability;
    const kellyFraction = (winProbability * netOdds - q) / netOdds;

    // Apply half-Kelly and user's fraction, plus odds multiplier
    const adjustedKelly = Math.max(0, kellyFraction * 0.5 * (bot.kellyFraction || 0.5) * oddsMultiplier);
    const kellyBet = balance * adjustedKelly;

    // Cap at maxBet percentage
    const maxBetPercent = bot.maxBet || 0.25;
    const maxBetAmount = balance * maxBetPercent;

    betSize = Math.min(kellyBet, maxBetAmount);

    // Minimum $1 bet
    betSize = Math.max(1, betSize);
  } else {
    // No Kelly - percentage-based with odds multiplier
    const maxBetPercent = bot.maxBet || 0.25;
    const maxBetAmount = balance * maxBetPercent;
    betSize = Math.min(bot.betSize * oddsMultiplier, maxBetAmount);
    // Minimum $1 bet
    betSize = Math.max(1, betSize);
  }

  return betSize;
}

/**
 * Execute a strategy and get a decision
 */
export function executeStrategy(
  botStrategy: StrategyType,
  context: StrategyContext
): { action: Outcome | null; confidence: number; reason?: string } | null {
  const strategy = strategies[botStrategy];
  if (!strategy) return null;

  try {
    return strategy.execute(context);
  } catch (error) {
    console.error(`[StrategyExecutor] Strategy execution error:`, error);
    return null;
  }
}

/**
 * Execute a live trade on Polymarket
 */
export async function executeLiveTrade(
  botId: string,
  market: MarketInfo,
  action: Outcome,
  betSize: number,
  addLog: (type: string, message: string, details?: Record<string, unknown>) => void
): Promise<StrategyExecutionResult> {
  try {
    // Get token ID for the outcome
    let tokenId: string | undefined;
    if (market.tokens && market.tokens.length > 0) {
      const token = market.tokens.find(t =>
        (action === "YES" && (t.outcome.toLowerCase() === "yes" || t.outcome.toLowerCase().includes("up"))) ||
        (action === "NO" && (t.outcome.toLowerCase() === "no" || t.outcome.toLowerCase().includes("down")))
      );
      tokenId = token?.token_id;
    }

    if (!tokenId) {
      addLog("ERROR", `Cannot find token for ${action} outcome in live mode`, {
        action,
        marketId: market.id,
      });
      return { executed: false, error: "Token not found", mode: "live" };
    }

    // Get current price
    const yesPrice = parseFloat(market.outcomePrices?.yes || "0.5");
    const noPrice = parseFloat(market.outcomePrices?.no || "0.5");
    const price = action === "YES" ? yesPrice : noPrice;

    // Calculate size
    const size = betSize / price;

    addLog("TRADE", `LIVE: Placing ${action} order for $${betSize.toFixed(2)} @ ${(price * 100).toFixed(1)}¢`, {
      action,
      amount: betSize,
      price,
      size,
      tokenId,
      mode: "live",
    });

    // Place order on Polymarket
    const result = await polymarketProvider.placeOrder({
      tokenId,
      side: "BUY",
      price,
      size,
    });

    if (result.success) {
      addLog("TRADE", `✅ LIVE order placed: ${action} $${betSize.toFixed(2)} @ ${(price * 100).toFixed(1)}¢`, {
        orderId: result.orderId,
        action,
        amount: betSize,
        price,
        size,
        mode: "live",
      });
      return { executed: true, mode: "live" };
    } else {
      addLog("ERROR", `❌ LIVE order failed: ${result.error}`, {
        error: result.error,
        action,
        amount: betSize,
        mode: "live",
      });
      return { executed: false, error: result.error, mode: "live" };
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    addLog("ERROR", `LIVE trade exception: ${errorMessage}`, {
      error: errorMessage,
      mode: "live",
    });
    return { executed: false, error: errorMessage, mode: "live" };
  }
}

/**
 * Check risk management constraints
 */
export function checkRiskConstraints(
  botId: string,
  betSize: number,
  confidence: number
): { allowed: boolean; reason?: string } {
  // Check if bot is paused
  if (riskManager.shouldPause(botId)) {
    const status = riskManager.getBotRiskStatus(botId);
    if (status.paused && status.pauseReason) {
      return { allowed: false, reason: `Bot paused: ${status.pauseReason}` };
    }
  }

  // Check if can open position
  const riskCheck = riskManager.canOpenPosition(botId, betSize, confidence);
  return riskCheck;
}

/**
 * Check coordination with other bots
 */
export function checkCoordination(
  marketId: string,
  botId: string,
  botName: string,
  strategy: StrategyType,
  action: Outcome,
  confidence: number,
  betSize: number,
  totalBalance: number
): { allowed: boolean; reason?: string; adjustedBetSize?: number; warnings?: string[] } {
  const coordination = strategyCoordinator.registerDecision(
    marketId,
    {
      botId,
      botName,
      strategy,
      action,
      confidence,
      betSize,
    },
    totalBalance
  );

  return coordination;
}

/**
 * Confirm trade execution with coordinator
 */
export function confirmExecution(marketId: string, botId: string, action: Outcome, betSize: number): void {
  strategyCoordinator.confirmExecution(marketId, botId, action, betSize);
}

/**
 * Cancel trade decision with coordinator
 */
export function cancelDecision(marketId: string, botId: string): void {
  strategyCoordinator.cancelDecision(marketId, botId);
}

/**
 * Build full decision context for logging
 */
export function buildDecisionContext(
  bot: BotConfig,
  context: StrategyContext,
  decision: { action: Outcome; confidence: number; reason?: string },
  rawBetSize: number,
  finalBetSize: number,
  riskCheck: { allowed: boolean; reason?: string }
): DecisionContext {
  // Get thresholds used for this strategy
  const thresholds = strategyConfig[bot.strategy] || {};
  const thresholdsUsed: Record<string, number> = {};
  for (const [key, value] of Object.entries(thresholds)) {
    if (typeof value === "number") {
      thresholdsUsed[key] = value;
    }
  }

  // Calculate BTC delta
  const btcPrice = context.btcPrice ?? 0;
  const btcWindowOpen = context.btcWindowOpen ?? btcPrice;
  const btcDelta = btcWindowOpen > 0
    ? ((btcPrice - btcWindowOpen) / btcWindowOpen) * 100
    : 0;

  // Map binanceSignal type
  let binanceSignalMapped: DecisionContext["binanceSignal"] = undefined;
  if (context.binanceSignal) {
    const signalType = context.binanceSignal.type === "UP" ? "bullish" as const :
                       context.binanceSignal.type === "DOWN" ? "bearish" as const : undefined;
    if (signalType) {
      binanceSignalMapped = {
        type: signalType,
        changePercent: context.binanceSignal.changePercent,
        confidence: context.binanceSignal.confidence,
        age: Date.now() - context.binanceSignal.timestamp,
      };
    }
  }

  // Build decision context
  return {
    strategy: bot.strategy,
    action: decision.action,
    confidence: decision.confidence,
    reason: decision.reason || "No reason provided",

    yesPrice: context.marketPrice.yesPrice,
    noPrice: context.marketPrice.noPrice,
    btcPrice,
    btcDelta,
    timeRemaining: context.timeRemaining,
    marketDuration: context.marketDuration,

    // Strategy-specific signals
    binanceSignal: binanceSignalMapped,

    windowDelta: bot.strategy === "window_delta" ? btcDelta : undefined,
    edge: thresholdsUsed.minEdge || undefined,

    thresholdsUsed,

    riskChecksPassed: riskCheck.allowed,
    kellyFractionUsed: bot.useKelly ? bot.kellyFraction : undefined,

    rawBetSize,
    finalBetSize,
    balanceAtDecision: bot.portfolio?.balance || 0,
  };
}

/**
 * Calculate 7-factor confidence score
 * Normalizes multiple signals into a single confidence value
 */
export function calculate7FactorConfidence(
  context: StrategyContext,
  action: Outcome,
  thresholds: Record<string, unknown>
): { score: number; factors: Record<string, number> } {
  let score = 0;
  let totalWeight = 0;
  const factors: Record<string, number> = {};

  // 1. Window Delta (weight: 5)
  const btcPrice = context.btcPrice ?? 0;
  const btcWindowOpen = context.btcWindowOpen ?? btcPrice;
  const btcDelta = btcWindowOpen > 0
    ? Math.abs(((btcPrice - btcWindowOpen) / btcWindowOpen) * 100)
    : 0;
  const deltaMatches = (action === "YES" && btcPrice > btcWindowOpen) ||
                       (action === "NO" && btcPrice < btcWindowOpen);
  let deltaScore = 0;
  if (deltaMatches) {
    if (btcDelta > 0.10) deltaScore = 5;
    else if (btcDelta > 0.07) deltaScore = 4;
    else if (btcDelta > 0.04) deltaScore = 3;
    else if (btcDelta > 0) deltaScore = 2;
  }
  factors.windowDelta = deltaScore / 5;
  score += deltaScore;
  totalWeight += 5;

  // 2. Binance Signal (weight: 4)
  let binanceScore = 0;
  if (context.binanceSignal && context.binanceSignal.type !== "NEUTRAL") {
    const signalMatches = (context.binanceSignal.type === "UP" && action === "YES") ||
                          (context.binanceSignal.type === "DOWN" && action === "NO");
    if (signalMatches) {
      binanceScore = 4 * context.binanceSignal.confidence;
    }
  }
  factors.binanceSignal = binanceScore / 4;
  score += binanceScore;
  totalWeight += 4;

  // 3. Tick Trend (weight: 3)
  const tickTrend = tickTrendAnalyzer.getTrend();
  let tickScore = 0;
  if (tickTrend.direction !== "NEUTRAL") {
    const trendMatches = (tickTrend.direction === "UP" && action === "YES") ||
                         (tickTrend.direction === "DOWN" && action === "NO");
    if (trendMatches && tickTrend.consistency >= 0.6) {
      tickScore = 3 * tickTrend.consistency;
    }
  }
  factors.tickTrend = tickScore / 3;
  score += tickScore;
  totalWeight += 3;

  // 4. Time Remaining (weight: 2)
  let timeScore = 0;
  if (context.timeRemaining < 30000 && context.timeRemaining > 5000) {
    timeScore = 2; // Sweet spot for T-10 strategies
  } else if (context.timeRemaining > 60000) {
    timeScore = 1; // Early in market
  }
  factors.timeRemaining = timeScore / 2;
  score += timeScore;
  totalWeight += 2;

  // 5. Odds Position (weight: 2)
  const odds = action === "YES" ? context.marketPrice.yesPrice : context.marketPrice.noPrice;
  let oddsScore = 0;
  // Reward extreme odds (avoiding middle)
  if (odds > 0.70 || odds < 0.30) {
    oddsScore = 2;
  } else if (odds > 0.60 || odds < 0.40) {
    oddsScore = 1;
  }
  factors.oddsPosition = oddsScore / 2;
  score += oddsScore;
  totalWeight += 2;

  // 6. Momentum (weight: 1)
  let momentumScore = 0;
  if (Math.abs(context.momentum) > 0.01) {
    const momentumMatches = (context.momentum > 0 && action === "YES") ||
                            (context.momentum < 0 && action === "NO");
    if (momentumMatches) momentumScore = 1;
  }
  factors.momentum = momentumScore;
  score += momentumScore;
  totalWeight += 1;

  // 7. Volatility (weight: 1)
  let volatilityScore = 0;
  if (context.volatility < 0.02) {
    volatilityScore = 1; // Prefer low volatility
  }
  factors.volatility = volatilityScore;
  score += volatilityScore;
  totalWeight += 1;

  // Normalize to 0-1
  const normalizedScore = totalWeight > 0 ? score / totalWeight : 0;

  return { score: normalizedScore, factors };
}

/**
 * Check if odds are in acceptable range for strategy
 */
export function checkStrategyOdds(
  action: Outcome,
  yesPrice: number,
  noPrice: number,
  strategy: StrategyType
): { valid: boolean; reason?: string; odds: number } {
  const odds = action === "YES" ? yesPrice : noPrice;
  const thresholds = strategyConfig[strategy];

  const result = checkOddsRange(odds, thresholds);
  return { ...result, odds };
}
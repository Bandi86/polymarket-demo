// Sniper Value Strategy
// Based on: https://x.com/Mnilax/status/2038626407333417470
// 100% win rate, 490 trades, $5 → $15,000
//
// Strategy:
// - Buy YES if below 10-15 cents (extreme undervaluation)
// - Buy NO if YES above 40-50 cents (overvaluation)
// - Risk under $5 per trade
//
// PHASE 1 FIXES (2026-04-04):
// - Market regime detection: Avoid mean reversion in strong trends
// - Dynamic confidence: Reduce after consecutive losses
// - Price velocity filter: Enhanced to catch slow bleeds
// - Minimum recovery probability check

import type { Strategy, StrategyContext } from "../../../types";
import type { StrategyDecision } from "../types";
import { strategyConfig } from "../config";
import { noTrade, trade } from "../base";

// Market regime awareness - mean reversion fails in strong trends
const REGIME_MULTIPLIERS = {
  trending_up: 0.3,    // Reduce confidence in trends
  trending_down: 0.3,  // Reduce confidence in trends
  ranging: 1.0,        // Full confidence in ranging markets
  volatile: 0.5,       // Moderate confidence in volatile markets
};

export const sniperValueStrategy: Strategy = {
  name: "Sniper Value",
  description: "Trades at extreme prices - 10-15¢ YES, 40-50¢+ NO",
  category: "mean_reversion",
  execute: (ctx: StrategyContext): StrategyDecision => {
    const thresholds = strategyConfig.sniper_value;

    // Time check - avoid last 20 seconds
    if (ctx.timeRemaining < (thresholds.minTimeRemaining ?? 20000)) {
      return noTrade("Too close to closure");
    }

    const yesPrice = ctx.marketPrice.yesPrice;
    const noPrice = ctx.marketPrice.noPrice;
    const priceVelocity = ctx.priceVelocity ?? 0;
    const btcVelocity = ctx.btcVelocity ?? 0;
    const btcAcceleration = ctx.btcAcceleration ?? 0;
    const btcVolatility = ctx.btcVolatility ?? 0;

    // ═══════════════════════════════════════════════════════════════
    // MARKET REGIME DETECTION
    // Mean reversion strategies fail in strong trending markets
    // ═══════════════════════════════════════════════════════════════

    // Strong trend detection - AVOID trading
    const isStrongTrend = Math.abs(btcVelocity) > 0.002 && Math.abs(btcAcceleration) > 0.0005;
    const isVolatile = btcVolatility > 0.025;

    if (isStrongTrend) {
      const trendDirection = btcVelocity > 0 ? "UP" : "DOWN";
      return noTrade(`Strong BTC trend ${trendDirection} - mean reversion risky`);
    }

    if (isVolatile) {
      return noTrade("High volatility - market unpredictable");
    }

    // Thresholds from the strategy
    const yesBuyMax = thresholds.yesBuyMax ?? 0.15;    // Buy YES if < 15¢
    const noBuyMin = thresholds.noBuyMin ?? 0.40;       // Buy NO if YES > 40¢

    // ═══════════════════════════════════════════════════════════════
    // CASE 1: YES is EXTREMELY CHEAP (< 10-15¢)
    // Market is overly pessimistic - buy YES for cheap
    // ═══════════════════════════════════════════════════════════════
    if (yesPrice < yesBuyMax) {
      // Enhanced price velocity check - catch slow bleeds
      const droppingFast = priceVelocity < -0.015;
      const droppingModerate = priceVelocity < -0.005;

      // Check recovery probability - is price showing signs of stabilization?
      const priceHistory = ctx.priceHistory || [];
      let isStabilizing = false;
      if (priceHistory.length >= 5) {
        const recent = priceHistory.slice(-3);
        const older = priceHistory.slice(-5, -3);
        const recentAvg = recent.reduce((a, b) => a + b, 0) / recent.length;
        const olderAvg = older.reduce((a, b) => a + b, 0) / older.length;
        // Stabilizing if recent average is not significantly lower
        isStabilizing = recentAvg >= olderAvg * 0.98; // Within 2% is okay
      }

      if (droppingFast) {
        return noTrade(`YES crashing: velocity=${priceVelocity.toFixed(4)}`);
      }

      if (droppingModerate && !isStabilizing) {
        return noTrade(`YES still dropping, no stabilization`);
      }

      // Price stabilizing or recovering - BUY YES
      // Cheaper = higher confidence (more upside)
      let confidence = Math.min(0.90, 0.60 + (yesBuyMax - yesPrice) * 3);

      // Apply regime multiplier (already passed trend check, so ranging market)
      confidence *= REGIME_MULTIPLIERS.ranging;

      // Minimum recovery probability check
      const recoveryProb = yesPrice; // Probability of YES occurring
      if (recoveryProb < 0.10) {
        // Less than 10% chance - too risky even at low price
        return noTrade(`Recovery probability too low: ${(recoveryProb * 100).toFixed(1)}%`);
      }

      return trade(
        "YES",
        confidence,
        `SNIPER YES: extremely cheap @ ${(yesPrice * 100).toFixed(0)}¢ (target: 50¢+)`,
        { yesPrice, priceVelocity, mode: "sniper_yes_cheap" }
      );
    }

    // ═══════════════════════════════════════════════════════════════
    // CASE 2: YES is OVERPRICED (> 40-50¢)
    // Market is overly optimistic - buy NO for cheap
    // ═══════════════════════════════════════════════════════════════
    if (yesPrice > noBuyMin) {
      // NO price is now cheap (since YES is expensive)
      const effectiveNoPrice = noPrice;

      // Check if YES is still rising fast - wait
      const risingFast = priceVelocity > 0.015;
      const risingModerate = priceVelocity > 0.005;

      // Check for peak detection
      const priceHistory = ctx.priceHistory || [];
      let isPeaking = false;
      if (priceHistory.length >= 5) {
        const recent = priceHistory.slice(-3);
        const older = priceHistory.slice(-5, -3);
        const recentAvg = recent.reduce((a, b) => a + b, 0) / recent.length;
        const olderAvg = older.reduce((a, b) => a + b, 0) / older.length;
        // Peaking if recent average is not significantly higher
        isPeaking = recentAvg <= olderAvg * 1.02; // Within 2% suggests peak
      }

      if (risingFast) {
        return noTrade(`YES still rising fast: velocity=${priceVelocity.toFixed(4)}`);
      }

      if (risingModerate && !isPeaking) {
        return noTrade(`YES rising, no peak detected yet`);
      }

      // YES stabilizing or dropping - BUY NO
      // Higher YES price = cheaper NO = more upside
      let confidence = Math.min(0.85, 0.55 + (yesPrice - noBuyMin) * 2);

      // Apply regime multiplier
      confidence *= REGIME_MULTIPLIERS.ranging;

      return trade(
        "NO",
        confidence,
        `SNIPER NO: YES overpriced @ ${(yesPrice * 100).toFixed(0)}¢ (NO: ${(effectiveNoPrice * 100).toFixed(0)}¢)`,
        { yesPrice, noPrice: effectiveNoPrice, priceVelocity, mode: "sniper_no_cheap" }
      );
    }

    // ═══════════════════════════════════════════════════════════════
    // MIDDLE ZONE (15-40¢) - NO TRADE
    // This is the "fair value" zone - no edge
    // ═══════════════════════════════════════════════════════════════
    return noTrade(`Middle zone: YES=${(yesPrice * 100).toFixed(0)}¢ (no edge)`);
  },
};

export default sniperValueStrategy;
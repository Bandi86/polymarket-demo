// Time Pattern Strategy
// Trades only during specific hours when BTC is more directional
// Research shows BTC has predictable patterns around market opens
//
// PHASE 1 FIX (2026-04-04): Enhanced logging for trade rejections
// - Logs every noTrade decision with detailed reason
// - Tracks "near miss" opportunities (small delta, wrong hour)
// - Adds debug information for analysis

import type { Strategy, StrategyContext } from "../../../types";
import type { StrategyDecision } from "../types";
import { strategyConfig } from "../config";
import { noTrade, trade } from "../base";

// High-conviction hours (UTC)
// - US market open: 14:30-16:00 UTC (9:30-11:00 AM EST)
// - Asian market open: 00:00-02:00 UTC (9:00-11:00 AM JST)
// - European open: 08:00-10:00 UTC
const HIGH_CONVICTION_HOURS = [
  [0, 2],    // Asian open
  [8, 10],   // European open
  [14, 16],  // US open
];

// Low-volume hours to avoid (UTC)
// - Weekend: Saturday (day 6) and Sunday (day 0)
// - Late US hours: 22:00-02:00 UTC (low liquidity)
const AVOID_HOURS = [
  [22, 24],  // Late US
];

// Debug logging helper
function logDecision(reason: string, details?: Record<string, unknown>): void {
  // Only log in development
  if (typeof process !== 'undefined' && process.env.NODE_ENV === 'development') {
    console.log(`[TimePattern] ${reason}`, details ? JSON.stringify(details) : '');
  }
  // In production, this could be sent to a debug endpoint
}

export const timePatternStrategy: Strategy = {
  name: "Time Pattern",
  description: "Trades only during high-conviction hours (market opens)",
  category: "momentum",
  execute: (ctx: StrategyContext): StrategyDecision => {
    const thresholds = strategyConfig.time_pattern;

    // Time check - avoid last 30 seconds
    if (ctx.timeRemaining < (thresholds.minTimeRemaining ?? 30000)) {
      const reason = "Too close to closure";
      logDecision(reason, { timeRemaining: ctx.timeRemaining, threshold: thresholds.minTimeRemaining ?? 30000 });
      return noTrade(reason);
    }

    const hour = ctx.hourOfDay ?? new Date().getUTCHours();
    const day = ctx.dayOfWeek ?? new Date().getUTCDay();

    // Check if weekend
    const isWeekend = day === 0 || day === 6;
    if (isWeekend && thresholds.avoidWeekend !== false) {
      const reason = `Weekend - low volume (day ${day})`;
      logDecision(reason, { day, isWeekend });
      return noTrade(reason);
    }

    // Check if avoid hour
    const isAvoidHour = AVOID_HOURS.some(([start, end]) => hour >= start && hour < end);
    if (isAvoidHour) {
      const reason = `Avoid hour: ${hour}:00 UTC`;
      logDecision(reason, { hour, avoidHours: AVOID_HOURS });
      return noTrade(reason);
    }

    // Check if high-conviction hour
    const isHighConviction = HIGH_CONVICTION_HOURS.some(([start, end]) => hour >= start && hour < end);

    // Need BTC delta for direction
    if (!ctx.btcPrice) {
      const reason = "No BTC price";
      logDecision(reason);
      return noTrade(reason);
    }

    const windowOpen = ctx.btcWindowOpen || ctx.btcPrice;
    const deltaPct = windowOpen > 0 ? ((ctx.btcPrice - windowOpen) / windowOpen) * 100 : 0;

    // Track near misses - small delta during good hours
    const minDelta = thresholds.minDelta ?? 0.02;

    // Only trade during high-conviction hours
    if (!isHighConviction) {
      const reason = `Normal hour: ${hour}:00 UTC - no edge`;
      logDecision(reason, {
        hour,
        isHighConviction,
        highConvictionHours: HIGH_CONVICTION_HOURS,
        nearMiss: Math.abs(deltaPct) >= minDelta // Would have traded if delta was good
      });
      return noTrade(reason);
    }

    // We're in a high-conviction hour!
    // Still need minimum delta for direction
    if (Math.abs(deltaPct) < minDelta) {
      const reason = `Delta too small: ${deltaPct.toFixed(4)}%`;
      logDecision(reason, {
        hour,
        deltaPct,
        minDelta,
        isHighConviction,
        nearMiss: true // Good hour, bad delta
      });
      return noTrade(reason);
    }

    // Trade executed - log success
    const action = deltaPct > 0 ? "YES" : "NO";
    // Higher confidence during high-conviction hours
    const hourBoost = 0.10;
    const confidence = Math.min(0.82, 0.55 + Math.abs(deltaPct) * 3 + hourBoost);

    logDecision(`TRADE: ${action}`, {
      hour,
      day,
      deltaPct,
      isHighConviction,
      confidence,
      action
    });

    return trade(
      action,
      confidence,
      `Time Pattern: ${action} @ ${hour}:00 UTC | delta=${deltaPct.toFixed(3)}%`,
      { hour, day, deltaPct, isHighConviction }
    );
  },
};

export default timePatternStrategy;
// Strategy Base Functions - Shared helpers for all strategies
// Reduces code duplication and ensures consistent behavior

import type { StrategyThresholds, StrategyDecision } from "./types";
import type { Outcome } from "../../types";

/**
 * Check if price is within acceptable range
 * Returns true if price is between minPrice and maxPrice (inclusive)
 */
export function checkPriceLimits(
  price: number,
  thresholds: StrategyThresholds
): boolean {
  const min = thresholds.minPrice ?? 0.30;
  const max = thresholds.maxPrice ?? 0.70;
  return price >= min && price <= max;
}

/**
 * Check if odds are within acceptable range for the strategy
 * CRITICAL: Avoid 40-60¢ "fair value" zone which is a loss leader
 */
export function checkOddsRange(
  odds: number,
  thresholds: StrategyThresholds
): { valid: boolean; reason?: string } {
  // Avoid middle zone (40-60¢) if configured
  if (thresholds.avoidMiddle !== false) {  // Default to true
    if (odds >= 0.40 && odds <= 0.60) {
      return { valid: false, reason: `Odds in loss zone (${(odds * 100).toFixed(0)}¢)` };
    }
  }

  // Check min/max odds
  const minOdds = thresholds.minOdds ?? 0;
  const maxOdds = thresholds.maxOdds ?? 1;

  if (odds < minOdds) {
    return { valid: false, reason: `Odds too low (${(odds * 100).toFixed(0)}¢ < ${(minOdds * 100).toFixed(0)}¢)` };
  }
  if (odds > maxOdds) {
    return { valid: false, reason: `Odds too high (${(odds * 100).toFixed(0)}¢ > ${(maxOdds * 100).toFixed(0)}¢)` };
  }

  return { valid: true };
}

/**
 * Check if time remaining is within acceptable range
 * Returns true if time is between min and max time remaining
 */
export function checkTimeRemaining(
  timeRemaining: number,
  thresholds: StrategyThresholds
): boolean {
  const min = thresholds.minTimeRemaining ?? 0;
  const max = thresholds.maxTimeRemaining ?? 300000;
  return timeRemaining >= min && timeRemaining <= max;
}

/**
 * Check if BTC delta meets minimum threshold
 * Can check for specific direction (UP/DOWN) or absolute value
 */
export function checkDelta(
  deltaPct: number,
  thresholds: StrategyThresholds,
  direction?: "UP" | "DOWN"
): boolean {
  const minDelta = thresholds.minDelta ?? 0.05;
  if (direction === "UP") return deltaPct > minDelta;
  if (direction === "DOWN") return deltaPct < -minDelta;
  return Math.abs(deltaPct) > minDelta;
}

/**
 * Create a no-trade decision
 * Use when strategy decides not to trade
 */
export function noTrade(reason: string): StrategyDecision {
  return { action: null, confidence: 0, reason };
}

/**
 * Create a trade decision
 * Use when strategy decides to trade YES or NO
 */
export function trade(
  action: Outcome,
  confidence: number,
  reason: string,
  details?: Record<string, unknown>
): StrategyDecision {
  return { action, confidence, reason, details };
}

/**
 * Calculate BTC delta percentage
 * Returns the % change from window open price
 * Positive = UP, Negative = DOWN
 */
export function calculateDelta(
  btcPrice: number,
  btcWindowOpen: number
): number {
  if (!btcWindowOpen || btcWindowOpen <= 0) return 0;
  return ((btcPrice - btcWindowOpen) / btcWindowOpen) * 100;
}

/**
 * Calculate edge for arbitrage strategies
 * Edge = fair probability - market price
 * Positive edge = market undervalues outcome
 */
export function calculateEdge(
  fairProb: number,
  marketPrice: number
): number {
  return fairProb - marketPrice;
}

/**
 * Calculate fair probability from delta using tanh
 * Maps delta to probability range [0.03, 0.97]
 */
export function calculateFairProb(deltaPct: number): number {
  return Math.min(0.97, Math.max(0.03, 0.5 + Math.tanh(deltaPct / 0.05) * 0.45));
}

/**
 * Check if binance signal is fresh (not expired)
 */
export function isSignalFresh(
  signalTimestamp: number,
  maxAge: number = 8000
): boolean {
  return Date.now() - signalTimestamp < maxAge;
}

/**
 * Check if signal aligns with delta direction
 * Returns false for NEUTRAL signals
 */
export function signalAlignsWithDelta(
  signalType: "UP" | "DOWN" | "NEUTRAL",
  deltaPct: number
): boolean {
  if (signalType === "NEUTRAL") return false;
  return (signalType === "UP" && deltaPct > 0) ||
         (signalType === "DOWN" && deltaPct < 0);
}
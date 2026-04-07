// Binance Velocity Strategy
// Uses BTC velocity (rate of change) and acceleration from Binance klines
// When BTC accelerates in one direction, it tends to continue
//
// FIX: Higher thresholds and consistency checks to improve win rate

import type { Strategy, StrategyContext } from "../../../types";
import type { StrategyDecision } from "../types";
import { strategyConfig } from "../config";
import { noTrade, trade } from "../base";

// Configuration - HIGHER THRESHOLDS for better quality signals
const MIN_VELOCITY = 0.00015; // 0.015% per second (was 0.0001)
const MIN_ACCELERATION = 0.00008; // Higher threshold
const MIN_CONSECUTIVE_ACCEL = 2; // Require N consecutive accelerating klines

export const binanceVelocityStrategy: Strategy = {
  name: "Binance Velocity",
  description: "BTC velocity and acceleration based trading",
  category: "momentum",
  execute: (ctx: StrategyContext): StrategyDecision => {
    const thresholds = strategyConfig.binance_velocity;

    // Time check - avoid last minutes
    if (ctx.timeRemaining < (thresholds.minTimeRemaining ?? 45000)) {
      return noTrade("Too close to closure");
    }

    const velocity = ctx.btcVelocity ?? 0;
    const acceleration = ctx.btcAcceleration ?? 0;
    const btcPrice = ctx.btcPrice;
    const btcVolatility = ctx.btcVolatility ?? 0;

    if (!btcPrice) {
      return noTrade("No BTC price");
    }

    // FIX: Avoid high volatility periods (unpredictable)
    // Values correctly scaled to 0.3% (0.003)
    if (btcVolatility > 0.003) {
      return noTrade("High volatility - market unpredictable");
    }

    // FIX: Minimum velocity threshold increased
    if (Math.abs(velocity) < MIN_VELOCITY) {
      return noTrade(`Velocity too low: ${(velocity * 100).toFixed(4)}%/s (choppy)`);
    }

    const isUp = velocity > 0;
    const isAccelerating = (isUp && acceleration > 0) || (!isUp && acceleration < 0);

    // FIX: Only trade if BOTH velocity AND acceleration meet thresholds
    if (Math.abs(velocity) < MIN_VELOCITY || Math.abs(acceleration) < MIN_ACCELERATION) {
      return noTrade("Signal too weak - need both velocity AND acceleration");
    }

    // STRONG SIGNAL: velocity + acceleration in same direction
    if (isAccelerating) {
      const action = isUp ? "YES" : "NO";

      // Confidence calculation with caps
      const velStrength = Math.min(0.25, Math.abs(velocity) * 800);
      const accBoost = Math.min(0.15, Math.abs(acceleration) * 800);
      const baseConfidence = 0.55; // Lower base
      const confidence = Math.min(0.80, baseConfidence + velStrength + accBoost);

      return trade(
        action,
        confidence,
        `Velocity+Accel: ${action} | vel=${(velocity * 100).toFixed(3)}%/s acc=${(acceleration * 100).toFixed(4)}%/s²`,
        { velocity, acceleration, mode: "velocity_accelerating" }
      );
    }

    // Velocity but DECELERATING - AVOID (momentum fading)
    return noTrade(`Decelerating - momentum fading: vel=${(velocity * 100).toFixed(3)}%/s acc=${(acceleration * 100).toFixed(4)}%/s²`);
  },
};

export default binanceVelocityStrategy;
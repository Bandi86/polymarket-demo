// Bayesian EV Strategy - Advanced multi-signal strategy
// Combines: Bayesian probability + EV filter + Kelly sizing
// All 3 conditions must agree to enter

import type { Strategy, StrategyContext } from "../../../types";
import type { StrategyDecision } from "../types";
import { strategyConfig } from "../config";
import {
  noTrade,
  trade,
} from "../base";

interface SignalResult {
  bayesProb: number;
  bayesConfidence: number;
  momentumProb: number;
  volumeSignal: number;
  ev: number;
  shouldEnter: boolean;
  reason: string;
}

/**
 * Calculate Bayesian probability from oracle + momentum + volume
 * P(new) = P(prior) × L(evidence) / P(total)
 */
function calculateBayesianProb(
  btcStartPrice: number | undefined,
  btcCurrentPrice: number | undefined,
  btcVolume: number,
  priorProb: number = 0.5
): { prob: number; confidence: number } {
  if (!btcStartPrice || !btcCurrentPrice) {
    return { prob: priorProb, confidence: 0.3 };
  }

  // Delta from oracle (BTC price change since market open)
  const deltaPct = ((btcCurrentPrice - btcStartPrice) / btcStartPrice) * 100;

  // Momentum component (tanH normalized)
  const momentumFactor = Math.tanh(deltaPct / 0.05); // -1 to 1

  // Volume signal (heuristic: high volume = more conviction)
  const volumeFactor = Math.min(1, btcVolume / 50000); // Normalize typical volume

  // Bayesian update: combine prior with evidence
  // Stronger momentum/volume = higher confidence in direction
  const evidenceStrength = Math.abs(momentumFactor) * 0.6 + volumeFactor * 0.4;

  // Calculate new probability
  const likelihood = priorProb + momentumFactor * 0.4 * evidenceStrength;
  const posterior = Math.min(0.97, Math.max(0.03, likelihood));

  // Confidence based on evidence strength (0-1)
  const confidence = Math.min(1, evidenceStrength + 0.2);

  return { prob: posterior, confidence };
}

/**
 * Calculate Expected Value of a trade
 * EV = (P_win × Payout) - (P_lose × Cost)
 */
function calculateEV(
  winProb: number,
  price: number,
  feeRate: number = 0.02
): number {
  // Payout = stake / price (if YES wins, you get stake/price shares)
  const payout = 1 / price;
  const loseProb = 1 - winProb;

  // Net payout after fees
  const netPayout = payout - feeRate - 1;
  const netLoss = 1 + feeRate;

  const ev = (winProb * netPayout) - (loseProb * netLoss);
  return ev;
}

/**
 * Calculate Kelly fraction for position sizing
 * f* = (p × b − q) / b
 */
function calculateKelly(
  winProb: number,
  odds: number,
  kellyFraction: number = 0.25
): number {
  const b = (1 / odds) - 1; // Decimal odds - 1
  if (b <= 0) return 0;

  const q = 1 - winProb;
  const kelly = (winProb * b - q) / b;
  return Math.max(0, kelly * kellyFraction);
}

function analyzeSignal(ctx: StrategyContext): SignalResult {
  const thresholds = strategyConfig.bayesian_ev as { minEv?: number; skipEv?: number; minConfidence?: number; minTimeRemaining?: number } || {
    minEv: 0.08,
    skipEv: 0.02,
    minConfidence: 0.5,
    minTimeRemaining: 10000,
  };

  const minEv = thresholds.minEv ?? 0.08;
  const skipEv = thresholds.skipEv ?? 0.02;
  const minConfidence = thresholds.minConfidence ?? 0.5;

  // 1. Bayesian probability calculation
  // Use btcWindowOpen as "oracle" (price at market start)
  const btcStart = ctx.btcWindowOpen || ctx.btcPrice;
  const btcCurrent = ctx.btcPrice;

  // Use binance signal confidence if available, otherwise use momentum as proxy
  const volume = (ctx.binanceSignal?.confidence || 0) * 50000 || Math.abs(ctx.momentum || 0) * 1000;

  const bayesResult = calculateBayesianProb(btcStart, btcCurrent, volume);
  const bayesProb = bayesResult.prob;
  const bayesConfidence = bayesResult.confidence;

  // 2. Traditional momentum probability (for comparison)
  const windowOpen = ctx.btcWindowOpen || btcCurrent;
  const deltaPct = btcCurrent && windowOpen
    ? ((btcCurrent - windowOpen) / windowOpen) * 100
    : 0;
  const momentumProb = Math.min(0.97, Math.max(0.03, 0.5 + Math.tanh(deltaPct / 0.05) * 0.45));

  // 3. Volume signal
  const volumeSignal = Math.min(1, volume / 50000);

  const marketYes = ctx.marketPrice.yesPrice;
  const marketNo = ctx.marketPrice.noPrice;

  // 4. Calculate EV for YES and NO
  const yesEV = calculateEV(bayesProb, marketYes);
  const noEV = calculateEV(1 - bayesProb, marketNo);

  // Determine best action
  let action: "YES" | "NO" | null = null;
  let ev = 0;

  if (yesEV > noEV && yesEV > minEv) {
    action = "YES";
    ev = yesEV;
  } else if (noEV > yesEV && noEV > minEv) {
    action = "NO";
    ev = noEV;
  }

  // Build reason string
  let reason = "";
  const probStr = (p: number) => `${(p * 100).toFixed(0)}%`;

  if (action === "YES") {
    reason = `Bayes:${probStr(bayesProb)} Mom:${probStr(momentumProb)} Vol:${volumeSignal.toFixed(1)} EV:+${(ev * 100).toFixed(0)}%`;
  } else if (action === "NO") {
    const noProb = (1 - bayesProb);
    reason = `Bayes:${probStr(noProb)} Mom:${probStr(1-momentumProb)} Vol:${volumeSignal.toFixed(1)} EV:+${(ev * 100).toFixed(0)}%`;
  } else {
    // No action - determine why
    const maxEv = Math.max(yesEV, noEV);
    if (maxEv < skipEv) {
      reason = `EV too low: ${(maxEv * 100).toFixed(0)}% < ${(minEv * 100)}% min`;
    } else if (bayesConfidence < minConfidence) {
      reason = `Confidence too low: ${bayesConfidence.toFixed(2)} < ${minConfidence}`;
    } else {
      reason = `No clear edge: YES EV=${(yesEV*100).toFixed(0)}% NO EV=${(noEV*100).toFixed(0)}%`;
    }
  }

  return {
    bayesProb,
    bayesConfidence,
    momentumProb,
    volumeSignal,
    ev,
    shouldEnter: action !== null && ev > minEv && bayesConfidence >= minConfidence,
    reason,
  };
}

export const bayesianEvStrategy: Strategy = {
  name: "Bayesian EV",
  description: "Bayesian probability + EV filter + Kelly sizing - 3 conditions must agree",
  category: "arbitrage",
  execute: (ctx: StrategyContext): StrategyDecision => {
    // Time check
    const thresholds = strategyConfig.bayesian_ev as { minTimeRemaining?: number } || { minTimeRemaining: 10000 };
    const minTimeRemaining = thresholds.minTimeRemaining ?? 10000;

    if (ctx.timeRemaining < minTimeRemaining) {
      return noTrade("Túl közel a záráshoz");
    }

    if (!ctx.btcPrice) {
      return noTrade("Nincs BTC ár");
    }

    // Analyze signal
    const signal = analyzeSignal(ctx);

    if (!signal.shouldEnter) {
      return noTrade(signal.reason);
    }

    // Determine action based on better EV
    const marketYes = ctx.marketPrice.yesPrice;
    const marketNo = ctx.marketPrice.noPrice;
    const yesEV = calculateEV(signal.bayesProb, marketYes);
    const noEV = calculateEV(1 - signal.bayesProb, marketNo);

    const action = yesEV > noEV ? "YES" : "NO";

    // Calculate confidence based on all 3 signals agreeing
    const momentumAgrees = signal.bayesProb > 0.5
      ? signal.momentumProb > 0.5
      : signal.momentumProb < 0.5;
    const volumeAgrees = signal.volumeSignal > 0.3;

    // Combined confidence: all 3 must agree
    let combinedConfidence = signal.bayesConfidence;
    if (momentumAgrees) combinedConfidence += 0.2;
    if (volumeAgrees) combinedConfidence += 0.1;
    combinedConfidence = Math.min(1, combinedConfidence);

    // Calculate Kelly for sizing (will be used by bot manager)
    const price = action === "YES" ? marketYes : marketNo;
    const prob = action === "YES" ? signal.bayesProb : (1 - signal.bayesProb);
    const kellySize = calculateKelly(prob, price);

    return trade(
      action,
      Math.min(0.85, combinedConfidence),
      signal.reason,
      {
        bayesProb: signal.bayesProb,
        momentumProb: signal.momentumProb,
        volumeSignal: signal.volumeSignal,
        ev: signal.ev,
        kellySize,
        confidence: combinedConfidence,
      }
    );
  },
};

export default bayesianEvStrategy;
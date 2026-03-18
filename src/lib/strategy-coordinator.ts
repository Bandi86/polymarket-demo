// Strategy Coordinator - Prevents conflicting trades between bots
// Coordinates positions across all active bots to avoid:
// - Opposite positions on the same market
// - Over-exposure to a single outcome
// - Redundant trades from similar strategies

import type { Outcome, StrategyType } from "../types";

export interface PendingDecision {
  botId: string;
  botName: string;
  strategy: StrategyType;
  action: Outcome;
  confidence: number;
  betSize: number;
  timestamp: number;
}

export interface CoordinationResult {
  allowed: boolean;
  reason: string;
  adjustedBetSize?: number;
  warnings?: string[];
}

export interface CoordinatorConfig {
  // Maximum total exposure to a single outcome (fraction of total portfolio)
  maxOutcomeExposure: number;
  // How to handle conflicts: "strict" (block), "advisory" (warn), "first_wins" (allow first)
  conflictMode: "strict" | "advisory" | "first_wins";
  // Maximum number of bots that can take the same position
  maxBotsSameOutcome: number;
  // Strategies that are considered "compatible" (can take same position)
  compatibleStrategies: Record<StrategyType, StrategyType[]>;
}

const DEFAULT_CONFIG: CoordinatorConfig = {
  maxOutcomeExposure: 0.4, // 40% max exposure to one outcome
  conflictMode: "strict",
  maxBotsSameOutcome: 3,
  compatibleStrategies: {
    momentum_chaser: ["whale_follower", "ta_signal_engine"],
    mean_reversion_sniper: ["market_maker"],
    sum_to_one_arb: [], // Always takes both sides
    whale_follower: ["momentum_chaser", "ta_signal_engine"],
    ta_signal_engine: ["momentum_chaser", "whale_follower"],
    market_maker: ["mean_reversion_sniper"],
  },
};

class StrategyCoordinator {
  private pendingDecisions: Map<string, PendingDecision> = new Map();
  private recentExecutions: Map<string, { outcome: Outcome; timestamp: number }> = new Map();
  private config: CoordinatorConfig;

  // Track exposure per market (marketId -> { yes: amount, no: amount })
  private marketExposure: Map<string, { yes: number; no: number }> = new Map();

  constructor(config: Partial<CoordinatorConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Register a pending decision before execution.
   * Returns coordination result indicating if the trade should proceed.
   */
  registerDecision(
    marketId: string,
    decision: Omit<PendingDecision, "timestamp">,
    totalPortfolioBalance: number
  ): CoordinationResult {
    const pending: PendingDecision = {
      ...decision,
      timestamp: Date.now(),
    };

    const warnings: string[] = [];

    // Check for conflicting positions from other bots
    const conflictCheck = this.checkForConflicts(marketId, pending);
    if (!conflictCheck.allowed) {
      return conflictCheck;
    }
    if (conflictCheck.warnings) {
      warnings.push(...conflictCheck.warnings);
    }

    // Check for over-exposure to this outcome
    const exposureCheck = this.checkExposure(marketId, pending, totalPortfolioBalance);
    if (!exposureCheck.allowed) {
      return exposureCheck;
    }
    if (exposureCheck.adjustedBetSize !== undefined) {
      pending.betSize = exposureCheck.adjustedBetSize;
      warnings.push(`Bet size reduced to $${exposureCheck.adjustedBetSize.toFixed(2)} to limit exposure`);
    }

    // Check for too many bots on the same outcome
    const capacityCheck = this.checkOutcomeCapacity(marketId, pending);
    if (!capacityCheck.allowed) {
      return capacityCheck;
    }

    // Register the pending decision
    this.pendingDecisions.set(`${marketId}-${pending.botId}`, pending);

    // Clean up old decisions (older than 5 seconds)
    this.cleanupStaleDecisions();

    return {
      allowed: true,
      reason: "Trade approved",
      adjustedBetSize: pending.betSize !== decision.betSize ? pending.betSize : undefined,
      warnings: warnings.length > 0 ? warnings : undefined,
    };
  }

  /**
   * Confirm a trade was executed (called after successful placement).
   */
  confirmExecution(marketId: string, botId: string, outcome: Outcome, amount: number): void {
    const key = `${marketId}-${botId}`;

    // Remove from pending
    this.pendingDecisions.delete(key);

    // Record execution
    this.recentExecutions.set(key, { outcome, timestamp: Date.now() });

    // Update exposure tracking
    const exposure = this.marketExposure.get(marketId) || { yes: 0, no: 0 };
    if (outcome === "YES") {
      exposure.yes += amount;
    } else {
      exposure.no += amount;
    }
    this.marketExposure.set(marketId, exposure);
  }

  /**
   * Clear pending decision if trade failed.
   */
  cancelDecision(marketId: string, botId: string): void {
    this.pendingDecisions.delete(`${marketId}-${botId}`);
  }

  /**
   * Reset state for a new market.
   */
  resetMarket(marketId: string): void {
    // Clear all pending and executions for this market
    for (const key of this.pendingDecisions.keys()) {
      if (key.startsWith(marketId)) {
        this.pendingDecisions.delete(key);
      }
    }
    for (const key of this.recentExecutions.keys()) {
      if (key.startsWith(marketId)) {
        this.recentExecutions.delete(key);
      }
    }
    this.marketExposure.delete(marketId);
  }

  /**
   * Get current exposure for a market.
   */
  getMarketExposure(marketId: string): { yes: number; no: number } {
    return this.marketExposure.get(marketId) || { yes: 0, no: 0 };
  }

  /**
   * Get all pending decisions for a market.
   */
  getPendingDecisions(marketId: string): PendingDecision[] {
    const decisions: PendingDecision[] = [];
    for (const [key, decision] of this.pendingDecisions) {
      if (key.startsWith(marketId)) {
        decisions.push(decision);
      }
    }
    return decisions;
  }

  private checkForConflicts(marketId: string, decision: PendingDecision): CoordinationResult {
    const oppositeOutcome: Outcome = decision.action === "YES" ? "NO" : "YES";
    const warnings: string[] = [];

    // Check pending decisions from other bots
    for (const [key, pending] of this.pendingDecisions) {
      if (!key.startsWith(marketId)) continue;
      if (pending.botId === decision.botId) continue;

      // Check for direct conflict (opposite position)
      if (pending.action === oppositeOutcome) {
        const conflictMsg = `Conflict: ${pending.botName} (${pending.strategy}) already pending ${oppositeOutcome}`;

        if (this.config.conflictMode === "strict") {
          return {
            allowed: false,
            reason: conflictMsg,
          };
        } else if (this.config.conflictMode === "advisory") {
          warnings.push(`Warning: ${conflictMsg}`);
        }
        // "first_wins" mode allows the trade to proceed
      }

      // Check for incompatible strategies on same outcome
      if (pending.action === decision.action) {
        const compatible = this.config.compatibleStrategies[decision.strategy] || [];
        if (!compatible.includes(pending.strategy)) {
          const warnMsg = `Note: Similar strategies (${decision.strategy}, ${pending.strategy}) on same outcome`;
          warnings.push(warnMsg);
        }
      }
    }

    // Check recent executions (within last 2 seconds)
    const now = Date.now();
    for (const [key, exec] of this.recentExecutions) {
      if (!key.startsWith(marketId)) continue;
      if (now - exec.timestamp > 2000) continue;

      const botId = key.replace(`${marketId}-`, "");
      if (botId === decision.botId) continue;

      if (exec.outcome === oppositeOutcome) {
        const conflictMsg = `Conflict: Bot recently executed ${oppositeOutcome}`;

        if (this.config.conflictMode === "strict") {
          return {
            allowed: false,
            reason: conflictMsg,
          };
        } else if (this.config.conflictMode === "advisory") {
          warnings.push(`Warning: ${conflictMsg}`);
        }
      }
    }

    return {
      allowed: true,
      reason: warnings.length > 0 ? "Conflicts detected but allowed" : "No conflicts",
      warnings: warnings.length > 0 ? warnings : undefined,
    };
  }

  private checkExposure(
    marketId: string,
    decision: PendingDecision,
    totalBalance: number
  ): CoordinationResult {
    const exposure = this.getMarketExposure(marketId);
    const pendingDecisions = this.getPendingDecisions(marketId);

    // Add pending decisions to exposure
    for (const pending of pendingDecisions) {
      if (pending.botId === decision.botId) continue;
      if (pending.action === "YES") {
        exposure.yes += pending.betSize;
      } else {
        exposure.no += pending.betSize;
      }
    }

    // Calculate new exposure after this trade
    const outcomeKey = decision.action.toLowerCase() as "yes" | "no";
    const newExposure = exposure[outcomeKey] + decision.betSize;
    const exposureFraction = totalBalance > 0 ? newExposure / totalBalance : 0;

    if (exposureFraction > this.config.maxOutcomeExposure) {
      // Calculate maximum allowed bet size
      const maxAllowed = totalBalance * this.config.maxOutcomeExposure - exposure[outcomeKey];

      if (maxAllowed < 0.1) {
        return {
          allowed: false,
          reason: `Maximum exposure reached for ${decision.action} (${(exposureFraction * 100).toFixed(1)}% > ${this.config.maxOutcomeExposure * 100}%)`,
        };
      }

      return {
        allowed: true,
        reason: "Bet size reduced to limit exposure",
        adjustedBetSize: Math.max(0.1, maxAllowed),
      };
    }

    return {
      allowed: true,
      reason: "Exposure within limits",
    };
  }

  private checkOutcomeCapacity(marketId: string, decision: PendingDecision): CoordinationResult {
    const pendingDecisions = this.getPendingDecisions(marketId);
    let sameOutcomeCount = 0;

    // Count other bots with same outcome
    for (const pending of pendingDecisions) {
      if (pending.botId !== decision.botId && pending.action === decision.action) {
        sameOutcomeCount++;
      }
    }

    // Count recent executions with same outcome
    const now = Date.now();
    for (const [key, exec] of this.recentExecutions) {
      if (!key.startsWith(marketId)) continue;
      if (now - exec.timestamp > 5000) continue;
      if (exec.outcome === decision.action) {
        sameOutcomeCount++;
      }
    }

    if (sameOutcomeCount >= this.config.maxBotsSameOutcome) {
      return {
        allowed: false,
        reason: `Maximum bots (${this.config.maxBotsSameOutcome}) already positioned on ${decision.action}`,
      };
    }

    return {
      allowed: true,
      reason: "Outcome capacity available",
    };
  }

  private cleanupStaleDecisions(): void {
    const now = Date.now();
    const staleThreshold = 5000; // 5 seconds

    for (const [key, decision] of this.pendingDecisions) {
      if (now - decision.timestamp > staleThreshold) {
        this.pendingDecisions.delete(key);
      }
    }

    for (const [key, exec] of this.recentExecutions) {
      if (now - exec.timestamp > staleThreshold) {
        this.recentExecutions.delete(key);
      }
    }
  }

  /**
   * Update coordinator configuration.
   */
  updateConfig(config: Partial<CoordinatorConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Get current configuration.
   */
  getConfig(): CoordinatorConfig {
    return { ...this.config };
  }
}

// Singleton instance
export const strategyCoordinator = new StrategyCoordinator();
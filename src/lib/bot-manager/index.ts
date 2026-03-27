// Bot Manager Module
// Extracted components for managing trading bots

export { BotLogger, type BotLog } from "./bot-logger";
export { CompetitionManager, type CompetitionState, type LeaderboardEntry, type CompetitionConfig } from "./competition-manager";
export {
  buildStrategyContext,
  calculateBetSize,
  executeStrategy,
  executeLiveTrade,
  checkRiskConstraints,
  checkCoordination,
  confirmExecution,
  cancelDecision,
  type MarketInfo,
  type TradeDecision,
  type StrategyExecutionResult,
} from "./strategy-executor";
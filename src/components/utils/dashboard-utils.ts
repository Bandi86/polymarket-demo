// Formatting and calculation utilities for TopDashboard

/**
 * Format remaining time in mm:ss format
 */
export function formatTimeRemaining(ms: number): string {
  if (ms <= 0) return "0:00";
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

/**
 * Format duration in milliseconds to human readable format
 */
export function formatDurationMs(ms: number): string {
  if (ms <= 0) return "0s";
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  if (minutes > 0) {
    return `${minutes}m ${seconds}s`;
  }
  return `${seconds}s`;
}

/**
 * Calculate market progress percentage (0-100)
 */
export function calculateMarketProgress(
  startTime: number,
  endTime: number
): number {
  const now = Date.now();
  const total = endTime - startTime;
  const elapsed = now - startTime;
  return Math.min(100, Math.max(0, (elapsed / total) * 100));
}

/**
 * Calculate risk level based on bot performance and positions
 */
export function calculateRiskLevel(
  bots: Array<{ stats: { winRate: number; pnl: number }; portfolio: { balance: number } }>,
  positionCount: number
): { level: "low" | "medium" | "high"; color: string; label: string } {
  // Calculate aggregate metrics
  const avgWinRate =
    bots.length > 0
      ? bots.reduce((sum, b) => sum + b.stats.winRate, 0) / bots.length
      : 0;

  const totalPnL = bots.reduce((sum, b) => sum + b.stats.pnl, 0);
  const hasHighLoss = totalPnL < -10;
  const hasManyPositions = positionCount > 5;

  if (avgWinRate < 0.4 || hasHighLoss) {
    return { level: "high", color: "text-red-400", label: "High Risk" };
  }
  if (avgWinRate < 0.55 || hasManyPositions) {
    return { level: "medium", color: "text-yellow-400", label: "Medium Risk" };
  }
  return { level: "low", color: "text-green-400", label: "Low Risk" };
}
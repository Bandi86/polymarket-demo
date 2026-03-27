// Debug logging for strategies
const DEBUG_STRATEGIES = true;

export function debugLog(strategy: string, message: string, data?: Record<string, unknown>) {
  if (DEBUG_STRATEGIES) {
    const timestamp = new Date().toISOString().split('T')[1].slice(0, 12);
    console.log(`[${timestamp}][${strategy}] ${message}`, data ? JSON.stringify(data) : '');
  }
}

// Common constants used across strategies
export const TRADING_CONSTANTS = {
  MIN_ENTRY_ODDS: 0.40,  // 40¢ minimum - below this has ~0% win rate
  MAX_ENTRY_ODDS: 0.80,  // 80¢ maximum - above this is overpriced
  MIN_BUY_PRICE_SCALP: 0.40,
  MAX_BUY_PRICE_SCALP: 0.65, // 65¢ max for scalps due to 2% fee
  LAST_SECONDS_WINDOW: 20000, // 20 seconds for T-10 sniper
  SIGNAL_MAX_AGE: 8000, // 8 seconds max signal age
  EARLY_WINDOW_CUTOFF: 270000, // First 30 seconds - no trading
  FINAL_CUTOFF: 3000, // Last 3 seconds - no trading
};
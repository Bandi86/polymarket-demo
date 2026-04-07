// Strategy Registry - Exports all split strategies

// NEW STRATEGIES (Option A - Change the Game)
export { volatilityBreakoutStrategy } from "./volatility-breakout";
export { ultraLowEntryStrategy } from "./ultra-low-entry";
export { trendPullbackStrategy } from "./trend-pullback";
export { priceReversionStrategy } from "./price-reversion";
export { binanceVelocityStrategy } from "./binance-velocity";
export { sniperValueStrategy } from "./sniper-value";
export { oddsSwingStrategy } from "./odds-swing";

// LEGACY STRATEGIES
export { windowDeltaStrategy } from "./window-delta";
export { fairValueStrategy } from "./fair-value";
export { oracleLagStrategy } from "./oracle-lag";
export { t10SniperStrategy } from "./t10-sniper";
export { monteCarloStrategy } from "./monte-carlo";
export { momentumStrategy } from "./momentum";
export { smartTrendStrategy } from "./smart-trend";
export { contrarianStrategy } from "./contrarian";
export { arbitrageStrategy } from "./arbitrage";
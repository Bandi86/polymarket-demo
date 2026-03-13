// Design Tokens - Centralized styling constants
// Use these for consistent colors, typography, and animations across the app

export const colors = {
  // Semantic colors
  success: 'hsl(142 71% 45%)',
  danger: 'hsl(0 84% 60%)',
  warning: 'hsl(38 92% 50%)',
  info: 'hsl(217 91% 60%)',

  // Strategy colors (each bot gets unique color)
  strategy: {
    momentum_chaser: 'hsl(45 93% 47%)',      // Gold
    mean_reversion_sniper: 'hsl(280 65% 60%)', // Purple
    sum_to_one_arb: 'hsl(170 75% 41%)',      // Teal
    whale_follower: 'hsl(330 80% 55%)',      // Pink
    ta_signal_engine: 'hsl(217 91% 60%)',    // Blue
    market_maker: 'hsl(142 71% 45%)',        // Green
  },

  // Market colors
  up: 'hsl(142 71% 45%)',
  down: 'hsl(0 84% 60%)',
  neutral: 'hsl(215 20% 65%)',
} as const;

export const typography = {
  fontFamily: {
    display: 'Inter, system-ui, sans-serif',
    mono: 'JetBrains Mono, ui-monospace, monospace',
  },
  fontSize: {
    xs: '0.75rem',
    sm: '0.875rem',
    base: '1rem',
    lg: '1.125rem',
    xl: '1.25rem',
    '2xl': '1.5rem',
    '3xl': '1.875rem',
  },
} as const;

export const animation = {
  duration: {
    fast: 150,
    normal: 300,
    slow: 500,
  },
  easing: {
    default: 'cubic-bezier(0.4, 0, 0.2, 1)',
    spring: { type: 'spring', stiffness: 300, damping: 30 },
  },
} as const;

export const strategyNames: Record<string, string> = {
  momentum_chaser: 'Momentum Chaser',
  mean_reversion_sniper: 'Mean Reversion Sniper',
  sum_to_one_arb: 'Sum-to-One Arbitrage',
  whale_follower: 'Whale Follower',
  ta_signal_engine: 'TA Signal Engine',
  market_maker: 'Market Maker',
};

/**
 * Get the color for a strategy by its type
 */
export function getStrategyColor(strategy: string): string {
  return colors.strategy[strategy as keyof typeof colors.strategy] || colors.neutral;
}

/**
 * Get the display name for a strategy
 */
export function getStrategyName(strategy: string): string {
  return strategyNames[strategy] || strategy;
}
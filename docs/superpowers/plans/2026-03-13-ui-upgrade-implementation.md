# Polymarket Trading Simulator UI Upgrade Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Modernize the UI with a consistent design system, add animated visualizations, enhance the bot dashboard, and implement strategy analytics.

**Architecture:** Extend existing Tailwind v4 + Framer Motion stack with design tokens, reusable chart components, and enhanced dashboard layouts. Maintain React 19 patterns and SSE-based real-time updates.

**Tech Stack:** React 19, Tailwind CSS v4, Framer Motion, Recharts, Vitest, Bun

---

## File Structure

### New Files to Create

```
src/
├── lib/
│   ├── design-tokens.ts          # Color, spacing, typography constants
│   └── cn.ts                      # Class name utility (if not exists)
├── components/
│   ├── charts/
│   │   ├── Sparkline.tsx          # Mini inline chart
│   │   ├── EquityCurve.tsx        # Portfolio value over time
│   │   ├── StrategyHeatmap.tsx    # Performance by conditions
│   │   └── GaugeChart.tsx         # Semi-circular gauge
│   ├── strategy/
│   │   ├── StrategyCard.tsx       # Individual strategy display
│   │   └── StrategyRecommendation.tsx # Market phase recommendation
│   └── ui/
│       ├── ProgressRing.tsx       # Circular progress indicator
│       └── AnimatedCounter.tsx    # Smooth number transitions
└── test/
    ├── sparkline.test.tsx
    ├── equity-curve.test.tsx
    └── strategy-card.test.tsx
```

### Files to Modify

```
src/styles/globals.css              # Add design tokens
src/components/MarketCard.tsx       # Enhance with animations
src/components/TradingPanel.tsx     # Redesign UX
src/components/Header.tsx           # Add live price ticker
src/components/BotStatusCard.tsx    # Add sparkline, strategy color
src/components/LiveMonitorTab.tsx   # Enhanced layout
src/components/App.tsx              # Integrate new components
```

---

## Chunk 1: Design System Foundation

### Task 1: Design Tokens

**Files:**
- Create: `src/lib/design-tokens.ts`
- Modify: `src/styles/globals.css:1-50`

- [ ] **Step 1: Create design tokens file**

```typescript
// src/lib/design-tokens.ts

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

export function getStrategyColor(strategy: string): string {
  return colors.strategy[strategy as keyof typeof colors.strategy] || colors.neutral;
}
```

- [ ] **Step 2: Add CSS custom properties for design tokens**

Add to `src/styles/globals.css` after the existing `:root` block:

```css
/* Design Tokens - Extended */
:root {
  /* Strategy Colors */
  --color-strategy-momentum: hsl(45 93% 47%);
  --color-strategy-mean-reversion: hsl(280 65% 60%);
  --color-strategy-arb: hsl(170 75% 41%);
  --color-strategy-whale: hsl(330 80% 55%);
  --color-strategy-ta: hsl(217 91% 60%);
  --color-strategy-maker: hsl(142 71% 45%);

  /* Animation Timings */
  --duration-fast: 150ms;
  --duration-normal: 300ms;
  --duration-slow: 500ms;

  /* Font Families */
  --font-display: Inter, system-ui, sans-serif;
  --font-mono: JetBrains Mono, ui-monospace, monospace;
}

@theme inline {
  --color-strategy-momentum: hsl(45 93% 47%);
  --color-strategy-mean-reversion: hsl(280 65% 60%);
  --color-strategy-arb: hsl(170 75% 41%);
  --color-strategy-whale: hsl(330 80% 55%);
  --color-strategy-ta: hsl(217 91% 60%);
  --color-strategy-maker: hsl(142 71% 45%);
}
```

- [ ] **Step 3: Run tests to verify nothing broke**

Run: `bun test`
Expected: All 53 tests pass

- [ ] **Step 4: Commit**

```bash
git add src/lib/design-tokens.ts src/styles/globals.css
git commit -m "feat: add design tokens for consistent styling"
```

---

### Task 2: Utility Functions

**Files:**
- Create: `src/lib/cn.ts`
- Create: `test/utils.test.ts` (extend existing)

- [ ] **Step 1: Write failing test for cn utility**

Add to `test/utils.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { cn, formatPrice, formatPercent } from '../src/lib/cn';

describe('cn utility', () => {
  it('should merge class names', () => {
    expect(cn('foo', 'bar')).toBe('foo bar');
  });

  it('should handle conditional classes', () => {
    expect(cn('foo', false && 'bar', 'baz')).toBe('foo baz');
  });

  it('should merge tailwind classes correctly', () => {
    expect(cn('p-4', 'p-2')).toBe('p-2');
  });
});

describe('formatPrice', () => {
  it('should format price as cents', () => {
    expect(formatPrice(0.52)).toBe('52.0¢');
  });

  it('should handle edge cases', () => {
    expect(formatPrice(0)).toBe('0.0¢');
    expect(formatPrice(1)).toBe('100.0¢');
  });
});

describe('formatPercent', () => {
  it('should format as percentage', () => {
    expect(formatPercent(0.123)).toBe('12.3%');
  });

  it('should handle negative values', () => {
    expect(formatPercent(-0.05)).toBe('-5.0%');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test test/utils.test.ts`
Expected: FAIL - module not found

- [ ] **Step 3: Create cn utility with formatters**

```typescript
// src/lib/cn.ts
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Merge class names with Tailwind CSS class conflict resolution
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

/**
 * Format a probability/price as cents (0-100)
 */
export function formatPrice(price: number): string {
  return `${(price * 100).toFixed(1)}¢`;
}

/**
 * Format a decimal as percentage
 */
export function formatPercent(value: number): string {
  const sign = value >= 0 ? '' : '-';
  return `${sign}${Math.abs(value * 100).toFixed(1)}%`;
}

/**
 * Format currency with $ prefix
 */
export function formatCurrency(value: number): string {
  const sign = value >= 0 ? '+' : '';
  return `${sign}$${value.toFixed(2)}`;
}

/**
 * Format large numbers with K/M suffix
 */
export function formatCompact(value: number): string {
  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(1)}M`;
  }
  if (value >= 1_000) {
    return `${(value / 1_000).toFixed(1)}K`;
  }
  return value.toFixed(0);
}

/**
 * Format timestamp as relative time
 */
export function formatRelativeTime(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;

  if (diff < 60_000) return 'just now';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return `${Math.floor(diff / 86_400_000)}d ago`;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `bun test test/utils.test.ts`
Expected: All tests pass

- [ ] **Step 5: Commit**

```bash
git add src/lib/cn.ts test/utils.test.ts
git commit -m "feat: add cn utility with formatting functions"
```

---

## Chunk 2: Chart Components

### Task 3: Sparkline Component

**Files:**
- Create: `src/components/charts/Sparkline.tsx`
- Create: `test/sparkline.test.tsx`

- [ ] **Step 1: Write failing test for Sparkline**

```typescript
// test/sparkline.test.tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Sparkline } from '../src/components/charts/Sparkline';

describe('Sparkline', () => {
  it('should render an SVG with correct dimensions', () => {
    const data = [1, 2, 3, 4, 5];
    render(<Sparkline data={data} width={100} height={30} />);

    const svg = screen.getByRole('img', { hidden: true });
    expect(svg).toBeDefined();
  });

  it('should handle empty data', () => {
    render(<Sparkline data={[]} width={100} height={30} />);
    // Should not crash
  });

  it('should apply positive color for upward trend', () => {
    const data = [1, 2, 3, 4, 5];
    render(<Sparkline data={data} width={100} height={30} trend="up" />);

    const path = document.querySelector('path');
    expect(path?.getAttribute('stroke')).toContain('142');
  });

  it('should apply negative color for downward trend', () => {
    const data = [5, 4, 3, 2, 1];
    render(<Sparkline data={data} width={100} height={30} trend="down" />);

    const path = document.querySelector('path');
    expect(path?.getAttribute('stroke')).toContain('0');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test test/sparkline.test.tsx`
Expected: FAIL - module not found

- [ ] **Step 3: Create Sparkline component**

```typescript
// src/components/charts/Sparkline.tsx
import { useMemo } from 'react';
import { cn } from '../../lib/cn';
import { colors } from '../../lib/design-tokens';

interface SparklineProps {
  data: number[];
  width?: number;
  height?: number;
  trend?: 'up' | 'down' | 'neutral';
  className?: string;
  strokeWidth?: number;
}

export function Sparkline({
  data,
  width = 100,
  height = 30,
  trend = 'neutral',
  className,
  strokeWidth = 2,
}: SparklineProps) {
  const path = useMemo(() => {
    if (data.length < 2) return '';

    const min = Math.min(...data);
    const max = Math.max(...data);
    const range = max - min || 1;

    const points = data.map((value, index) => {
      const x = (index / (data.length - 1)) * width;
      const y = height - ((value - min) / range) * (height - strokeWidth * 2) - strokeWidth;
      return `${x},${y}`;
    });

    return `M ${points.join(' L ')}`;
  }, [data, width, height, strokeWidth]);

  const strokeColor = useMemo(() => {
    switch (trend) {
      case 'up':
        return colors.up;
      case 'down':
        return colors.down;
      default:
        return colors.neutral;
    }
  }, [trend]);

  if (data.length < 2) {
    return (
      <div
        className={cn('flex items-center justify-center', className)}
        style={{ width, height }}
      >
        <span className="text-xs text-muted-foreground">—</span>
      </div>
    );
  }

  return (
    <svg
      role="img"
      aria-hidden="true"
      width={width}
      height={height}
      className={cn('overflow-visible', className)}
    >
      <path
        d={path}
        fill="none"
        stroke={strokeColor}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `bun test test/sparkline.test.tsx`
Expected: All tests pass

- [ ] **Step 5: Commit**

```bash
git add src/components/charts/Sparkline.tsx test/sparkline.test.tsx
git commit -m "feat: add Sparkline component for mini charts"
```

---

### Task 4: AnimatedCounter Component

**Files:**
- Create: `src/components/ui/AnimatedCounter.tsx`
- Create: `test/animated-counter.test.tsx`

- [ ] **Step 1: Write failing test**

```typescript
// test/animated-counter.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AnimatedCounter } from '../src/components/ui/AnimatedCounter';

// Mock framer-motion
vi.mock('framer-motion', () => ({
  motion: {
    span: ({ children, ...props }: any) => <span {...props}>{children}</span>,
  },
  AnimatePresence: ({ children }: any) => <>{children}</>,
}));

describe('AnimatedCounter', () => {
  it('should render the formatted value', () => {
    render(<AnimatedCounter value={1234.56} />);
    expect(screen.getByText('1234.56')).toBeDefined();
  });

  it('should format with specified decimals', () => {
    render(<AnimatedCounter value={1234.5678} decimals={2} />);
    expect(screen.getByText('1234.57')).toBeDefined();
  });

  it('should render prefix and suffix', () => {
    render(<AnimatedCounter value={50} prefix="$" suffix="¢" />);
    expect(screen.getByText('50')).toBeDefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test test/animated-counter.test.tsx`
Expected: FAIL - module not found

- [ ] **Step 3: Create AnimatedCounter component**

```typescript
// src/components/ui/AnimatedCounter.tsx
import { useEffect, useRef, useState } from 'react';
import { motion, useSpring, useTransform } from 'framer-motion';

interface AnimatedCounterProps {
  value: number;
  decimals?: number;
  prefix?: string;
  suffix?: string;
  duration?: number;
  className?: string;
}

export function AnimatedCounter({
  value,
  decimals = 2,
  prefix = '',
  suffix = '',
  duration = 0.5,
  className,
}: AnimatedCounterProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const [displayValue, setDisplayValue] = useState(value);

  const spring = useSpring(value, {
    stiffness: 100 / duration,
    damping: 20,
  });

  const display = useTransform(spring, (latest) => {
    return latest.toFixed(decimals);
  });

  useEffect(() => {
    spring.set(value);
  }, [value, spring]);

  useEffect(() => {
    const unsubscribe = display.on('change', (v) => {
      setDisplayValue(parseFloat(v));
    });
    return unsubscribe;
  }, [display]);

  return (
    <motion.span
      ref={ref}
      className={className}
      style={{ fontVariantNumeric: 'tabular-nums' }}
    >
      {prefix}
      {displayValue.toFixed(decimals)}
      {suffix}
    </motion.span>
  );
}
```

- [ ] **Step 4: Run tests**

Run: `bun test test/animated-counter.test.tsx`
Expected: All tests pass

- [ ] **Step 5: Commit**

```bash
git add src/components/ui/AnimatedCounter.tsx test/animated-counter.test.tsx
git commit -m "feat: add AnimatedCounter for smooth number transitions"
```

---

### Task 5: ProgressRing Component

**Files:**
- Create: `src/components/ui/ProgressRing.tsx`
- Create: `test/progress-ring.test.tsx`

- [ ] **Step 1: Write failing test**

```typescript
// test/progress-ring.test.tsx
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { ProgressRing } from '../src/components/ui/ProgressRing';

describe('ProgressRing', () => {
  it('should render SVG with correct aria attributes', () => {
    const { container } = render(<ProgressRing value={50} />);
    const svg = container.querySelector('svg');
    expect(svg?.getAttribute('role')).toBe('progressbar');
    expect(svg?.getAttribute('aria-valuenow')).toBe('50');
  });

  it('should handle 0% progress', () => {
    const { container } = render(<ProgressRing value={0} />);
    const circle = container.querySelector('circle:nth-child(2)');
    // Stroke dash should be 0 or very small
    expect(circle).toBeDefined();
  });

  it('should handle 100% progress', () => {
    const { container } = render(<ProgressRing value={100} />);
    expect(container.querySelector('svg')).toBeDefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test test/progress-ring.test.tsx`
Expected: FAIL - module not found

- [ ] **Step 3: Create ProgressRing component**

```typescript
// src/components/ui/ProgressRing.tsx
import { motion } from 'framer-motion';
import { cn } from '../../lib/cn';
import { colors } from '../../lib/design-tokens';

interface ProgressRingProps {
  value: number; // 0-100
  size?: number;
  strokeWidth?: number;
  className?: string;
  showValue?: boolean;
  color?: 'success' | 'danger' | 'warning' | 'primary';
}

export function ProgressRing({
  value,
  size = 48,
  strokeWidth = 4,
  className,
  showValue = false,
  color = 'primary',
}: ProgressRingProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const normalizedValue = Math.min(100, Math.max(0, value));
  const offset = circumference - (normalizedValue / 100) * circumference;

  const colorMap = {
    success: colors.success,
    danger: colors.danger,
    warning: colors.warning,
    primary: colors.info,
  };

  return (
    <div className={cn('relative inline-flex items-center justify-center', className)}>
      <svg
        width={size}
        height={size}
        role="progressbar"
        aria-valuenow={normalizedValue}
        aria-valuemin={0}
        aria-valuemax={100}
        className="transform -rotate-90"
      >
        {/* Background circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          className="text-muted opacity-20"
        />
        {/* Progress circle */}
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={colorMap[color]}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
        />
      </svg>
      {showValue && (
        <span className="absolute text-xs font-mono font-semibold">
          {normalizedValue.toFixed(0)}%
        </span>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Run tests**

Run: `bun test test/progress-ring.test.tsx`
Expected: All tests pass

- [ ] **Step 5: Commit**

```bash
git add src/components/ui/ProgressRing.tsx test/progress-ring.test.tsx
git commit -m "feat: add ProgressRing circular progress component"
```

---

## Chunk 3: Strategy Components

### Task 6: StrategyCard Component

**Files:**
- Create: `src/components/strategy/StrategyCard.tsx`
- Create: `test/strategy-card.test.tsx`

- [ ] **Step 1: Write failing test**

```typescript
// test/strategy-card.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { StrategyCard } from '../src/components/strategy/StrategyCard';

// Mock framer-motion
vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  },
}));

describe('StrategyCard', () => {
  it('should render strategy name', () => {
    render(
      <StrategyCard
        strategy="momentum_chaser"
        stats={{ pnl: 10.5, winRate: 0.65, trades: 20 }}
      />
    );
    expect(screen.getByText('Momentum Chaser')).toBeDefined();
  });

  it('should display P&L with correct color', () => {
    const { container } = render(
      <StrategyCard
        strategy="momentum_chaser"
        stats={{ pnl: 10.5, winRate: 0.65, trades: 20 }}
      />
    );
    // Should show positive P&L in green
    expect(screen.getByText(/\+?\$10\.50/)).toBeDefined();
  });

  it('should show win rate as percentage', () => {
    render(
      <StrategyCard
        strategy="ta_signal_engine"
        stats={{ pnl: -5, winRate: 0.45, trades: 10 }}
      />
    );
    expect(screen.getByText('45.0%')).toBeDefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test test/strategy-card.test.tsx`
Expected: FAIL - module not found

- [ ] **Step 3: Create StrategyCard component**

```typescript
// src/components/strategy/StrategyCard.tsx
import { motion } from 'framer-motion';
import { TrendingUp, TrendingDown, Activity, Target } from 'lucide-react';
import { cn } from '../../lib/cn';
import { colors, getStrategyColor, strategyNames } from '../../lib/design-tokens';
import { Sparkline } from '../charts/Sparkline';
import { ProgressRing } from '../ui/ProgressRing';

interface StrategyStats {
  pnl: number;
  winRate: number;
  trades: number;
  balance?: number;
  recentPnl?: number[];
}

interface StrategyCardProps {
  strategy: string;
  stats: StrategyStats;
  enabled?: boolean;
  compact?: boolean;
  onClick?: () => void;
}

export function StrategyCard({
  strategy,
  stats,
  enabled = false,
  compact = false,
  onClick,
}: StrategyCardProps) {
  const strategyColor = getStrategyColor(strategy);
  const name = strategyNames[strategy] || strategy;
  const isPositive = stats.pnl >= 0;

  if (compact) {
    return (
      <motion.div
        onClick={onClick}
        className={cn(
          'flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors',
          'hover:bg-surface-hover',
          enabled ? 'border-primary/50 bg-primary/5' : 'border-border'
        )}
        style={{ borderLeftColor: strategyColor, borderLeftWidth: 3 }}
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
      >
        <ProgressRing
          value={stats.winRate * 100}
          size={32}
          strokeWidth={3}
          color={isPositive ? 'success' : 'danger'}
        />
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium truncate">{name}</div>
          <div className="text-xs text-muted-foreground">
            {stats.trades} trades
          </div>
        </div>
        <div className={cn(
          'text-sm font-mono font-semibold',
          isPositive ? 'text-success' : 'text-danger'
        )}>
          {isPositive ? '+' : ''}{stats.pnl.toFixed(2)}
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      onClick={onClick}
      className={cn(
        'p-4 rounded-xl border cursor-pointer transition-all',
        'hover:shadow-lg hover:shadow-primary/5',
        enabled ? 'border-primary/30 bg-primary/5' : 'border-border bg-card'
      )}
      whileHover={{ y: -2 }}
      whileTap={{ scale: 0.98 }}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <div
            className="w-3 h-3 rounded-full"
            style={{ background: strategyColor }}
          />
          <h3 className="font-semibold">{name}</h3>
        </div>
        <div className={cn(
          'flex items-center gap-1 text-sm font-mono',
          isPositive ? 'text-success' : 'text-danger'
        )}>
          {isPositive ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
          {isPositive ? '+' : ''}${stats.pnl.toFixed(2)}
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-3 gap-3 mb-3">
        <div className="text-center">
          <div className="text-xs text-muted-foreground mb-1">Win Rate</div>
          <div className="text-lg font-mono font-semibold">
            {(stats.winRate * 100).toFixed(1)}%
          </div>
        </div>
        <div className="text-center">
          <div className="text-xs text-muted-foreground mb-1">Trades</div>
          <div className="text-lg font-mono font-semibold">{stats.trades}</div>
        </div>
        <div className="text-center">
          <div className="text-xs text-muted-foreground mb-1">Balance</div>
          <div className="text-lg font-mono font-semibold">
            ${(stats.balance || 100).toFixed(0)}
          </div>
        </div>
      </div>

      {/* Sparkline */}
      {stats.recentPnl && stats.recentPnl.length > 1 && (
        <div className="mt-2">
          <Sparkline
            data={stats.recentPnl}
            width={200}
            height={40}
            trend={isPositive ? 'up' : 'down'}
          />
        </div>
      )}
    </motion.div>
  );
}
```

- [ ] **Step 4: Run tests**

Run: `bun test test/strategy-card.test.tsx`
Expected: All tests pass

- [ ] **Step 5: Commit**

```bash
git add src/components/strategy/StrategyCard.tsx test/strategy-card.test.tsx
git commit -m "feat: add StrategyCard component with stats display"
```

---

### Task 7: StrategyRecommendation Component

**Files:**
- Create: `src/components/strategy/StrategyRecommendation.tsx`
- Create: `test/strategy-recommendation.test.tsx`

- [ ] **Step 1: Write failing test**

```typescript
// test/strategy-recommendation.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { StrategyRecommendation } from '../src/components/strategy/StrategyRecommendation';

vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  },
}));

describe('StrategyRecommendation', () => {
  it('should display market phase', () => {
    render(
      <StrategyRecommendation
        phase="trending_up"
        recommendedStrategy="momentum_chaser"
        confidence={0.75}
        reason="Strong upward momentum detected"
      />
    );
    expect(screen.getByText(/trending/i)).toBeDefined();
  });

  it('should show recommended strategy', () => {
    render(
      <StrategyRecommendation
        phase="ranging"
        recommendedStrategy="mean_reversion_sniper"
        confidence={0.6}
        reason="Price oscillating in range"
      />
    );
    expect(screen.getByText('Mean Reversion Sniper')).toBeDefined();
  });

  it('should display confidence meter', () => {
    render(
      <StrategyRecommendation
        phase="volatile"
        recommendedStrategy="ta_signal_engine"
        confidence={0.85}
        reason="High volatility with clear signals"
      />
    );
    expect(screen.getByText(/85%/)).toBeDefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test test/strategy-recommendation.test.tsx`
Expected: FAIL - module not found

- [ ] **Step 3: Create StrategyRecommendation component**

```typescript
// src/components/strategy/StrategyRecommendation.tsx
import { motion } from 'framer-motion';
import { Zap, TrendingUp, TrendingDown, Activity, Target } from 'lucide-react';
import { cn } from '../../lib/cn';
import { getStrategyColor, strategyNames } from '../../lib/design-tokens';
import { ProgressRing } from '../ui/ProgressRing';

type MarketPhase = 'trending_up' | 'trending_down' | 'ranging' | 'volatile';

interface StrategyRecommendationProps {
  phase: MarketPhase;
  recommendedStrategy: string;
  confidence: number;
  reason: string;
  alternatives?: string[];
  className?: string;
}

const phaseConfig: Record<MarketPhase, { icon: typeof Activity; label: string; color: string }> = {
  trending_up: { icon: TrendingUp, label: 'Trending Up', color: 'text-success' },
  trending_down: { icon: TrendingDown, label: 'Trending Down', color: 'text-danger' },
  ranging: { icon: Activity, label: 'Ranging', color: 'text-warning' },
  volatile: { icon: Zap, label: 'Volatile', color: 'text-info' },
};

export function StrategyRecommendation({
  phase,
  recommendedStrategy,
  confidence,
  reason,
  alternatives = [],
  className,
}: StrategyRecommendationProps) {
  const { icon: PhaseIcon, label: phaseLabel, color: phaseColor } = phaseConfig[phase];
  const strategyName = strategyNames[recommendedStrategy] || recommendedStrategy;
  const strategyColor = getStrategyColor(recommendedStrategy);

  return (
    <motion.div
      className={cn('p-4 rounded-xl border border-border bg-card', className)}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
    >
      {/* Phase Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <PhaseIcon className={cn('w-5 h-5', phaseColor)} />
          <span className="text-sm font-medium">Market Phase</span>
        </div>
        <span className={cn('text-sm font-semibold', phaseColor)}>{phaseLabel}</span>
      </div>

      {/* Recommendation */}
      <div className="flex items-start gap-4 mb-4">
        <ProgressRing
          value={confidence * 100}
          size={56}
          strokeWidth={4}
          color={confidence > 0.7 ? 'success' : confidence > 0.4 ? 'warning' : 'danger'}
          showValue
        />
        <div className="flex-1">
          <div className="text-xs text-muted-foreground mb-1">Recommended Strategy</div>
          <div className="flex items-center gap-2">
            <div
              className="w-2 h-2 rounded-full"
              style={{ background: strategyColor }}
            />
            <span className="font-semibold">{strategyName}</span>
          </div>
          <p className="text-sm text-muted-foreground mt-1">{reason}</p>
        </div>
      </div>

      {/* Alternatives */}
      {alternatives.length > 0 && (
        <div className="pt-3 border-t border-border">
          <div className="text-xs text-muted-foreground mb-2">Also Consider</div>
          <div className="flex flex-wrap gap-2">
            {alternatives.slice(0, 3).map((alt) => (
              <span
                key={alt}
                className="px-2 py-1 text-xs rounded-md bg-secondary"
              >
                {strategyNames[alt] || alt}
              </span>
            ))}
          </div>
        </div>
      )}
    </motion.div>
  );
}
```

- [ ] **Step 4: Run tests**

Run: `bun test test/strategy-recommendation.test.tsx`
Expected: All tests pass

- [ ] **Step 5: Commit**

```bash
git add src/components/strategy/StrategyRecommendation.tsx test/strategy-recommendation.test.tsx
git commit -m "feat: add StrategyRecommendation with market phase display"
```

---

## Chunk 4: Enhanced Market Card

### Task 8: Redesign MarketCard with Animations

**Files:**
- Modify: `src/components/MarketCard.tsx`
- Modify: `src/styles/globals.css` (add animation classes)

- [ ] **Step 1: Write test for enhanced MarketCard**

Add to a new test file:

```typescript
// test/market-card-enhanced.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MarketCard } from '../src/components/MarketCard';

vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
    span: ({ children, ...props }: any) => <span {...props}>{children}</span>,
  },
}));

describe('MarketCard Enhanced', () => {
  it('should show urgency styling when time is low', () => {
    const { container } = render(
      <MarketCard
        marketData={{
          market: { id: '1', question: 'Test?', startTime: Date.now() - 240000, endTime: Date.now() + 60000, status: 'active', result: null, startPrice: 50000, endPrice: null, volumeNum: 1000, liquidity: 5000, outcomePrices: { yes: '0.55', no: '0.45' } },
          btcPrice: 50000,
          priceHistory: [],
          btcPriceHistory: [],
          timeRemaining: 30000,
          marketDuration: 300000,
          startedAt: Date.now() - 240000,
          orderBook: null,
        }}
        yesPrice={0.55}
        noPrice={0.45}
        yesPriceDirection="up"
        noPriceDirection="down"
        coinColor="#f7931a"
        selectedAsset="BTC"
        selectedTimeframe="5"
      />
    );

    // Should show warning/urgent state
    expect(container.querySelector('.urgent') || container.querySelector('[class*="urgent"]')).toBeDefined;
  });
});
```

- [ ] **Step 2: Run test to see current state**

Run: `bun test test/market-card-enhanced.test.tsx`
Expected: May fail - we're enhancing existing component

- [ ] **Step 3: Enhance MarketCard with animations**

Replace the existing `src/components/MarketCard.tsx` with enhanced version:

```typescript
// src/components/MarketCard.tsx
import { motion, AnimatePresence } from 'framer-motion';
import { TrendingUp, TrendingDown, Clock, Volume2, Zap } from 'lucide-react';
import type { MarketData } from '../hooks/useTradingData';
import { cn } from '../lib/cn';
import { AnimatedCounter } from './ui/AnimatedCounter';
import { Sparkline } from './charts/Sparkline';

interface MarketCardProps {
  marketData: MarketData | null;
  yesPrice: number;
  noPrice: number;
  yesPriceDirection: 'up' | 'down' | null;
  noPriceDirection: 'up' | 'down' | null;
  coinColor: string;
  selectedAsset: string;
  selectedTimeframe: string;
}

function formatCountdown(ms: number): string {
  if (ms <= 0) return 'Expired';
  const minutes = Math.floor(ms / 60_000);
  const seconds = Math.floor((ms % 60_000) / 1_000);
  if (minutes > 0) return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  return `0:${seconds.toString().padStart(2, '0')}`;
}

export function MarketCard({
  marketData,
  yesPrice,
  noPrice,
  yesPriceDirection,
  noPriceDirection,
  coinColor,
  selectedAsset,
  selectedTimeframe,
}: MarketCardProps) {
  const timeRemaining = marketData?.timeRemaining || 0;
  const market = marketData?.market;

  const isUrgent = timeRemaining < 60000;
  const isWarning = timeRemaining < 300000;

  // Generate mini price history for sparkline
  const priceHistory = market?.yesPriceHistory?.slice(-20).map(p => p.price) || [];

  return (
    <motion.div
      className="glass-card p-5"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-xl font-bold">
            <span style={{ color: coinColor }}>{selectedAsset}</span>
            <span className="text-secondary-foreground font-normal ml-2">Up/Down</span>
          </h2>
          <p className="text-sm text-muted-foreground truncate max-w-[250px]">
            {market?.question || `Will ${selectedAsset} go up or down?`}
          </p>
        </div>

        {/* Countdown Timer */}
        <motion.div
          className={cn(
            'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium',
            isUrgent && 'bg-danger/20 text-danger',
            isWarning && !isUrgent && 'bg-warning/20 text-warning',
            !isWarning && 'bg-surface text-muted-foreground'
          )}
          animate={isUrgent ? { scale: [1, 1.02, 1] } : {}}
          transition={{ duration: 0.5, repeat: isUrgent ? Infinity : 0 }}
        >
          <Clock className="w-4 h-4" />
          <span className="font-mono text-base">
            {formatCountdown(timeRemaining)}
          </span>
        </motion.div>
      </div>

      {/* Price Display Grid */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        {/* UP / YES */}
        <motion.div
          className={cn(
            'p-4 rounded-xl border transition-all',
            'bg-success/5 border-success/30',
            yesPriceDirection === 'up' && 'ring-2 ring-success/30'
          )}
          whileHover={{ scale: 1.02 }}
        >
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="w-5 h-5 text-success" />
            <span className="text-sm font-semibold text-success uppercase tracking-wide">
              UP
            </span>
          </div>

          <AnimatePresence mode="wait">
            <motion.div
              key={yesPrice}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="text-3xl font-bold font-mono text-success"
            >
              <AnimatedCounter value={yesPrice * 100} decimals={1} suffix="¢" />
            </motion.div>
          </AnimatePresence>

          <div className="text-xs text-muted-foreground mt-1">
            ROI: {((1 / yesPrice - 1) * 100).toFixed(0)}%
          </div>
        </motion.div>

        {/* DOWN / NO */}
        <motion.div
          className={cn(
            'p-4 rounded-xl border transition-all',
            'bg-danger/5 border-danger/30',
            noPriceDirection === 'up' && 'ring-2 ring-danger/30'
          )}
          whileHover={{ scale: 1.02 }}
        >
          <div className="flex items-center gap-2 mb-2">
            <TrendingDown className="w-5 h-5 text-danger" />
            <span className="text-sm font-semibold text-danger uppercase tracking-wide">
              DOWN
            </span>
          </div>

          <AnimatePresence mode="wait">
            <motion.div
              key={noPrice}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="text-3xl font-bold font-mono text-danger"
            >
              <AnimatedCounter value={noPrice * 100} decimals={1} suffix="¢" />
            </motion.div>
          </AnimatePresence>

          <div className="text-xs text-muted-foreground mt-1">
            ROI: {((1 / noPrice - 1) * 100).toFixed(0)}%
          </div>
        </motion.div>
      </div>

      {/* Probability Bar */}
      <div className="mb-4">
        <div className="flex justify-between text-xs font-semibold mb-1.5">
          <span className="text-success">{(yesPrice * 100).toFixed(1)}%</span>
          <span className="text-danger">{(noPrice * 100).toFixed(1)}%</span>
        </div>
        <div className="h-2 bg-danger rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-success"
            initial={{ width: '50%' }}
            animate={{ width: `${yesPrice * 100}%` }}
            transition={{ duration: 0.3 }}
          />
        </div>
      </div>

      {/* Sparkline */}
      {priceHistory.length > 1 && (
        <div className="mb-4 p-3 bg-surface rounded-lg">
          <div className="text-xs text-muted-foreground mb-2">YES Price History</div>
          <Sparkline
            data={priceHistory}
            width={280}
            height={50}
            trend={priceHistory[priceHistory.length - 1] > priceHistory[0] ? 'up' : 'down'}
          />
        </div>
      )}

      {/* Market Info */}
      <div className="grid grid-cols-2 gap-3 text-xs">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Volume2 className="w-4 h-4" />
          <span>Vol:</span>
          <span className="font-mono text-foreground">
            ${((market?.volumeNum || market?.liquidity || 0) / 1000).toFixed(1)}K
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Zap className="w-4 h-4 text-success" />
          <span className="text-muted-foreground">Status:</span>
          <span className="text-success font-medium">Live</span>
        </div>
      </div>
    </motion.div>
  );
}
```

- [ ] **Step 4: Run all tests**

Run: `bun test`
Expected: All tests pass

- [ ] **Step 5: Commit**

```bash
git add src/components/MarketCard.tsx test/market-card-enhanced.test.tsx
git commit -m "feat: enhance MarketCard with animations and sparkline"
```

---

## Chunk 5: Bot Dashboard Enhancement

### Task 9: Enhance BotStatusCard

**Files:**
- Modify: `src/components/BotStatusCard.tsx`

- [ ] **Step 1: Read current BotStatusCard**

The current implementation needs to be enhanced with:
- Strategy color badge
- Mini sparkline for recent performance
- Animated win rate display

- [ ] **Step 2: Enhance BotStatusCard component**

Add imports and enhance the rendering (partial changes shown for key sections):

```typescript
// Add imports at top of src/components/BotStatusCard.tsx
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkline } from './charts/Sparkline';
import { ProgressRing } from './ui/ProgressRing';
import { getStrategyColor, strategyNames } from '../lib/design-tokens';
import { cn, formatCurrency } from '../lib/cn';

// In the component, add strategy color badge:
const strategyColor = getStrategyColor(bot.strategy);
const strategyName = strategyNames[bot.strategy] || bot.strategy;

// Replace stats display with animated versions:
<motion.div className="flex items-center gap-4">
  <ProgressRing
    value={bot.stats.winRate * 100}
    size={48}
    strokeWidth={4}
    color={bot.stats.pnl >= 0 ? 'success' : 'danger'}
    showValue
  />
  <div className="flex-1">
    <div className="flex items-center gap-2 mb-1">
      <div
        className="w-2 h-2 rounded-full"
        style={{ background: strategyColor }}
      />
      <span className="text-xs text-muted-foreground">{strategyName}</span>
    </div>
    <div className="font-mono text-lg font-bold">
      {formatCurrency(bot.stats.pnl)}
    </div>
  </div>
</motion.div>

// Add mini sparkline if data available:
{bot.stats.recentPnl && (
  <div className="mt-3">
    <Sparkline
      data={bot.stats.recentPnl}
      width={150}
      height={30}
      trend={bot.stats.pnl >= 0 ? 'up' : 'down'}
    />
  </div>
)}
```

- [ ] **Step 3: Run tests**

Run: `bun test`
Expected: All tests pass

- [ ] **Step 4: Commit**

```bash
git add src/components/BotStatusCard.tsx
git commit -m "feat: enhance BotStatusCard with strategy colors and sparkline"
```

---

### Task 10: Update Header with Live Ticker

**Files:**
- Modify: `src/components/Header.tsx`

- [ ] **Step 1: Enhance Header with live price ticker**

```typescript
// src/components/Header.tsx - Enhanced version
import { motion } from 'framer-motion';
import { Zap, RefreshCw, BarChart3, ArrowLeft, Bot, TrendingUp, TrendingDown } from 'lucide-react';
import { cn } from '../lib/cn';

interface HeaderProps {
  isBotRunning: boolean;
  apiLatency: number;
  coinColor: string;
  onRefresh: () => void;
  showBackButton?: boolean;
  onBack?: () => void;
  onOpenDashboard?: () => void;
  activeBots?: number;
  totalBots?: number;
  livePrice?: number;
  priceDirection?: 'up' | 'down';
}

export function Header({
  isBotRunning,
  apiLatency,
  coinColor,
  onRefresh,
  showBackButton,
  onBack,
  onOpenDashboard,
  activeBots = 0,
  totalBots = 10,
  livePrice,
  priceDirection,
}: HeaderProps) {
  return (
    <nav className="sticky top-0 z-50 bg-background/80 backdrop-blur-xl border-b border-border px-6 py-3">
      <div className="max-w-[1600px] mx-auto flex items-center justify-between">
        {/* Logo */}
        <div className="flex items-center gap-3">
          <motion.div
            className="flex items-center gap-2 text-xl font-bold"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            <Zap style={{ color: coinColor }} className="w-5 h-5" />
            <span>Poly</span>
            <span className="text-primary">Trade</span>
          </motion.div>

          {/* Live Price Ticker */}
          {livePrice !== undefined && (
            <motion.div
              className={cn(
                'flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-mono',
                priceDirection === 'up' ? 'bg-success/10 text-success' : 'bg-danger/10 text-danger'
              )}
              key={livePrice}
              initial={{ scale: 1.1 }}
              animate={{ scale: 1 }}
            >
              {priceDirection === 'up' ? (
                <TrendingUp className="w-3 h-3" />
              ) : (
                <TrendingDown className="w-3 h-3" />
              )}
              ${livePrice.toFixed(2)}
            </motion.div>
          )}
        </div>

        {/* Right Side */}
        <div className="flex items-center gap-3">
          {showBackButton && onBack && (
            <button
              onClick={onBack}
              className="quick-btn flex items-center gap-1"
            >
              <ArrowLeft className="w-3 h-3" />
              <span className="text-xs">Back</span>
            </button>
          )}

          {/* Bot Indicator */}
          <motion.div
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs',
              onOpenDashboard ? 'cursor-pointer hover:bg-surface-hover' : ''
            )}
            onClick={onOpenDashboard}
            whileHover={onOpenDashboard ? { scale: 1.05 } : {}}
          >
            <Bot className="w-3.5 h-3.5" style={{ color: isBotRunning ? '#22c55e' : 'var(--muted-foreground)' }} />
            <span className="font-mono">
              {activeBots}/{totalBots}
            </span>
          </motion.div>

          {/* Status */}
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-surface text-xs">
            <motion.div
              className="w-2 h-2 rounded-full"
              style={{ background: isBotRunning ? '#22c55e' : '#f59e0b' }}
              animate={isBotRunning ? { scale: [1, 1.2, 1] } : {}}
              transition={{ duration: 1, repeat: Infinity }}
            />
            <span className="text-muted-foreground">
              {isBotRunning ? 'Trading Live' : 'Standby'}
            </span>
          </div>

          {/* Latency */}
          <div className="text-xs text-muted-foreground">
            <span className="mr-1">Latency:</span>
            <span className="font-mono text-foreground">{apiLatency}ms</span>
          </div>

          {/* Refresh */}
          <motion.button
            onClick={onRefresh}
            className="p-2 rounded-lg hover:bg-surface transition-colors"
            whileHover={{ rotate: 180 }}
            transition={{ duration: 0.3 }}
          >
            <RefreshCw className="w-4 h-4 text-muted-foreground" />
          </motion.button>

          {/* Dashboard Button */}
          {onOpenDashboard && !showBackButton && (
            <button
              onClick={onOpenDashboard}
              className="quick-btn flex items-center gap-1"
            >
              <BarChart3 className="w-3 h-3" />
              <span className="text-xs">Dashboard</span>
            </button>
          )}
        </div>
      </div>
    </nav>
  );
}
```

- [ ] **Step 2: Run tests**

Run: `bun test`
Expected: All tests pass

- [ ] **Step 3: Commit**

```bash
git add src/components/Header.tsx
git commit -m "feat: add live price ticker to Header"
```

---

## Chunk 6: Final Integration

### Task 11: Integrate New Components into App

**Files:**
- Modify: `src/components/App.tsx`
- Modify: `src/components/LiveMonitorTab.tsx`

- [ ] **Step 1: Update App.tsx imports and usage**

Add imports for new components:

```typescript
// Add to imports in src/components/App.tsx
import { StrategyRecommendation } from './strategy/StrategyRecommendation';
import { marketAnalyzer } from '../lib/market-analyzer';
```

Add StrategyRecommendation to the left column after QuickActions:

```typescript
{/* In the left column, after QuickActions */}
<StrategyRecommendation
  phase={marketAnalyzer.getCurrentPhase()}
  recommendedStrategy={marketAnalyzer.getRecommendation().recommendedStrategy}
  confidence={marketAnalyzer.getRecommendation().confidence}
  reason={marketAnalyzer.getRecommendation().reason}
  alternatives={marketAnalyzer.getRecommendation().alternativeStrategies}
/>
```

- [ ] **Step 2: Update LiveMonitorTab to use StrategyCard**

Import StrategyCard and use it in the bot grid:

```typescript
// Add import
import { StrategyCard } from './strategy/StrategyCard';

// Replace the bot grid rendering with StrategyCard components
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
  {sortedBots.map(bot => (
    <StrategyCard
      key={bot.id}
      strategy={bot.strategy}
      stats={{
        pnl: bot.stats.pnl,
        winRate: bot.stats.winRate,
        trades: bot.stats.trades,
        balance: bot.portfolio.balance,
        recentPnl: bot.stats.recentPnl,
      }}
      enabled={bot.enabled}
      onClick={() => handleToggleBot(bot.id)}
    />
  ))}
</div>
```

- [ ] **Step 3: Run all tests**

Run: `bun test`
Expected: All tests pass

- [ ] **Step 4: Run dev server to verify**

Run: `bun run dev`
Expected: App starts without errors

- [ ] **Step 5: Commit**

```bash
git add src/components/App.tsx src/components/LiveMonitorTab.tsx
git commit -m "feat: integrate new UI components into main app"
```

---

### Task 12: Final Verification and Documentation

**Files:**
- Update: `README.md`

- [ ] **Step 1: Run full test suite**

Run: `bun test`
Expected: All tests pass (53+ tests)

- [ ] **Step 2: Build production bundle**

Run: `bun run build`
Expected: Build succeeds

- [ ] **Step 3: Update README with new features**

Add to the Features section:

```markdown
### Enhanced UI Components

- **Design Tokens**: Consistent color, typography, and animation system
- **Animated Counters**: Smooth number transitions for prices and stats
- **Sparklines**: Mini inline charts showing recent performance
- **Progress Rings**: Circular progress indicators for win rates
- **Strategy Cards**: Visual display of bot strategy with color coding
- **Market Phase Detection**: Real-time analysis of market conditions
- **Strategy Recommendations**: AI-style suggestions based on market phase
```

- [ ] **Step 4: Final commit**

```bash
git add README.md
git commit -m "docs: update README with new UI features"
```

---

## Execution Checklist

- [ ] All 12 tasks completed
- [ ] All tests passing
- [ ] Build succeeds
- [ ] No console errors in browser
- [ ] Documentation updated

## Notes for Implementer

1. **Test-First**: Always write the test before implementation
2. **Small Commits**: Each task should be its own commit
3. **Run Tests Frequently**: Verify after each change
4. **Check Browser**: Periodically check the UI in the browser
5. **Animation Performance**: Use `will-change` sparingly, prefer transforms
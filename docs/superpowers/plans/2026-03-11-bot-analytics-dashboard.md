# Bot Analytics Dashboard Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a dedicated `/bots` page with real-time bot monitoring and historical session analysis.

**Architecture:** Client-side routing with a new BotDashboardPage component containing two tabs (Live Monitor, Session History). Reuses existing `useTradingData` hook for live data, adds `useBotSessions` hook for history. No global state changes needed.

**Tech Stack:** React, TypeScript, existing glass-card styling, Bun server API routes

---

## File Structure

**New Files:**
- `src/components/BotDashboardPage.tsx` - Main page with tab navigation
- `src/components/LiveMonitorTab.tsx` - Real-time bot status grid
- `src/components/SessionHistoryTab.tsx` - Sessions table with filters
- `src/components/BotStatusCard.tsx` - Individual bot card component
- `src/components/SessionDetailPanel.tsx` - Expanded session detail view
- `src/components/StrategyComparison.tsx` - Comparison modal/view
- `src/hooks/useBotSessions.ts` - Hook for fetching session history

**Modified Files:**
- `src/components/App.tsx` - Add routing logic for `/bots` page
- `src/components/Header.tsx` - Add "Bot Dashboard" button
- `src/server.ts` - Add sessions export endpoint

---

## Chunk 1: Client-Side Routing Foundation

### Task 1: Add Simple Client-Side Routing

**Files:**
- Modify: `src/components/App.tsx`

- [ ] **Step 1: Add routing state to App.tsx**

Add a simple hash-based routing mechanism. No external router needed.

```typescript
// Add at the top of App.tsx, after imports
type Route = 'trading' | 'bots';

function useRoute(): [Route, (route: Route) => void] {
  const [route, setRoute] = useState<Route>(() => {
    const hash = window.location.hash.slice(1);
    return hash === 'bots' ? 'bots' : 'trading';
  });

  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.slice(1);
      setRoute(hash === 'bots' ? 'bots' : 'trading');
    };
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  const navigate = useCallback((newRoute: Route) => {
    window.location.hash = newRoute === 'trading' ? '' : newRoute;
    setRoute(newRoute);
  }, []);

  return [route, navigate];
}
```

- [ ] **Step 2: Add navigate prop to App component**

```typescript
// Add to App component, after state declarations
const [route, navigate] = useRoute();

// Add navigation context for child components
const navigateRef = useRef(navigate);
navigateRef.current = navigate;
```

- [ ] **Step 3: Update App.tsx render to show BotDashboardPage on /bots route**

```typescript
// Replace the return statement in App.tsx
if (route === 'bots') {
  return (
    <div style={{ minHeight: "100vh", background: "hsl(222, 47%, 4%)" }}>
      <Header
        isBotRunning={isBotRunning}
        apiLatency={apiLatency}
        coinColor={coinColor}
        onRefresh={fetchData}
        showBackButton
        onBack={() => navigate('trading')}
      />
      <main style={{ padding: "1rem", maxWidth: 1400, margin: "0 auto" }}>
        {/* BotDashboardPage will be added in next task */}
        <div style={{ color: "white", textAlign: "center", padding: "2rem" }}>
          Bot Dashboard - Coming Soon
        </div>
      </main>
    </div>
  );
}

// Keep existing trading UI for default route
return (
  // ... existing return statement unchanged
);
```

- [ ] **Step 4: Run the app to verify routing works**

Run: `bun dev`
Expected: App loads at `/`, clicking URL with `#bots` should show placeholder text

- [ ] **Step 5: Commit routing foundation**

```bash
git add src/components/App.tsx
git commit -m "feat: add client-side routing for /bots page"
```

---

### Task 2: Add Dashboard Button to Header

**Files:**
- Modify: `src/components/Header.tsx`

- [ ] **Step 1: Add props for dashboard navigation**

```typescript
// Update HeaderProps interface
interface HeaderProps {
  isBotRunning: boolean;
  apiLatency: number;
  coinColor: string;
  onRefresh: () => void;
  showBackButton?: boolean;
  onBack?: () => void;
  onOpenDashboard?: () => void;
}
```

- [ ] **Step 2: Add Dashboard button to Header**

```typescript
// In the Header component, update the right section div
<div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
  {/* Add Dashboard button - only show on trading page */}
  {onOpenDashboard && (
    <button
      onClick={onOpenDashboard}
      className="quick-btn"
      title="Bot Dashboard"
      style={{ display: "flex", alignItems: "center", gap: "0.25rem" }}
    >
      <BarChart3 className="w-3 h-3" />
      <span style={{ fontSize: "0.75rem" }}>Bots</span>
    </button>
  )}
  {/* Add Back button - only show on dashboard page */}
  {showBackButton && onBack && (
    <button
      onClick={onBack}
      className="quick-btn"
      style={{ display: "flex", alignItems: "center", gap: "0.25rem" }}
    >
      <ArrowLeft className="w-3 h-3" />
      <span style={{ fontSize: "0.75rem" }}>Back</span>
    </button>
  )}
  {/* Existing status pills... */}
  <div className="status-pill">
    {/* ... existing code ... */}
  </div>
</div>
```

- [ ] **Step 3: Add required icon imports**

```typescript
// Update imports at top of Header.tsx
import { Zap, RefreshCw, BarChart3, ArrowLeft } from "lucide-react";
```

- [ ] **Step 4: Update App.tsx to pass navigation props to Header**

```typescript
// In the trading route Header component
<Header
  isBotRunning={isBotRunning}
  apiLatency={apiLatency}
  coinColor={coinColor}
  onRefresh={fetchData}
  onOpenDashboard={() => navigate('bots')}
/>
```

- [ ] **Step 5: Verify header buttons work**

Run: `bun dev`
Expected: "Bots" button appears in header, clicking navigates to dashboard with back button

- [ ] **Step 6: Commit header changes**

```bash
git add src/components/Header.tsx src/components/App.tsx
git commit -m "feat: add bot dashboard navigation to header"
```

---

## Chunk 2: Live Monitor Tab

### Task 3: Create BotStatusCard Component

**Files:**
- Create: `src/components/BotStatusCard.tsx`

- [ ] **Step 1: Create the BotStatusCard component**

```typescript
import { Bot, Activity, TrendingUp, TrendingDown } from "lucide-react";
import { formatCurrency, formatPercentage } from "../lib/utils";
import type { BotData } from "../hooks/useTradingData";

interface BotStatusCardProps {
  bot: BotData;
  yesPrice: number;
  positions: Array<{
    id: string;
    botId?: string;
    outcome: "YES" | "NO";
    amount: number;
    stake: number;
  }>;
}

export function BotStatusCard({ bot, yesPrice, positions }: BotStatusCardProps) {
  const botPositions = positions.filter(p => p.botId === bot.id);
  const unrealizedPnl = botPositions.reduce((sum, pos) => {
    if (pos.outcome === "YES") {
      return sum + (pos.amount * yesPrice - pos.stake);
    }
    return sum + (pos.amount * (1 - yesPrice) - pos.stake);
  }, 0);

  const pnlPercent = bot.portfolio.initialBalance > 0
    ? ((bot.portfolio.balance - bot.portfolio.initialBalance) / bot.portfolio.initialBalance) * 100
    : 0;

  return (
    <div
      className="glass-card"
      style={{
        padding: "1rem",
        display: "flex",
        flexDirection: "column",
        gap: "0.75rem",
        border: bot.enabled ? "1px solid rgba(34, 197, 94, 0.3)" : "1px solid var(--border)"
      }}
    >
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <div
            style={{
              width: 8,
              height: 8,
              borderRadius: "50%",
              background: bot.enabled ? "#22c55e" : "#6b7280",
              animation: bot.enabled ? "pulse 2s infinite" : undefined
            }}
          />
          <Bot className="w-4 h-4" style={{ color: bot.enabled ? "#22c55e" : "var(--text-muted)" }} />
          <span style={{ fontWeight: 600, fontSize: "0.875rem" }}>{bot.name}</span>
        </div>
        <span
          style={{
            fontSize: "0.625rem",
            padding: "0.125rem 0.375rem",
            borderRadius: 4,
            background: bot.enabled ? "rgba(34, 197, 94, 0.2)" : "rgba(107, 114, 128, 0.2)",
            color: bot.enabled ? "#22c55e" : "#6b7280"
          }}
        >
          {bot.strategy}
        </span>
      </div>

      {/* Stats Grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "0.5rem" }}>
        <div>
          <div style={{ fontSize: "0.625rem", color: "var(--text-muted)" }}>Balance</div>
          <div style={{ fontFamily: "ui-monospace, monospace", fontWeight: 600 }}>
            {formatCurrency(bot.portfolio.balance)}
          </div>
        </div>
        <div>
          <div style={{ fontSize: "0.625rem", color: "var(--text-muted)" }}>P&L</div>
          <div
            style={{
              fontFamily: "ui-monospace, monospace",
              fontWeight: 600,
              color: bot.stats.pnl >= 0 ? "#22c55e" : "#ef4444"
            }}
          >
            {bot.stats.pnl >= 0 ? "+" : ""}{formatCurrency(bot.stats.pnl)}
            <span style={{ fontSize: "0.625rem", marginLeft: 4 }}>
              ({pnlPercent >= 0 ? "+" : ""}{pnlPercent.toFixed(1)}%)
            </span>
          </div>
        </div>
        <div>
          <div style={{ fontSize: "0.625rem", color: "var(--text-muted)" }}>Trades</div>
          <div style={{ fontFamily: "ui-monospace, monospace" }}>{bot.stats.trades}</div>
        </div>
        <div>
          <div style={{ fontSize: "0.625rem", color: "var(--text-muted)" }}>Win Rate</div>
          <div style={{ fontFamily: "ui-monospace, monospace" }}>
            {bot.stats.winRate > 0 ? `${(bot.stats.winRate * 100).toFixed(0)}%` : "-"}
          </div>
        </div>
      </div>

      {/* Positions & Unrealized PnL */}
      {botPositions.length > 0 && (
        <div style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0.5rem",
          background: "rgba(0,0,0,0.2)",
          borderRadius: 6,
          fontSize: "0.75rem"
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.25rem" }}>
            <Activity className="w-3 h-3" style={{ color: "#3b82f6" }} />
            <span>{botPositions.length} position{botPositions.length > 1 ? "s" : ""}</span>
          </div>
          <div style={{
            fontFamily: "ui-monospace, monospace",
            color: unrealizedPnl >= 0 ? "#22c55e" : "#ef4444"
          }}>
            {unrealizedPnl >= 0 ? "+" : ""}{formatCurrency(unrealizedPnl)} unrealized
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify component compiles**

Run: `bun run build`
Expected: No TypeScript errors

- [ ] **Step 3: Commit BotStatusCard**

```bash
git add src/components/BotStatusCard.tsx
git commit -m "feat: add BotStatusCard component for live monitoring"
```

---

### Task 4: Create LiveMonitorTab Component

**Files:**
- Create: `src/components/LiveMonitorTab.tsx`

- [ ] **Step 1: Create the LiveMonitorTab component**

```typescript
import { useState, useEffect } from "react";
import { Activity, TrendingUp, TrendingDown, Target, DollarSign, BarChart3 } from "lucide-react";
import { formatCurrency } from "../lib/utils";
import { BotStatusCard } from "./BotStatusCard";
import type { BotData, BotLog } from "../types";

interface LiveMonitorTabProps {
  bots: BotData[];
  botLogs: BotLog[];
  yesPrice: number;
  positions: Array<{
    id: string;
    botId?: string;
    outcome: "YES" | "NO";
    amount: number;
    stake: number;
  }>;
}

type SortField = 'pnl' | 'winRate' | 'trades' | 'balance';

export function LiveMonitorTab({ bots, botLogs, yesPrice, positions }: LiveMonitorTabProps) {
  const [sortBy, setSortBy] = useState<SortField>('pnl');
  const [showActivityFeed, setShowActivityFeed] = useState(true);

  // Calculate summary stats
  const activeBots = bots.filter(b => b.enabled);
  const totalPnl = bots.reduce((sum, b) => sum + b.stats.pnl, 0);
  const totalPositions = positions.filter(p => p.botId).length;
  const totalBalance = bots.reduce((sum, b) => sum + b.portfolio.balance, 0);

  // Sort bots
  const sortedBots = [...bots].sort((a, b) => {
    switch (sortBy) {
      case 'pnl':
        return b.stats.pnl - a.stats.pnl;
      case 'winRate':
        return b.stats.winRate - a.stats.winRate;
      case 'trades':
        return b.stats.trades - a.stats.trades;
      case 'balance':
        return b.portfolio.balance - a.portfolio.balance;
      default:
        return 0;
    }
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
      {/* Summary Bar */}
      <div className="glass-card" style={{ padding: "1rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "2rem", flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <Target className="w-4 h-4" style={{ color: "var(--primary)" }} />
            <span style={{ fontSize: "0.875rem", color: "var(--text-muted)" }}>Active:</span>
            <span style={{ fontWeight: 600, fontFamily: "ui-monospace, monospace" }}>
              {activeBots.length}/{bots.length}
            </span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <DollarSign className="w-4 h-4" style={{ color: totalPnl >= 0 ? "#22c55e" : "#ef4444" }} />
            <span style={{ fontSize: "0.875rem", color: "var(--text-muted)" }}>Total P&L:</span>
            <span
              style={{
                fontWeight: 600,
                fontFamily: "ui-monospace, monospace",
                color: totalPnl >= 0 ? "#22c55e" : "#ef4444"
              }}
            >
              {totalPnl >= 0 ? "+" : ""}{formatCurrency(totalPnl)}
            </span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <BarChart3 className="w-4 h-4" style={{ color: "var(--primary)" }} />
            <span style={{ fontSize: "0.875rem", color: "var(--text-muted)" }}>Positions:</span>
            <span style={{ fontWeight: 600, fontFamily: "ui-monospace, monospace" }}>{totalPositions}</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <span style={{ fontSize: "0.875rem", color: "var(--text-muted)" }}>Total Balance:</span>
            <span style={{ fontWeight: 600, fontFamily: "ui-monospace, monospace" }}>
              {formatCurrency(totalBalance)}
            </span>
          </div>
        </div>
      </div>

      {/* Sort Controls */}
      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
        <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>Sort by:</span>
        {(['pnl', 'winRate', 'trades', 'balance'] as SortField[]).map(field => (
          <button
            key={field}
            onClick={() => setSortBy(field)}
            style={{
              padding: "0.25rem 0.5rem",
              fontSize: "0.75rem",
              borderRadius: 4,
              border: sortBy === field ? "1px solid var(--primary)" : "1px solid var(--border)",
              background: sortBy === field ? "rgba(59, 130, 246, 0.1)" : "transparent",
              color: sortBy === field ? "var(--primary)" : "var(--text-muted)",
              cursor: "pointer"
            }}
          >
            {field.charAt(0).toUpperCase() + field.slice(1).replace(/([A-Z])/g, ' $1')}
          </button>
        ))}
      </div>

      {/* Bot Grid */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
        gap: "0.75rem"
      }}>
        {sortedBots.map(bot => (
          <BotStatusCard
            key={bot.id}
            bot={bot}
            yesPrice={yesPrice}
            positions={positions}
          />
        ))}
      </div>

      {/* Activity Feed */}
      <div className="glass-card" style={{ padding: "0.75rem" }}>
        <button
          onClick={() => setShowActivityFeed(!showActivityFeed)}
          style={{
            width: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            background: "transparent",
            border: "none",
            cursor: "pointer",
            color: "var(--text-secondary)",
            fontSize: "0.875rem"
          }}
        >
          <span style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <Activity className="w-4 h-4" />
            Activity Feed
            {botLogs.length > 0 && (
              <span style={{
                padding: "0.125rem 0.375rem",
                background: "var(--primary)",
                color: "white",
                borderRadius: 9999,
                fontSize: "0.625rem"
              }}>
                {botLogs.length}
              </span>
            )}
          </span>
          <span style={{ transform: showActivityFeed ? "rotate(180deg)" : "none", transition: "transform 0.2s" }}>
            ▼
          </span>
        </button>

        {showActivityFeed && (
          <div style={{
            marginTop: "0.75rem",
            maxHeight: 300,
            overflowY: "auto",
            display: "flex",
            flexDirection: "column",
            gap: "0.25rem"
          }}>
            {botLogs.length === 0 ? (
              <div style={{ textAlign: "center", padding: "1rem", color: "var(--text-muted)", fontSize: "0.875rem" }}>
                No recent activity
              </div>
            ) : (
              botLogs.slice(0, 20).map(log => (
                <div
                  key={log.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "0.5rem",
                    padding: "0.375rem 0.5rem",
                    background: "rgba(0,0,0,0.2)",
                    borderRadius: 6,
                    fontSize: "0.75rem"
                  }}
                >
                  <span style={{
                    width: 6,
                    height: 6,
                    borderRadius: "50%",
                    background: log.type === "TRADE" ? "#3b82f6" : log.type === "ERROR" ? "#ef4444" : "#f59e0b"
                  }} />
                  <span style={{ color: "var(--text-muted)", fontSize: "0.625rem" }}>
                    {new Date(log.timestamp).toLocaleTimeString()}
                  </span>
                  <span style={{ fontWeight: 500 }}>{log.botName}</span>
                  <span style={{ color: "var(--text-secondary)", flex: 1 }}>{log.message}</span>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify component compiles**

Run: `bun run build`
Expected: No TypeScript errors

- [ ] **Step 3: Commit LiveMonitorTab**

```bash
git add src/components/LiveMonitorTab.tsx
git commit -m "feat: add LiveMonitorTab with bot grid and activity feed"
```

---

### Task 5: Create useBotSessions Hook

**Files:**
- Create: `src/hooks/useBotSessions.ts`

- [ ] **Step 1: Create the useBotSessions hook**

```typescript
import { useState, useEffect, useCallback } from "react";
import type { BotSession } from "../types";

interface UseBotSessionsOptions {
  strategy?: string;
  limit?: number;
}

export function useBotSessions(options: UseBotSessionsOptions = {}) {
  const [sessions, setSessions] = useState<BotSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSessions = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (options.strategy) params.append("strategy", options.strategy);
      if (options.limit) params.append("limit", String(options.limit));

      const res = await fetch(`/api/sessions?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to fetch sessions");
      const data = await res.json();
      setSessions(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, [options.strategy, options.limit]);

  useEffect(() => {
    fetchSessions();
    // Refresh every 10 seconds
    const interval = setInterval(fetchSessions, 10000);
    return () => clearInterval(interval);
  }, [fetchSessions]);

  return { sessions, loading, error, refetch: fetchSessions };
}
```

- [ ] **Step 2: Verify hook compiles**

Run: `bun run build`
Expected: No TypeScript errors

- [ ] **Step 3: Commit useBotSessions**

```bash
git add src/hooks/useBotSessions.ts
git commit -m "feat: add useBotSessions hook for fetching session history"
```

---

## Chunk 3: Session History Tab

### Task 6: Create SessionDetailPanel Component

**Files:**
- Create: `src/components/SessionDetailPanel.tsx`

- [ ] **Step 1: Create the SessionDetailPanel component**

```typescript
import { useState } from "react";
import { X, TrendingUp, TrendingDown, Clock, Target } from "lucide-react";
import { formatCurrency } from "../lib/utils";
import type { BotSession } from "../types";

interface SessionDetailPanelProps {
  session: BotSession;
  onClose: () => void;
}

function formatDuration(ms: number): string {
  if (ms < 60000) return `${Math.floor(ms / 1000)}s`;
  if (ms < 3600000) return `${Math.floor(ms / 60000)}m ${Math.floor((ms % 60000) / 1000)}s`;
  return `${Math.floor(ms / 3600000)}h ${Math.floor((ms % 3600000) / 60000)}m`;
}

export function SessionDetailPanel({ session, onClose }: SessionDetailPanelProps) {
  const [showTrades, setShowTrades] = useState(false);
  const duration = session.endTime ? session.endTime - session.startTime : 0;
  const roi = session.startBalance > 0
    ? ((session.endBalance || 0) - session.startBalance) / session.startBalance * 100
    : 0;
  const pnl = (session.endBalance || 0) - session.startBalance;

  return (
    <div
      className="glass-card"
      style={{
        padding: "1rem",
        marginTop: "0.5rem",
        border: "1px solid var(--border)"
      }}
    >
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1rem" }}>
        <div>
          <h3 style={{ margin: 0, fontSize: "1rem", fontWeight: 600 }}>{session.botName}</h3>
          <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
            Session #{session.id.slice(-6)} • {session.strategy}
          </span>
        </div>
        <button
          onClick={onClose}
          style={{
            background: "transparent",
            border: "none",
            cursor: "pointer",
            color: "var(--text-muted)",
            padding: "0.25rem"
          }}
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Stats Grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "0.75rem", marginBottom: "1rem" }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: "0.625rem", color: "var(--text-muted)", marginBottom: "0.25rem" }}>Start</div>
          <div style={{ fontFamily: "ui-monospace, monospace", fontWeight: 600 }}>
            {formatCurrency(session.startBalance)}
          </div>
        </div>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: "0.625rem", color: "var(--text-muted)", marginBottom: "0.25rem" }}>End</div>
          <div style={{
            fontFamily: "ui-monospace, monospace",
            fontWeight: 600,
            color: pnl >= 0 ? "#22c55e" : "#ef4444"
          }}>
            {formatCurrency(session.endBalance || 0)}
          </div>
        </div>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: "0.625rem", color: "var(--text-muted)", marginBottom: "0.25rem" }}>P&L</div>
          <div style={{
            fontFamily: "ui-monospace, monospace",
            fontWeight: 600,
            color: pnl >= 0 ? "#22c55e" : "#ef4444"
          }}>
            {pnl >= 0 ? "+" : ""}{formatCurrency(pnl)}
          </div>
        </div>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: "0.625rem", color: "var(--text-muted)", marginBottom: "0.25rem" }}>ROI</div>
          <div style={{
            fontFamily: "ui-monospace, monospace",
            fontWeight: 600,
            color: roi >= 0 ? "#22c55e" : "#ef4444"
          }}>
            {roi >= 0 ? "+" : ""}{roi.toFixed(1)}%
          </div>
        </div>
      </div>

      {/* Additional Stats */}
      <div style={{ display: "flex", gap: "1.5rem", marginBottom: "1rem", fontSize: "0.75rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.25rem" }}>
          <Clock className="w-3 h-3" style={{ color: "var(--text-muted)" }} />
          <span style={{ color: "var(--text-muted)" }}>Duration:</span>
          <span>{formatDuration(duration)}</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "0.25rem" }}>
          <Target className="w-3 h-3" style={{ color: "var(--text-muted)" }} />
          <span style={{ color: "var(--text-muted)" }}>Trades:</span>
          <span>{session.totalTrades}</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "0.25rem" }}>
          {session.totalTrades > 0 ? (
            <>
              <TrendingUp className="w-3 h-3" style={{ color: "#22c55e" }} />
              <span style={{ color: "var(--text-muted)" }}>Win Rate:</span>
              <span>{((session.winningTrades / session.totalTrades) * 100).toFixed(0)}%</span>
            </>
          ) : (
            <span style={{ color: "var(--text-muted)" }}>No trades</span>
          )}
        </div>
      </div>

      {/* Timestamps */}
      <div style={{ fontSize: "0.625rem", color: "var(--text-muted)" }}>
        {new Date(session.startTime).toLocaleString()} → {session.endTime ? new Date(session.endTime).toLocaleString() : "Running"}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify component compiles**

Run: `bun run build`
Expected: No TypeScript errors

- [ ] **Step 3: Commit SessionDetailPanel**

```bash
git add src/components/SessionDetailPanel.tsx
git commit -m "feat: add SessionDetailPanel for viewing session details"
```

---

### Task 7: Create SessionHistoryTab Component

**Files:**
- Create: `src/components/SessionHistoryTab.tsx`

- [ ] **Step 1: Create the SessionHistoryTab component**

```typescript
import { useState, useMemo } from "react";
import { Clock, TrendingUp, TrendingDown, Download, Filter } from "lucide-react";
import { formatCurrency } from "../lib/utils";
import { useBotSessions } from "../hooks/useBotSessions";
import { SessionDetailPanel } from "./SessionDetailPanel";
import type { BotSession } from "../types";

type SortField = 'date' | 'pnl' | 'winRate' | 'trades';
type SortOrder = 'asc' | 'desc';

function formatDuration(ms: number): string {
  if (!ms) return "-";
  if (ms < 60000) return `${Math.floor(ms / 1000)}s`;
  if (ms < 3600000) return `${Math.floor(ms / 60000)}m`;
  return `${Math.floor(ms / 3600000)}h ${Math.floor((ms % 3600000) / 60000)}m`;
}

export function SessionHistoryTab() {
  const { sessions, loading, error, refetch } = useBotSessions();
  const [selectedSession, setSelectedSession] = useState<BotSession | null>(null);
  const [strategyFilter, setStrategyFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<SortField>('date');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');

  // Get unique strategies
  const strategies = useMemo(() => {
    const unique = new Set(sessions.map(s => s.strategy));
    return ["all", ...Array.from(unique)];
  }, [sessions]);

  // Filter and sort sessions
  const filteredSessions = useMemo(() => {
    let result = [...sessions];

    // Filter by strategy
    if (strategyFilter !== "all") {
      result = result.filter(s => s.strategy === strategyFilter);
    }

    // Sort
    result.sort((a, b) => {
      let comparison = 0;
      switch (sortBy) {
        case 'date':
          comparison = a.startTime - b.startTime;
          break;
        case 'pnl':
          comparison = (a.endBalance || 0) - (b.startBalance) - ((b.endBalance || 0) - b.startBalance);
          break;
        case 'winRate':
          const aWR = a.totalTrades > 0 ? a.winningTrades / a.totalTrades : 0;
          const bWR = b.totalTrades > 0 ? b.winningTrades / b.totalTrades : 0;
          comparison = aWR - bWR;
          break;
        case 'trades':
          comparison = a.totalTrades - b.totalTrades;
          break;
      }
      return sortOrder === 'desc' ? -comparison : comparison;
    });

    return result;
  }, [sessions, strategyFilter, sortBy, sortOrder]);

  // Export to CSV
  const exportCSV = () => {
    const headers = ["Bot", "Strategy", "Start Time", "End Time", "Duration", "Trades", "Wins", "Losses", "P&L", "ROI%"];
    const rows = filteredSessions.map(s => {
      const pnl = (s.endBalance || 0) - s.startBalance;
      const roi = s.startBalance > 0 ? ((s.endBalance || 0) - s.startBalance) / s.startBalance * 100 : 0;
      return [
        s.botName,
        s.strategy,
        new Date(s.startTime).toISOString(),
        s.endTime ? new Date(s.endTime).toISOString() : "",
        s.endTime ? formatDuration(s.endTime - s.startTime) : "",
        s.totalTrades,
        s.winningTrades,
        s.losingTrades,
        pnl.toFixed(2),
        roi.toFixed(2)
      ].join(",");
    });

    const csv = [headers.join(","), ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `bot-sessions-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div style={{ textAlign: "center", padding: "2rem", color: "var(--text-muted)" }}>
        Loading sessions...
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ textAlign: "center", padding: "2rem", color: "#ef4444" }}>
        Error: {error}
        <button onClick={refetch} style={{ marginLeft: "1rem" }}>Retry</button>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
      {/* Filters */}
      <div className="glass-card" style={{ padding: "0.75rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "1rem", flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <Filter className="w-4 h-4" style={{ color: "var(--text-muted)" }} />
            <select
              value={strategyFilter}
              onChange={(e) => setStrategyFilter(e.target.value)}
              style={{
                padding: "0.25rem 0.5rem",
                borderRadius: 4,
                border: "1px solid var(--border)",
                background: "var(--glass-bg)",
                color: "var(--text-secondary)",
                fontSize: "0.75rem"
              }}
            >
              {strategies.map(s => (
                <option key={s} value={s}>{s === "all" ? "All Strategies" : s}</option>
              ))}
            </select>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>Sort:</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortField)}
              style={{
                padding: "0.25rem 0.5rem",
                borderRadius: 4,
                border: "1px solid var(--border)",
                background: "var(--glass-bg)",
                color: "var(--text-secondary)",
                fontSize: "0.75rem"
              }}
            >
              <option value="date">Date</option>
              <option value="pnl">P&L</option>
              <option value="winRate">Win Rate</option>
              <option value="trades">Trades</option>
            </select>
            <button
              onClick={() => setSortOrder(o => o === 'asc' ? 'desc' : 'asc')}
              style={{
                padding: "0.25rem 0.5rem",
                borderRadius: 4,
                border: "1px solid var(--border)",
                background: "var(--glass-bg)",
                color: "var(--text-secondary)",
                fontSize: "0.75rem",
                cursor: "pointer"
              }}
            >
              {sortOrder === 'desc' ? '↓' : '↑'}
            </button>
          </div>

          <button
            onClick={exportCSV}
            disabled={filteredSessions.length === 0}
            style={{
              marginLeft: "auto",
              display: "flex",
              alignItems: "center",
              gap: "0.25rem",
              padding: "0.25rem 0.5rem",
              borderRadius: 4,
              border: "1px solid var(--border)",
              background: "var(--glass-bg)",
              color: "var(--text-secondary)",
              fontSize: "0.75rem",
              cursor: filteredSessions.length > 0 ? "pointer" : "not-allowed",
              opacity: filteredSessions.length > 0 ? 1 : 0.5
            }}
          >
            <Download className="w-3 h-3" />
            Export CSV
          </button>
        </div>
      </div>

      {/* Sessions Table */}
      <div className="glass-card" style={{ padding: "0.5rem" }}>
        {filteredSessions.length === 0 ? (
          <div style={{ textAlign: "center", padding: "2rem", color: "var(--text-muted)" }}>
            No sessions found. Start some bots to see session history.
          </div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.875rem" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid var(--border)" }}>
                <th style={{ textAlign: "left", padding: "0.5rem", color: "var(--text-muted)", fontWeight: 500 }}>Bot</th>
                <th style={{ textAlign: "left", padding: "0.5rem", color: "var(--text-muted)", fontWeight: 500 }}>Strategy</th>
                <th style={{ textAlign: "right", padding: "0.5rem", color: "var(--text-muted)", fontWeight: 500 }}>Duration</th>
                <th style={{ textAlign: "right", padding: "0.5rem", color: "var(--text-muted)", fontWeight: 500 }}>Trades</th>
                <th style={{ textAlign: "right", padding: "0.5rem", color: "var(--text-muted)", fontWeight: 500 }}>P&L</th>
                <th style={{ textAlign: "right", padding: "0.5rem", color: "var(--text-muted)", fontWeight: 500 }}>Win%</th>
              </tr>
            </thead>
            <tbody>
              {filteredSessions.map(session => {
                const pnl = (session.endBalance || 0) - session.startBalance;
                const winRate = session.totalTrades > 0
                  ? (session.winningTrades / session.totalTrades * 100)
                  : 0;
                const duration = session.endTime
                  ? session.endTime - session.startTime
                  : 0;
                const isSelected = selectedSession?.id === session.id;

                return (
                  <tr
                    key={session.id}
                    onClick={() => setSelectedSession(isSelected ? null : session)}
                    style={{
                      cursor: "pointer",
                      background: isSelected ? "rgba(59, 130, 246, 0.1)" : "transparent",
                      borderBottom: "1px solid var(--border)"
                    }}
                  >
                    <td style={{ padding: "0.5rem" }}>{session.botName}</td>
                    <td style={{ padding: "0.5rem" }}>
                      <span style={{
                        fontSize: "0.625rem",
                        padding: "0.125rem 0.375rem",
                        borderRadius: 4,
                        background: "rgba(59, 130, 246, 0.2)",
                        color: "#3b82f6"
                      }}>
                        {session.strategy}
                      </span>
                    </td>
                    <td style={{ padding: "0.5rem", textAlign: "right", fontFamily: "ui-monospace, monospace" }}>
                      {formatDuration(duration)}
                    </td>
                    <td style={{ padding: "0.5rem", textAlign: "right", fontFamily: "ui-monospace, monospace" }}>
                      {session.totalTrades}
                    </td>
                    <td style={{
                      padding: "0.5rem",
                      textAlign: "right",
                      fontFamily: "ui-monospace, monospace",
                      fontWeight: 600,
                      color: pnl >= 0 ? "#22c55e" : "#ef4444"
                    }}>
                      {pnl >= 0 ? "+" : ""}{formatCurrency(pnl)}
                    </td>
                    <td style={{ padding: "0.5rem", textAlign: "right", fontFamily: "ui-monospace, monospace" }}>
                      {session.totalTrades > 0 ? `${winRate.toFixed(0)}%` : "-"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Session Detail Panel */}
      {selectedSession && (
        <SessionDetailPanel
          session={selectedSession}
          onClose={() => setSelectedSession(null)}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify component compiles**

Run: `bun run build`
Expected: No TypeScript errors

- [ ] **Step 3: Commit SessionHistoryTab**

```bash
git add src/components/SessionHistoryTab.tsx
git commit -m "feat: add SessionHistoryTab with filters and export"
```

---

## Chunk 4: Main Dashboard Page

### Task 8: Create BotDashboardPage Component

**Files:**
- Create: `src/components/BotDashboardPage.tsx`

- [ ] **Step 1: Create the BotDashboardPage component**

```typescript
import { useState, useEffect } from "react";
import { BarChart3, Activity } from "lucide-react";
import { LiveMonitorTab } from "./LiveMonitorTab";
import { SessionHistoryTab } from "./SessionHistoryTab";
import { useTradingData } from "../hooks/useTradingData";

type Tab = 'live' | 'history';

interface BotDashboardPageProps {
  onBack: () => void;
}

export function BotDashboardPage({ onBack }: BotDashboardPageProps) {
  const [activeTab, setActiveTab] = useState<Tab>('live');
  const {
    bots,
    botLogs,
    yesPrice,
    loading
  } = useTradingData();

  // Fetch positions for live monitor
  const [positions, setPositions] = useState<Array<{
    id: string;
    botId?: string;
    outcome: "YES" | "NO";
    amount: number;
    stake: number;
  }>>([]);

  useEffect(() => {
    const fetchPositions = async () => {
      try {
        const res = await fetch("/api/positions");
        const data = await res.json();
        setPositions(data.open || []);
      } catch (err) {
        console.error("Failed to fetch positions:", err);
      }
    };

    fetchPositions();
    const interval = setInterval(fetchPositions, 3000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div style={{ textAlign: "center", padding: "4rem", color: "var(--text-muted)" }}>
        <div className="loading-spinner" style={{ margin: "0 auto 1rem" }} />
        Loading bot dashboard...
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
      {/* Tab Header */}
      <div style={{
        display: "flex",
        alignItems: "center",
        gap: "0.5rem",
        borderBottom: "1px solid var(--border)",
        paddingBottom: "0.5rem"
      }}>
        <button
          onClick={() => setActiveTab('live')}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.5rem",
            padding: "0.5rem 1rem",
            borderRadius: "8px 8px 0 0",
            border: "none",
            background: activeTab === 'live' ? "var(--glass-bg)" : "transparent",
            color: activeTab === 'live' ? "var(--text-primary)" : "var(--text-muted)",
            fontWeight: activeTab === 'live' ? 600 : 400,
            cursor: "pointer",
            borderBottom: activeTab === 'live' ? "2px solid var(--primary)" : "none"
          }}
        >
          <Activity className="w-4 h-4" />
          Live Monitor
        </button>
        <button
          onClick={() => setActiveTab('history')}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.5rem",
            padding: "0.5rem 1rem",
            borderRadius: "8px 8px 0 0",
            border: "none",
            background: activeTab === 'history' ? "var(--glass-bg)" : "transparent",
            color: activeTab === 'history' ? "var(--text-primary)" : "var(--text-muted)",
            fontWeight: activeTab === 'history' ? 600 : 400,
            cursor: "pointer",
            borderBottom: activeTab === 'history' ? "2px solid var(--primary)" : "none"
          }}
        >
          <BarChart3 className="w-4 h-4" />
          Session History
        </button>
      </div>

      {/* Tab Content */}
      {activeTab === 'live' ? (
        <LiveMonitorTab
          bots={bots}
          botLogs={botLogs}
          yesPrice={yesPrice}
          positions={positions}
        />
      ) : (
        <SessionHistoryTab />
      )}
    </div>
  );
}
```

- [ ] **Step 2: Update App.tsx to use BotDashboardPage**

```typescript
// Add import at top of App.tsx
import { BotDashboardPage } from "./BotDashboardPage";

// In the route === 'bots' return block, replace the placeholder with:
if (route === 'bots') {
  return (
    <div style={{ minHeight: "100vh", background: "hsl(222, 47%, 4%)" }}>
      <Header
        isBotRunning={isBotRunning}
        apiLatency={apiLatency}
        coinColor={coinColor}
        onRefresh={fetchData}
        showBackButton
        onBack={() => navigate('trading')}
      />
      <main style={{ padding: "1rem", maxWidth: 1400, margin: "0 auto" }}>
        <BotDashboardPage onBack={() => navigate('trading')} />
      </main>
    </div>
  );
}
```

- [ ] **Step 3: Run full integration test**

Run: `bun dev`
Expected:
1. Main trading page loads with "Bots" button in header
2. Clicking "Bots" navigates to dashboard with tabs
3. Live Monitor shows bot grid with real data
4. Session History shows sessions table (may be empty initially)
5. Back button returns to trading page

- [ ] **Step 4: Commit BotDashboardPage**

```bash
git add src/components/BotDashboardPage.tsx src/components/App.tsx
git commit -m "feat: add BotDashboardPage with Live Monitor and Session History tabs"
```

---

### Task 9: Final Integration & Polish

**Files:**
- Modify: `src/components/Header.tsx`
- Modify: `src/styles/globals.css` (if needed)

- [ ] **Step 1: Add link to BotManager panel**

Read the BotManager component (or BotPanel) and add a link to the dashboard in the footer:

```typescript
// In BotPanel.tsx or BotManager.tsx, add after the logs section:
<div style={{ marginTop: "1rem", textAlign: "center" }}>
  <button
    onClick={() => window.location.hash = 'bots'}
    style={{
      fontSize: "0.75rem",
      color: "var(--primary)",
      background: "transparent",
      border: "none",
      cursor: "pointer",
      textDecoration: "underline"
    }}
  >
    View Full Dashboard →
  </button>
</div>
```

- [ ] **Step 2: Add responsive styles for bot grid**

Add to `src/styles/globals.css`:

```css
/* Bot Dashboard Responsive Grid */
@media (max-width: 768px) {
  .bot-status-grid {
    grid-template-columns: 1fr !important;
  }
}

@media (min-width: 769px) and (max-width: 1024px) {
  .bot-status-grid {
    grid-template-columns: repeat(2, 1fr) !important;
  }
}

@media (min-width: 1025px) {
  .bot-status-grid {
    grid-template-columns: repeat(3, 1fr) !important;
  }
}
```

- [ ] **Step 3: Run full build and test**

Run: `bun run build && bun dev`
Expected: No errors, app works with new dashboard

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "feat: complete Bot Analytics Dashboard with live monitoring and session history

- Add /bots route with client-side navigation
- Live Monitor tab with bot status grid and activity feed
- Session History tab with filters, sorting, and CSV export
- Bot status cards showing real-time balance, PnL, positions
- Session detail panel for historical analysis"
```

---

## Summary

This plan creates a complete Bot Analytics Dashboard with:

1. **Client-side routing** using hash-based navigation
2. **Live Monitor tab** showing real-time bot status in a responsive grid
3. **Session History tab** with filtering, sorting, and CSV export
4. **Reusable components** for bot cards and session details
5. **Integration** with existing hooks and API endpoints

**Total estimated tasks:** 9
**New files created:** 7
**Modified files:** 3

The implementation follows existing patterns in the codebase and uses the established glass-card styling for visual consistency.
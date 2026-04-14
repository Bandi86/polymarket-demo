'use client'

import { useState, useCallback } from "react";
import { ArrowUpDown, TrendingUp, TrendingDown, Target, Flame, Play, Square } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { BotStatusCard } from "@/components/BotStatusCard";
import { BotConfigPanel } from "@/components/BotConfigPanel";
import type { BotData } from "@/hooks/useTradingData";
import type { BotLog, Position } from "@/types";
import { motion, AnimatePresence } from "framer-motion";

interface LiveMonitorTabProps {
  bots: BotData[];
  botLogs: BotLog[];
  yesPrice: number;
  positions: Position[];
  updateBotState: (botId: string, updates: Partial<BotData>) => void;
  timeRemaining: number;
  fetchData?: () => Promise<void>;
}

type SortField = 'pnl' | 'winRate' | 'trades' | 'balance' | 'ev';

const SORT_OPTIONS: { field: SortField; label: string }[] = [
  { field: 'pnl', label: 'P&L' },
  { field: 'balance', label: 'Balance' },
  { field: 'winRate', label: 'Win Rate' },
  { field: 'trades', label: 'Trades' },
  { field: 'ev', label: 'Expected Value' },
];

export function LiveMonitorTab({ bots, botLogs, yesPrice, positions, updateBotState, timeRemaining, fetchData }: LiveMonitorTabProps) {
  const [sortBy, setSortBy] = useState<SortField>('pnl');
  const [configBot, setConfigBot] = useState<BotData | null>(null);
  const [selectedBots, setSelectedBots] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(false);
  const [showOnlyRunning, setShowOnlyRunning] = useState(false);

  // Toggle bot selection
  const toggleBotSelection = useCallback((botId: string) => {
    setSelectedBots(prev => {
      const next = new Set(prev);
      if (next.has(botId)) {
        next.delete(botId);
      } else {
        next.add(botId);
      }
      return next;
    });
  }, []);

  // Select all / Deselect all
  const selectAllBots = useCallback(() => {
    setSelectedBots(new Set(bots.map(b => b.id)));
  }, [bots]);

  const deselectAllBots = useCallback(() => {
    setSelectedBots(new Set());
  }, []);

  // Run selected bots
  const handleRunSelected = useCallback(async () => {
    if (selectedBots.size === 0) return;
    setIsLoading(true);
    try {
      await fetch("/api/bots/run-selected", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ botIds: Array.from(selectedBots), betSize: 1 })
      });
      if (fetchData) await fetchData();
    } catch (err) {
      console.error("Failed to run selected bots:", err);
    } finally {
      setIsLoading(false);
    }
  }, [selectedBots, fetchData]);

  // Stop selected bots
  const handleStopSelected = useCallback(async () => {
    if (selectedBots.size === 0) return;
    setIsLoading(true);
    try {
      await fetch("/api/bots/stop-selected", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ botIds: Array.from(selectedBots) })
      });
      if (fetchData) await fetchData();
    } catch (err) {
      console.error("Failed to stop selected bots:", err);
    } finally {
      setIsLoading(false);
    }
  }, [selectedBots, fetchData]);

  // Count bots with YES/NO open positions (not just "active bots minus YES")
  const botIdsWithYes = new Set(positions.filter(p => p.outcome === "YES").map(p => p.botId).filter(Boolean));
  const botIdsWithNo = new Set(positions.filter(p => p.outcome === "NO").map(p => p.botId).filter(Boolean));
  const activeBotsYes = botIdsWithYes.size;
  const activeBotsNo = botIdsWithNo.size;

  // Count enabled/running bots
  const runningBotsCount = bots.filter(b => b.enabled).length;

  // Open positions stats
  const openPositions = positions.filter(p => p.botId);
  // FIX: openPositionsValue should be total dollars at risk (amount + fee), NOT stake (shares)
  const openPositionsValue = openPositions.reduce((sum, p) => sum + p.amount + (p.fee || 0), 0);
  const yesPositions = openPositions.filter(p => p.outcome === "YES");
  const noPositions = openPositions.filter(p => p.outcome === "NO");
  // stake = shares (payout if wins), amount = dollars invested
  const yesStake = yesPositions.reduce((sum, p) => sum + p.stake, 0);
  const noStake = noPositions.reduce((sum, p) => sum + p.stake, 0);
  const yesAmount = yesPositions.reduce((sum, p) => sum + p.amount, 0);
  const noAmount = noPositions.reduce((sum, p) => sum + p.amount, 0);

  // Net outcome scenarios:
  // If YES wins: YES positions pay out stake, NO positions lose their amount
  // Net = yesStake - yesAmount - noAmount (payout minus all costs)
  // If NO wins: NO positions pay out stake, YES positions lose their amount
  // Net = noStake - noAmount - yesAmount
  const netIfYesWins = yesStake - yesAmount - noAmount;
  const netIfNoWins = noStake - noAmount - yesAmount;

  // Best streak
  const maxStreak = Math.max(...bots.map(b => b.stats?.maxConsecutiveWins || 0), 0);

  // System Expected Value (EV) calculations
  const calculateEV = (b: BotData) => {
    const winRate = b.stats.trades > 0 ? (b.stats.wins / b.stats.trades) : 0;
    return (winRate * (b.stats.avgWin || 0)) - ((1 - winRate) * (b.stats.avgLoss || 0));
  };

  // Sort bots - optionally filter to show only running bots
  const displayBots = showOnlyRunning ? bots.filter(b => b.enabled) : bots;
  const sortedBots = [...displayBots].sort((a, b) => {
    switch (sortBy) {
      case 'pnl':
        return b.stats.pnl - a.stats.pnl;
      case 'winRate':
        return b.stats.winRate - a.stats.winRate;
      case 'trades':
        return b.stats.trades - a.stats.trades;
      case 'balance':
        return b.portfolio.balance - a.portfolio.balance;
      case 'ev':
        return calculateEV(b) - calculateEV(a);
      default:
        return 0;
    }
  });

  // Toggle individual bot
  const handleToggleBot = useCallback(async (botId: string) => {
    try {
      console.log(`[UI] Toggle bot: ${botId}`);
      const res = await fetch(`/api/bots/${botId}/toggle`, { method: "POST" });
      const data = await res.json();

      if (!res.ok) {
        console.error(`[UI] Toggle failed for ${botId}:`, data);
        alert(`Failed to toggle bot: ${data.error || 'Unknown error'}`);
        return;
      }

      console.log(`[UI] Toggle success for ${botId}: enabled=${data.enabled}, balance=${data.portfolio?.balance}`);

      // Update local state immediately
      updateBotState(botId, { enabled: data.enabled, runTime: data.runTime });

      // Refresh all data from server to ensure consistency
      if (fetchData) {
        await fetchData();

        // After fetch, manually update the specific bot from server response
        // because fetchData might have stale data
        const botsRes = await fetch('/api/bots');
        const botsData = await botsRes.json();
        const updatedBot = botsData.find((b: BotData) => b.id === botId);
        if (updatedBot) {
          console.log(`[UI] Syncing bot ${botId} from server: enabled=${updatedBot.enabled}, balance=${updatedBot.portfolio?.balance}`);
          updateBotState(botId, { enabled: updatedBot.enabled, runTime: updatedBot.runTime });
        }
      }
    } catch (err) {
      console.error("Failed to toggle bot:", err);
      alert(`Failed to toggle bot: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  }, [updateBotState, fetchData]);

  // Update bot config
  const handleSaveConfig = useCallback(async (botId: string, config: Partial<BotData>) => {
    try {
      const res = await fetch(`/api/bots/${botId}/config`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config)
      });
      if (!res.ok) throw new Error("Failed to update config");
    } catch (err) {
      console.error("Failed to update config:", err);
    }
  }, []);

  const container = {
    hidden: { opacity: 0 },
    show: { opacity: 1, transition: { staggerChildren: 0.05 } }
  };

  const item = {
    hidden: { opacity: 0, scale: 0.95, y: 15 },
    show: { opacity: 1, scale: 1, y: 0, transition: { type: "spring" as const, stiffness: 300, damping: 24 } }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
      {/* Summary Stats Bar */}
      <div style={{
        display: "flex",
        alignItems: "center",
        gap: "2rem",
        padding: "1rem 1.25rem",
        background: "rgba(15,23,42,0.5)",
        borderRadius: "14px",
        border: "1px solid rgba(255,255,255,0.06)",
        flexWrap: "wrap",
      }}>
        {/* Active Bots Distribution */}
        <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <TrendingUp style={{ width: 16, height: 16, color: "#22c55e" }} />
            <span style={{ fontSize: "0.8rem", color: "#22c55e", fontWeight: 700 }}>{activeBotsYes} UP</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <TrendingDown style={{ width: 16, height: 16, color: "#ef4444" }} />
            <span style={{ fontSize: "0.8rem", color: "#ef4444", fontWeight: 700 }}>{activeBotsNo} DOWN</span>
          </div>
          {/* Running bots count */}
          {runningBotsCount > 0 && (
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginLeft: "0.5rem", paddingLeft: "0.75rem", borderLeft: "1px solid rgba(255,255,255,0.1)" }}>
              <Play style={{ width: 14, height: 14, color: "#22c55e" }} />
              <span style={{ fontSize: "0.8rem", color: "#22c55e", fontWeight: 700 }}>{runningBotsCount} running</span>
            </div>
          )}
        </div>

        <div style={{ width: 1, height: 24, background: "rgba(255,255,255,0.1)" }} />

        {/* Open Positions Value */}
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <Target style={{ width: 16, height: 16, color: "#f59e0b" }} />
          <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>Open:</span>
          <span style={{ fontSize: "0.9rem", fontWeight: 700, fontFamily: "ui-monospace, monospace" }}>
            {formatCurrency(openPositionsValue)}
          </span>
        </div>

        {/* Potential Outcomes */}
        {openPositionsValue > 0 && (
          <>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <span style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>If UP wins:</span>
              <span style={{
                fontSize: "0.85rem",
                fontWeight: 700,
                fontFamily: "ui-monospace, monospace",
                color: netIfYesWins >= 0 ? "#22c55e" : "#ef4444"
              }}>
                {netIfYesWins >= 0 ? "+" : ""}{formatCurrency(netIfYesWins)}
              </span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <span style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>If DOWN wins:</span>
              <span style={{
                fontSize: "0.85rem",
                fontWeight: 700,
                fontFamily: "ui-monospace, monospace",
                color: netIfNoWins >= 0 ? "#22c55e" : "#ef4444"
              }}>
                {netIfNoWins >= 0 ? "+" : ""}{formatCurrency(netIfNoWins)}
              </span>
            </div>
          </>
        )}

        {/* Best Streak */}
        {maxStreak > 0 && (
          <>
            <div style={{ width: 1, height: 24, background: "rgba(255,255,255,0.1)" }} />
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <Flame style={{ width: 16, height: 16, color: "#fb923c" }} />
              <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>Best Streak:</span>
              <span style={{ fontSize: "0.9rem", fontWeight: 700, color: "#fb923c" }}>{maxStreak} wins</span>
            </div>
          </>
        )}

        {/* Sort Controls */}
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginLeft: "auto" }}>
          <ArrowUpDown style={{ width: 14, height: 14, color: "var(--text-muted)" }} />
          <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>Sort:</span>
          <div style={{ display: "flex", gap: "0.25rem" }}>
            {SORT_OPTIONS.map(opt => (
              <button
                key={opt.field}
                onClick={() => setSortBy(opt.field)}
                style={{
                  padding: "0.375rem 0.625rem",
                  borderRadius: 6,
                  fontSize: "0.7rem",
                  fontWeight: 600,
                  background: sortBy === opt.field ? "rgba(59, 130, 246, 0.15)" : "rgba(255,255,255,0.04)",
                  color: sortBy === opt.field ? "#3b82f6" : "var(--text-muted)",
                  border: sortBy === opt.field ? "1px solid rgba(59, 130, 246, 0.3)" : "1px solid transparent",
                  cursor: "pointer",
                }}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Filter: Show Running Only */}
        <button
          onClick={() => setShowOnlyRunning(!showOnlyRunning)}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.375rem",
            padding: "0.375rem 0.625rem",
            borderRadius: 6,
            fontSize: "0.7rem",
            fontWeight: 600,
            background: showOnlyRunning ? "rgba(34, 197, 94, 0.15)" : "rgba(255,255,255,0.04)",
            color: showOnlyRunning ? "#22c55e" : "var(--text-muted)",
            border: showOnlyRunning ? "1px solid rgba(34, 197, 94, 0.3)" : "1px solid transparent",
            cursor: "pointer",
          }}
        >
          <span style={{ width: 6, height: 6, borderRadius: "50%", background: showOnlyRunning ? "#22c55e" : "var(--text-muted)" }} />
          {showOnlyRunning ? "Running" : "All"}
        </button>

        {/* Multi-Select Controls */}
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", paddingLeft: "1rem", borderLeft: "1px solid rgba(255,255,255,0.1)" }}>
          <span style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>Select:</span>
          <button
            onClick={selectAllBots}
            style={{
              padding: "0.25rem 0.5rem",
              borderRadius: 4,
              fontSize: "0.65rem",
              fontWeight: 600,
              background: "rgba(59, 130, 246, 0.1)",
              color: "#3b82f6",
              border: "1px solid rgba(59, 130, 246, 0.2)",
              cursor: "pointer",
            }}
          >
            All
          </button>
          <button
            onClick={deselectAllBots}
            style={{
              padding: "0.25rem 0.5rem",
              borderRadius: 4,
              fontSize: "0.65rem",
              fontWeight: 600,
              background: "rgba(255,255,255,0.05)",
              color: "var(--text-muted)",
              border: "1px solid rgba(255,255,255,0.1)",
              cursor: "pointer",
            }}
          >
            None
          </button>
          {selectedBots.size > 0 && (
            <>
              <span style={{ fontSize: "0.7rem", color: "#3b82f6", fontWeight: 600, marginLeft: "0.25rem" }}>
                {selectedBots.size} selected (${bots.filter(b => selectedBots.has(b.id)).reduce((sum, b) => sum + (b.portfolio?.balance || 0), 0).toFixed(2)})
              </span>
              <button
                onClick={handleRunSelected}
                disabled={isLoading}
                style={{
                  padding: "0.25rem 0.5rem",
                  borderRadius: 4,
                  fontSize: "0.65rem",
                  fontWeight: 600,
                  background: "linear-gradient(135deg, #22c55e, #16a34a)",
                  color: "white",
                  border: "none",
                  cursor: isLoading ? "not-allowed" : "pointer",
                  opacity: isLoading ? 0.7 : 1,
                  display: "flex",
                  alignItems: "center",
                  gap: "0.25rem",
                }}
              >
                <Play style={{ width: 10, height: 10 }} />Run
              </button>
              <button
                onClick={handleStopSelected}
                disabled={isLoading}
                style={{
                  padding: "0.25rem 0.5rem",
                  borderRadius: 4,
                  fontSize: "0.65rem",
                  fontWeight: 600,
                  background: "linear-gradient(135deg, #ef4444, #dc2626)",
                  color: "white",
                  border: "none",
                  cursor: isLoading ? "not-allowed" : "pointer",
                  opacity: isLoading ? 0.7 : 1,
                  display: "flex",
                  alignItems: "center",
                  gap: "0.25rem",
                }}
              >
                <Square style={{ width: 10, height: 10 }} />Stop
              </button>
            </>
          )}
        </div>
      </div>

      {/* Bot Grid */}
      <motion.div
        variants={container}
        initial="hidden"
        animate="show"
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(460px, 1fr))",
          gap: "1.5rem"
        }}
      >
        <AnimatePresence>
          {sortedBots.map(bot => (
            <motion.div key={bot.id} variants={item} layout>
              <BotStatusCard
                bot={bot}
                yesPrice={yesPrice}
                positions={positions}
                onToggle={handleToggleBot}
                onOpenConfig={setConfigBot}
                timeRemaining={timeRemaining}
                isSelected={selectedBots.has(bot.id)}
                onSelect={toggleBotSelection}
              />
            </motion.div>
          ))}
        </AnimatePresence>
      </motion.div>

      {/* Activity Feed Drawer */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="glass-card"
        style={{ padding: "1.25rem", borderRadius: "16px", background: "rgba(10, 15, 25, 0.4)", border: "1px solid rgba(255, 255, 255, 0.08)" }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.75rem" }}>
          <span style={{ fontSize: "0.85rem", fontWeight: 600, color: "var(--text-primary)" }}>Activity Log</span>
          <span style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>{botLogs.length} events</span>
        </div>
        <div style={{
          maxHeight: 280,
          overflowY: "auto",
          display: "flex",
          flexDirection: "column",
          gap: "0.5rem",
          paddingRight: "0.5rem"
        }}>
          {botLogs.length === 0 ? (
            <div style={{ textAlign: "center", padding: "2rem", color: "var(--text-muted)", fontSize: "0.875rem" }}>
              No recent activity
            </div>
          ) : (
            botLogs.slice(0, 20).map(log => (
              <motion.div
                key={log.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.75rem",
                  padding: "0.75rem 1rem",
                  background: log.type === "TRADE" ? "rgba(59, 130, 246, 0.08)" : log.type === "ERROR" ? "rgba(239, 68, 68, 0.08)" : log.type === "SETTLED" ? "rgba(34, 197, 94, 0.08)" : "rgba(255,255,255,0.03)",
                  borderRadius: 12,
                  fontSize: "0.75rem",
                  border: `1px solid ${log.type === "TRADE" ? "rgba(59, 130, 246, 0.15)" : log.type === "ERROR" ? "rgba(239, 68, 68, 0.15)" : log.type === "SETTLED" ? "rgba(34, 197, 94, 0.15)" : "rgba(255,255,255,0.05)"}`,
                }}
              >
                <div style={{ flex: 1 }}>
                  <span style={{ fontWeight: 600, color: "var(--text-primary)" }}>{log.botName}</span>
                  <span style={{ color: "var(--text-muted)", marginLeft: "0.5rem" }}>
                    {log.type === "TRADE" && log.details && typeof log.details.outcome === 'string' && (
                      <>
                        bought <span style={{ color: log.details.outcome === "YES" ? "#22c55e" : "#ef4444", fontWeight: 600 }}>{log.details.outcome}</span>
                        {" "}${Number(log.details.amount || log.details.stake || 0).toFixed(2)} @ {(Number(log.details.odds || log.details.price || 0) * 100).toFixed(1)}¢
                      </>
                    )}
                    {log.type === "SETTLED" && (
                      <>
                        {log.details?.won ? "✅ Won" : "❌ Lost"} {formatCurrency(Math.abs(Number(log.details?.pnl || 0)))}
                      </>
                    )}
                  </span>
                </div>
                <span style={{ fontSize: "0.65rem", color: "var(--text-muted)" }}>
                  {new Date(log.timestamp || Date.now()).toLocaleTimeString()}
                </span>
              </motion.div>
            ))
          )}
        </div>
      </motion.div>

      {/* Config Modal */}
      {configBot && (
        <BotConfigPanel
          bot={configBot}
          onClose={() => setConfigBot(null)}
          onSave={handleSaveConfig}
        />
      )}
    </div>
  );
}
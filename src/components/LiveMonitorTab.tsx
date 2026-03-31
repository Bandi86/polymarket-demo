'use client'

import { useState, useCallback } from "react";
import { Activity, Target, DollarSign, BarChart3, TrendingUp, TrendingDown, Zap } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { BotStatusCard } from "@/components/BotStatusCard";
import { BotConfigPanel } from "@/components/BotConfigPanel";
import type { BotData, CompetitionState } from "@/hooks/useTradingData";
import type { BotLog } from "@/types";
import { motion, AnimatePresence } from "framer-motion";

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
    odds: number;
    fee?: number;
  }>;
  updateBotState: (botId: string, updates: Partial<BotData>) => void;
  timeRemaining: number;
  competition?: CompetitionState | null;
}

type SortField = 'pnl' | 'winRate' | 'trades' | 'balance' | 'ev';

export function LiveMonitorTab({ bots, botLogs, yesPrice, positions, updateBotState, timeRemaining, competition }: LiveMonitorTabProps) {
  const [sortBy, setSortBy] = useState<SortField>('pnl');
  const [showActivityFeed, setShowActivityFeed] = useState(true);
  const [configBot, setConfigBot] = useState<BotData | null>(null);

  // Calculate summary stats
  const activeBots = bots.filter(b => b.enabled);

  // Active bots stats (what matters when running manually)
  const activeBalance = activeBots.reduce((sum, b) => sum + b.portfolio.balance, 0);
  const activeInitialBalance = activeBots.length * 10;
  const activePnl = activeBots.reduce((sum, b) => sum + b.stats.pnl, 0);

  // All bots stats (for overview)
  const totalBalance = bots.reduce((sum, b) => sum + b.portfolio.balance, 0);
  const totalPnl = bots.reduce((sum, b) => sum + b.stats.pnl, 0);
  const totalTrades = bots.reduce((sum, b) => sum + b.stats.trades, 0);
  const totalWins = bots.reduce((sum, b) => sum + b.stats.wins, 0);
  const totalLosses = bots.reduce((sum, b) => sum + b.stats.losses, 0);
  const totalWinRate = totalTrades > 0 ? totalWins / totalTrades : 0;
  const avgPnlPerTrade = totalTrades > 0 ? totalPnl / totalTrades : 0;
  const totalPositions = positions.filter(p => p.botId).length;
  const positionsValue = positions.reduce((sum, p) => sum + (p.amount || p.stake || 0), 0);

  // System Expected Value (EV) calculations
  const calculateEV = (b: BotData) => {
    const winRate = b.stats.trades > 0 ? (b.stats.wins / b.stats.trades) : 0;
    return (winRate * (b.stats.avgWin || 0)) - ((1 - winRate) * (b.stats.avgLoss || 0));
  };
  const activeEV = activeBots.reduce((sum, b) => sum + calculateEV(b), 0);
  const totalEV = bots.reduce((sum, b) => sum + calculateEV(b), 0);

  // Growth calculation: use active bots if any are running, otherwise show total
  const showActiveStats = activeBots.length > 0;
  const displayBalance = showActiveStats ? activeBalance : totalBalance;
  const displayInitialBalance = showActiveStats ? activeInitialBalance : bots.length * 10;
  const displayPnl = showActiveStats ? activePnl : totalPnl;
  const displayEV = showActiveStats ? activeEV : totalEV;
  const displayGrowth = displayBalance - displayInitialBalance;
  const displayGrowthPercent = displayInitialBalance > 0 ? (displayGrowth / displayInitialBalance) * 100 : 0;

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
      case 'ev':
        return calculateEV(b) - calculateEV(a);
      default:
        return 0;
    }
  });

  // Toggle individual bot
  const handleToggleBot = useCallback(async (botId: string) => {
    try {
      const res = await fetch(`/api/bots/${botId}/toggle`, { method: "POST" });
      if (!res.ok) throw new Error("Failed to toggle bot");
      const updatedBot = await res.json();
      updateBotState(botId, { enabled: updatedBot.enabled, runTime: updatedBot.runTime });
    } catch (err) {
      console.error("Failed to toggle bot:", err);
    }
  }, [updateBotState]);

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

  // Framer Motion constraints
  const container = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: { staggerChildren: 0.05 }
    }
  };

  const item = {
    hidden: { opacity: 0, scale: 0.95, y: 15 },
    show: { opacity: 1, scale: 1, y: 0, transition: { type: "spring" as const, stiffness: 300, damping: 24 } }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      {/* Summary Command Center */}
      <motion.div 
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass-card" 
        style={{ padding: "1.25rem", borderRadius: "16px", background: "rgba(10, 15, 25, 0.4)", border: "1px solid rgba(255, 255, 255, 0.08)", boxShadow: "0 8px 32px rgba(0, 0, 0, 0.3)" }}
      >
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
          gap: "1rem",
        }}>
          {/* Active Bots */}
          <div style={{
            display: "flex", flexDirection: "column", padding: "1rem",
            background: "linear-gradient(135deg, rgba(255,255,255,0.03), rgba(255,255,255,0.01))",
            borderRadius: 12, border: "1px solid rgba(255,255,255,0.05)"
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.375rem", marginBottom: "0.5rem" }}>
              <Target className="w-4 h-4 text-blue-400" />
              <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 600 }}>Active Bots</span>
            </div>
            <span style={{ fontWeight: 700, fontFamily: "ui-monospace, monospace", fontSize: "1.5rem", color: activeBots.length > 0 ? "#3b82f6" : "var(--text-muted)" }}>
              {activeBots.length}<span style={{ fontSize: "1rem", color: "var(--text-muted)", marginLeft: "2px" }}>/{bots.length}</span>
            </span>
          </div>

          {/* Portfolio Growth */}
          <div style={{
            display: "flex", flexDirection: "column", padding: "1rem",
            background: displayGrowth >= 0 ? "linear-gradient(135deg, rgba(34, 197, 94, 0.1), rgba(34, 197, 94, 0.02))" : "linear-gradient(135deg, rgba(239, 68, 68, 0.1), rgba(239, 68, 68, 0.02))",
            borderRadius: 12, border: `1px solid ${displayGrowth >= 0 ? "rgba(34, 197, 94, 0.2)" : "rgba(239, 68, 68, 0.2)"}`,
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.375rem", marginBottom: "0.5rem" }}>
              {displayGrowth >= 0 ? <TrendingUp className="w-4 h-4 text-green-500" /> : <TrendingDown className="w-4 h-4 text-red-500" />}
              <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 600 }}>
                {showActiveStats ? "Active Growth" : "Portfolio Growth"}
              </span>
            </div>
            <div style={{ display: "flex", alignItems: "baseline", gap: "0.375rem" }}>
              <span style={{ fontWeight: 700, fontFamily: "ui-monospace, monospace", fontSize: "1.5rem", color: displayGrowth >= 0 ? "#22c55e" : "#ef4444" }}>
                {displayGrowth >= 0 ? "+" : ""}{formatCurrency(displayGrowth)}
              </span>
              <span style={{ fontSize: "0.75rem", color: displayGrowth >= 0 ? "#22c55e" : "#ef4444", fontWeight: 600 }}>
                ({displayGrowthPercent >= 0 ? "+" : ""}{displayGrowthPercent.toFixed(1)}%)
              </span>
            </div>
          </div>

          {/* System Expected Value */}
          <div style={{
            display: "flex", flexDirection: "column", padding: "1rem",
            background: "linear-gradient(135deg, rgba(255,255,255,0.03), rgba(255,255,255,0.01))",
            borderRadius: 12, border: "1px solid rgba(255,255,255,0.05)",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.375rem", marginBottom: "0.5rem" }}>
              <Zap className="w-4 h-4 text-amber-500" />
              <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 600 }}>
                System EV / Trade
              </span>
            </div>
            <span style={{ fontWeight: 700, fontFamily: "ui-monospace, monospace", fontSize: "1.5rem", color: displayEV > 0 ? "#f59e0b" : "var(--text-muted)" }}>
              {displayEV > 0 ? "+" : ""}{formatCurrency(displayEV)}
            </span>
          </div>

          {/* Win Rate */}
          <div style={{
            display: "flex", flexDirection: "column", padding: "1rem",
            background: "linear-gradient(135deg, rgba(255,255,255,0.03), rgba(255,255,255,0.01))",
            borderRadius: 12, border: "1px solid rgba(255,255,255,0.05)",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.375rem", marginBottom: "0.5rem" }}>
              <BarChart3 className="w-4 h-4 text-purple-400" />
              <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 600 }}>Win Rate</span>
            </div>
            <span style={{ fontWeight: 700, fontFamily: "ui-monospace, monospace", fontSize: "1.5rem", color: totalWinRate >= 0.5 ? "#22c55e" : totalWinRate > 0 ? "#f59e0b" : "var(--text-muted)" }}>
              {(totalWinRate * 100).toFixed(0)}%
            </span>
            <span style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>
              <span style={{ color: "#22c55e" }}>{totalWins}W</span> <span style={{ color: "#ef4444" }}>{totalLosses}L</span> of {totalTrades}
            </span>
          </div>

          {/* Positions at Risk */}
          <div style={{
             display: "flex", flexDirection: "column", padding: "1rem",
             background: totalPositions > 0 ? "rgba(59, 130, 246, 0.1)" : "linear-gradient(135deg, rgba(255,255,255,0.03), rgba(255,255,255,0.01))",
             borderRadius: 12, border: totalPositions > 0 ? "1px solid rgba(59, 130, 246, 0.2)" : "1px solid rgba(255,255,255,0.05)",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.375rem", marginBottom: "0.5rem" }}>
              <Target className={totalPositions > 0 ? "w-4 h-4 text-blue-500" : "w-4 h-4 text-gray-500"} />
              <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 600 }}>Positions</span>
            </div>
            <span style={{ fontWeight: 700, fontFamily: "ui-monospace, monospace", fontSize: "1.5rem", color: totalPositions > 0 ? "#3b82f6" : "var(--text-muted)" }}>
              {totalPositions}
            </span>
            <span style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>
              ${positionsValue.toFixed(2)} at risk
            </span>
          </div>
        </div>
      </motion.div>

      {/* Control Strip */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 0.5rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <span style={{ fontSize: "0.875rem", color: "var(--text-secondary)", fontWeight: 600 }}>Sort by:</span>
          {(['pnl', 'winRate', 'trades', 'ev'] as SortField[]).map(field => (
            <button
              key={field}
              onClick={() => setSortBy(field)}
              className="hover:bg-blue-500/10 transition-colors"
              style={{
                padding: "0.375rem 0.875rem",
                fontSize: "0.75rem",
                borderRadius: "20px",
                border: sortBy === field ? "1px solid var(--primary)" : "1px solid transparent",
                background: sortBy === field ? "rgba(59, 130, 246, 0.15)" : "rgba(255,255,255,0.05)",
                color: sortBy === field ? "var(--primary)" : "var(--text-secondary)",
                cursor: "pointer",
                fontWeight: 600,
              }}
            >
              {field === 'pnl' ? 'P&L' : field === 'winRate' ? 'Win Rate' : field === 'ev' ? 'Expected Value' : field.charAt(0).toUpperCase() + field.slice(1)}
            </button>
          ))}
        </div>
        
        <button
          onClick={() => setShowActivityFeed(!showActivityFeed)}
          className="hover:bg-white/5 transition-colors"
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.5rem",
            background: "rgba(255,255,255,0.05)",
            border: "1px solid rgba(255,255,255,0.05)",
            borderRadius: "20px",
            padding: "0.375rem 0.875rem",
            cursor: "pointer",
            color: "var(--text-secondary)",
            fontSize: "0.75rem",
            fontWeight: 600,
          }}
        >
          <Activity className="w-3.5 h-3.5" />
          {showActivityFeed ? "Hide Log" : "Show Log"}
          {botLogs.length > 0 && !showActivityFeed && (
            <span style={{ background: "var(--primary)", color: "white", borderRadius: "10px", padding: "0.125rem 0.375rem", fontSize: "0.625rem" }}>
              {botLogs.length}
            </span>
          )}
        </button>
      </div>

      {/* Bot Grid Container */}
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
              />
            </motion.div>
          ))}
        </AnimatePresence>
      </motion.div>

      {/* Activity Feed Drawer */}
      <AnimatePresence>
        {showActivityFeed && (
          <motion.div 
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="glass-card" 
            style={{ padding: "1.25rem", borderRadius: "16px", background: "rgba(10, 15, 25, 0.4)", border: "1px solid rgba(255, 255, 255, 0.08)" }}
          >
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
                      background: log.type === "TRADE" ? "rgba(59, 130, 246, 0.08)" : log.type === "ERROR" ? "rgba(239, 68, 68, 0.08)" : "rgba(255,255,255,0.03)",
                      borderRadius: 12,
                      fontSize: "0.75rem",
                      border: `1px solid ${log.type === "TRADE" ? "rgba(59, 130, 246, 0.15)" : log.type === "ERROR" ? "rgba(239, 68, 68, 0.15)" : "rgba(255,255,255,0.05)"}`,
                    }}
                  >
                    <span style={{
                      width: 8, height: 8, borderRadius: "50%",
                      background: log.type === "TRADE" ? "#3b82f6" : log.type === "ERROR" ? "#ef4444" : "#f59e0b",
                      boxShadow: log.type === "TRADE" ? "0 0 10px rgba(59, 130, 246, 0.6)" : log.type === "ERROR" ? "0 0 10px rgba(239, 68, 68, 0.6)" : "none",
                    }} />
                    <span style={{ color: "var(--text-muted)", fontSize: "0.7rem", fontFamily: "ui-monospace, monospace" }}>
                      {new Date(log.timestamp).toLocaleTimeString()}
                    </span>
                    <span style={{ fontWeight: 600, color: "var(--text-primary)" }}>{log.botName}</span>
                    <span style={{ color: "var(--text-secondary)", flex: 1 }}>{log.message}</span>
                  </motion.div>
                ))
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Config Modal */}
      {configBot && (
        <>
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)", zIndex: 999 }}
            onClick={() => setConfigBot(null)}
          />
          <BotConfigPanel
            bot={configBot}
            onClose={() => setConfigBot(null)}
            onSave={handleSaveConfig}
          />
        </>
      )}
    </div>
  );
}
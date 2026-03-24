'use client'

import { Activity, Bot, TrendingUp, TrendingDown, AlertCircle, Info, Zap } from "lucide-react";
import type { TradeEvent, BotLog } from "@/hooks/useTradingData";

interface ActivityLogProps {
  events: TradeEvent[];
  botLogs: BotLog[];
  coinColor: string;
}

export function ActivityLog({ events, botLogs, coinColor }: ActivityLogProps) {
  // Combine and sort events and logs
  const allActivity = [
    ...events.map(e => ({
      ...e,
      activityType: 'trade' as const,
      sortTime: e.time,
    })),
    ...botLogs.map(l => ({
      ...l,
      activityType: 'log' as const,
      sortTime: l.timestamp,
    })),
  ].sort((a, b) => b.sortTime - a.sortTime).slice(0, 30);

  return (
    <div className="glass-card" style={{ padding: "1rem" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.75rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <Activity className="w-4 h-4" style={{ color: coinColor }} />
          <span style={{ fontWeight: 600 }}>Activity Feed</span>
        </div>
        <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
          {allActivity.length} events
        </span>
      </div>

      <div className="space-y-2" style={{ maxHeight: 300, overflowY: "auto", paddingRight: "0.25rem" }}>
        {allActivity.length > 0 ? allActivity.map((item, i) => (
          'activityType' in item && item.activityType === 'trade' ? (
            // Trade event
            <TradeEventItem key={`trade-${item.id || i}`} event={item as TradeEvent} />
          ) : (
            // Bot log
            <BotLogItem key={`log-${(item as BotLog).id || i}`} log={item as BotLog} />
          )
        )) : (
          <div style={{
            textAlign: "center",
            padding: "2rem 1rem",
            color: "var(--text-muted)",
            fontSize: "0.875rem",
            border: "1px dashed var(--border)",
            borderRadius: 8,
          }}>
            <Activity style={{ margin: "0 auto 0.5rem", opacity: 0.5 }} />
            No activity yet. Start bots to see trades and decisions.
          </div>
        )}
      </div>
    </div>
  );
}

function TradeEventItem({ event }: { event: TradeEvent }) {
  const isBuy = event.type === "BUY";
  const isYes = event.outcome === "YES";

  return (
    <div style={{
      display: "flex",
      alignItems: "flex-start",
      gap: "0.75rem",
      padding: "0.625rem 0.75rem",
      borderRadius: 8,
      background: "rgba(255,255,255,0.03)",
      border: "1px solid rgba(255,255,255,0.05)",
      transition: "all 0.2s",
    }}>
      {/* Icon */}
      <div style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        width: 28,
        height: 28,
        borderRadius: 6,
        background: isYes ? "rgba(34, 197, 94, 0.15)" : "rgba(239, 68, 68, 0.15)",
        flexShrink: 0,
      }}>
        {isYes ? (
          <TrendingUp style={{ width: 14, height: 14, color: "#22c55e" }} />
        ) : (
          <TrendingDown style={{ width: 14, height: 14, color: "#ef4444" }} />
        )}
      </div>

      {/* Content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.25rem" }}>
          <span style={{
            fontSize: "0.75rem",
            fontWeight: 600,
            color: isYes ? "#22c55e" : "#ef4444",
          }}>
            {isBuy ? "BUY" : "SELL"} {event.outcome}
          </span>
          <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
            ${event.amount?.toFixed(2)}
          </span>
          <span style={{
            fontSize: "0.65rem",
            color: "var(--text-muted)",
            fontFamily: "ui-monospace, monospace",
          }}>
            @ {(event.price * 100).toFixed(1)}¢
          </span>
        </div>

        {event.botName && (
          <div style={{ display: "flex", alignItems: "center", gap: "0.25rem" }}>
            <Bot style={{ width: 10, height: 10, color: "var(--primary)" }} />
            <span style={{ fontSize: "0.65rem", color: "var(--text-secondary)" }}>
              {event.botName}
            </span>
          </div>
        )}
      </div>

      {/* Time */}
      <span style={{
        fontSize: "0.625rem",
        color: "var(--text-muted)",
        fontFamily: "ui-monospace, monospace",
        whiteSpace: "nowrap",
      }}>
        {formatTime(event.time)}
      </span>
    </div>
  );
}

function BotLogItem({ log }: { log: BotLog }) {
  const typeConfig = {
    START: { icon: Zap, color: "#22c55e", bg: "rgba(34, 197, 94, 0.15)" },
    STOP: { icon: Zap, color: "#ef4444", bg: "rgba(239, 68, 68, 0.15)" },
    TRADE: { icon: TrendingUp, color: "#3b82f6", bg: "rgba(59, 130, 246, 0.15)" },
    DECISION: { icon: Info, color: "#f59e0b", bg: "rgba(245, 158, 11, 0.15)" },
    ERROR: { icon: AlertCircle, color: "#ef4444", bg: "rgba(239, 68, 68, 0.15)" },
    RISK: { icon: AlertCircle, color: "#f59e0b", bg: "rgba(245, 158, 11, 0.15)" },
    COMPETITION: { icon: Bot, color: "#8b5cf6", bg: "rgba(139, 92, 246, 0.15)" },
    COORD: { icon: Bot, color: "#06b6d4", bg: "rgba(6, 182, 212, 0.15)" },
  };

  const config = typeConfig[log.type] || typeConfig.DECISION;
  const Icon = config.icon;

  // Extract signal info from details if available
  const details = log.details || {};
  const signal = details.signal as string | undefined;
  const reason = details.reason as string | undefined;

  return (
    <div style={{
      display: "flex",
      alignItems: "flex-start",
      gap: "0.75rem",
      padding: "0.625rem 0.75rem",
      borderRadius: 8,
      background: "rgba(255,255,255,0.02)",
      border: "1px solid rgba(255,255,255,0.05)",
      transition: "all 0.2s",
    }}>
      {/* Icon */}
      <div style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        width: 28,
        height: 28,
        borderRadius: 6,
        background: config.bg,
        flexShrink: 0,
      }}>
        <Icon style={{ width: 14, height: 14, color: config.color }} />
      </div>

      {/* Content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.25rem" }}>
          <span style={{
            fontSize: "0.75rem",
            fontWeight: 600,
            color: config.color,
          }}>
            {log.type}
          </span>
          <span style={{ fontSize: "0.65rem", color: "var(--text-muted)" }}>
            {log.botName}
          </span>
        </div>

        <div style={{ fontSize: "0.75rem", color: "var(--text-secondary)", marginBottom: "0.25rem" }}>
          {log.message}
        </div>

        {/* Signal and Reason details */}
        {(signal || reason) && (
          <div style={{
            fontSize: "0.65rem",
            color: "var(--text-muted)",
            background: "rgba(0,0,0,0.2)",
            padding: "0.375rem 0.5rem",
            borderRadius: 4,
            marginTop: "0.25rem",
          }}>
            {signal && (
              <div style={{ marginBottom: reason ? "0.25rem" : 0 }}>
                <span style={{ color: "var(--text-secondary)" }}>Signal: </span>
                {signal}
              </div>
            )}
            {reason && (
              <div>
                <span style={{ color: "var(--text-secondary)" }}>Reason: </span>
                {reason}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Time */}
      <span style={{
        fontSize: "0.625rem",
        color: "var(--text-muted)",
        fontFamily: "ui-monospace, monospace",
        whiteSpace: "nowrap",
      }}>
        {formatTime(log.timestamp)}
      </span>
    </div>
  );
}

function formatTime(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
}
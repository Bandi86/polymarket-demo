// LiveLogPanel - Real-time scrolling trade log

import React, { useState } from "react";
import type { BotLog } from "../../lib/bot-manager";

interface LiveLogPanelProps {
  logs: BotLog[];
  maxItems?: number;
}

export function LiveLogPanel({ logs, maxItems = 20 }: LiveLogPanelProps) {
  const [filter, setFilter] = useState<"ALL" | "TRADE" | "DECISION" | "ERROR">("ALL");

  const filteredLogs = logs
    .filter(log => filter === "ALL" || log.type === filter)
    .slice(0, maxItems);

  return (
    <div style={{
      background: "rgba(0, 0, 0, 0.3)",
      borderRadius: 8,
      padding: "1rem",
      maxHeight: "400px",
      overflow: "hidden",
    }}>
      <div style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: "0.75rem",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <span style={{ color: "#ef4444", fontSize: "0.8rem" }}>🔴</span>
          <span style={{ color: "#fff", fontWeight: 600, fontSize: "0.9rem" }}>LIVE TRADE LOG</span>
        </div>

        <div style={{ display: "flex", gap: "0.25rem" }}>
          {(["ALL", "TRADE", "DECISION", "ERROR"] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              style={{
                padding: "0.25rem 0.5rem",
                borderRadius: 4,
                background: filter === f ? "rgba(255,255,255,0.1)" : "transparent",
                color: filter === f ? "#fff" : "#888",
                border: "none",
                cursor: "pointer",
                fontSize: "0.7rem",
              }}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      <div style={{
        maxHeight: "320px",
        overflowY: "auto",
        paddingRight: "0.5rem",
      }}>
        {filteredLogs.length === 0 ? (
          <div style={{ color: "#888", fontSize: "0.75rem", textAlign: "center" }}>
            No logs yet...
          </div>
        ) : (
          filteredLogs.map((log, i) => (
            <LogItem key={`${log.timestamp}-${log.botId || 'sys'}-${i}`} log={log} />
          ))
        )}
      </div>
    </div>
  );
}

function LogItem({ log }: { log: BotLog }) {
  const time = formatTime(log.timestamp);
  const typeColor = log.type === "TRADE" ? "#22c55e" :
                    log.type === "ERROR" ? "#ef4444" :
                    log.type === "DECISION" ? "#fbbf24" : "#888";

  return (
    <div style={{
      padding: "0.5rem",
      marginBottom: "0.25rem",
      borderRadius: 4,
      background: "rgba(0, 0, 0, 0.2)",
      fontSize: "0.75rem",
    }}>
      <div style={{ display: "flex", justifyContent: "space-between" }}>
        <span style={{ color: "#888" }}>{time}</span>
        <span style={{
          color: typeColor,
          fontWeight: 600,
          padding: "0.1rem 0.3rem",
          borderRadius: 3,
          background: `${typeColor}20`,
        }}>
          {log.botName || "System"}
        </span>
      </div>
      <div style={{ marginTop: "0.25rem", color: "#aaa" }}>
        {log.message}
      </div>
      {log.details && (
        <div style={{ marginTop: "0.25rem", color: "#666", fontSize: "0.65rem" }}>
          {formatDetails(log.details)}
        </div>
      )}
    </div>
  );
}

function formatTime(timestamp: number): string {
  const d = new Date(timestamp);
  return `${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}:${d.getSeconds().toString().padStart(2, "0")}`;
}

function formatDetails(details: Record<string, unknown>): string {
  const keys = ["action", "confidence", "reason", "price", "amount"];
  const parts = keys
    .filter(k => details[k] !== undefined)
    .map(k => `${k}=${String(details[k])}`);
  return parts.join(" | ");
}

export default LiveLogPanel;
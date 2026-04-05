// Bot Logger
// Handles logging for bot activities

import { generateId } from "../utils";
import type { BotLog as BotLogType } from "../../types/session.types";

// Re-export the type for backward compatibility
export type BotLog = BotLogType;

export class BotLogger {
  private logs: BotLog[] = [];
  private listeners: Array<(log: BotLog) => void> = [];
  private maxLogs: number = 100;

  addLog(
    botId: string,
    botName: string,
    type: BotLog["type"],
    message: string,
    details?: Record<string, unknown>
  ): BotLog {
    const log: BotLog = {
      id: generateId("log"),
      botId,
      botName,
      type,
      message,
      details,
      timestamp: Date.now(),
    };

    this.logs.unshift(log);
    if (this.logs.length > this.maxLogs) {
      this.logs.pop();
    }

    // Notify listeners
    for (const listener of this.listeners) {
      try {
        listener(log);
      } catch (e) {
        console.error("[BotLogger] Listener error:", e);
      }
    }

    return log;
  }

  getLogs(limit?: number): BotLog[] {
    if (limit) {
      return this.logs.slice(0, limit);
    }
    return [...this.logs];
  }

  getBotLogs(botId: string, limit?: number): BotLog[] {
    const botLogs = this.logs.filter(l => l.botId === botId);
    if (limit) {
      return botLogs.slice(0, limit);
    }
    return botLogs;
  }

  addListener(listener: (log: BotLog) => void): () => void {
    this.listeners.push(listener);
    return () => {
      const index = this.listeners.indexOf(listener);
      if (index >= 0) {
        this.listeners.splice(index, 1);
      }
    };
  }

  removeListener(listener: (log: BotLog) => void): void {
    const index = this.listeners.indexOf(listener);
    if (index >= 0) {
      this.listeners.splice(index, 1);
    }
  }

  clear(): void {
    this.logs = [];
  }

  setMaxLogs(max: number): void {
    this.maxLogs = max;
    if (this.logs.length > max) {
      this.logs = this.logs.slice(0, max);
    }
  }
}
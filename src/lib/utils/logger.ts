// Logger utility for consistent logging across the application

type LogLevel = "debug" | "info" | "warn" | "error";

interface LogEntry {
  timestamp: number;
  level: LogLevel;
  message: string;
  context?: string;
  data?: unknown;
}

class Logger {
  private static instance: Logger;
  private logs: LogEntry[] = [];
  private maxLogs = 1000;
  private debugMode = false;

  private constructor() {}

  static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger();
    }
    return Logger.instance;
  }

  setDebugMode(enabled: boolean): void {
    this.debugMode = enabled;
  }

  private log(level: LogLevel, message: string, context?: string, data?: unknown): void {
    const entry: LogEntry = {
      timestamp: Date.now(),
      level,
      message,
      context,
      data,
    };

    this.logs.push(entry);

    if (this.logs.length > this.maxLogs) {
      this.logs.shift();
    }

    // Console output
    const prefix = context ? `[${context}]` : "";
    const timestamp = new Date(entry.timestamp).toISOString();

    switch (level) {
      case "debug":
        if (this.debugMode) {
          console.debug(`[${timestamp}] DEBUG ${prefix}`, message, data || "");
        }
        break;
      case "info":
        console.info(`[${timestamp}] INFO ${prefix}`, message, data || "");
        break;
      case "warn":
        console.warn(`[${timestamp}] WARN ${prefix}`, message, data || "");
        break;
      case "error":
        console.error(`[${timestamp}] ERROR ${prefix}`, message, data || "");
        break;
    }
  }

  debug(message: string, context?: string, data?: unknown): void {
    this.log("debug", message, context, data);
  }

  info(message: string, context?: string, data?: unknown): void {
    this.log("info", message, context, data);
  }

  warn(message: string, context?: string, data?: unknown): void {
    this.log("warn", message, context, data);
  }

  error(message: string, context?: string, data?: unknown): void {
    this.log("error", message, context, data);
  }

  getLogs(level?: LogLevel, limit = 100): LogEntry[] {
    let filtered = this.logs;
    if (level) {
      filtered = this.logs.filter((log) => log.level === level);
    }
    return filtered.slice(-limit);
  }

  clear(): void {
    this.logs = [];
  }
}

export const logger = Logger.getInstance();

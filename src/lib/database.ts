// SQLite Database Layer for Persistent Data Storage
// Provides an in-memory or file-based database for storing:
// - Market history
// - Bot sessions
// - Trade history
// - User configurations

import Database from "better-sqlite3";
import { mkdirSync, existsSync } from "fs";
import { dirname } from "path";

export interface DatabaseConfig {
  mode: "memory" | "file";
  filePath?: string;
}

export interface MarketRow {
  id: string;
  question: string;
  description: string;
  start_time: number;
  end_time: number;
  start_price: number;
  end_price: number | null;
  status: "active" | "settled" | "paused";
  result: string | null;
  outcome_yes: number;
  outcome_no: number;
  volume: number;
  liquidity: number;
  category: string;
}

export interface PositionRow {
  id: string;
  market_id: string;
  outcome: string;
  amount: number;
  odds: number;
  stake: number;
  fee: number;
  timestamp: number;
  status: string;
  pnl: number | null;
  bot_id: string | null;
  bot_name: string | null;
  decision_context: string | null;
  btc_price: number | null;
  time_remaining: number | null;
}

export interface SessionLogRow {
  id: string;
  session_id: string;
  bot_id: string;
  type: string;
  message: string;
  details: string | null;
  timestamp: number;
}

export interface BotSessionRow {
  id: string;
  bot_id: string;
  bot_name: string;
  strategy: string;
  start_time: number;
  end_time: number | null;
  start_balance: number;
  end_balance: number | null;
  total_trades: number;
  winning_trades: number;
  losing_trades: number;
  total_pnl: number;
  status: string;
  max_drawdown: number;
  sharpe_ratio: number;
  strategy_config: string | null;
  bot_config: string | null;
  session_notes: string | null;
}

export interface TradeRow {
  id: string;
  position_id: string;
  market_id: string;
  type: string;
  outcome: string;
  amount: number;
  price: number;
  fee: number;
  timestamp: number;
  bot_id: string | null;
}

export interface ConfigRow {
  key: string;
  value: string;
  updated_at: number;
}

export class DatabaseService {
  private db: Database.Database | null = null;
  private config: DatabaseConfig;
  private initialized = false;

  // OPTIMIZATION 3: Prepared statement cache for better performance
  private statementCache: Map<string, Database.Statement> = new Map();

  // OPTIMIZATION 3: Write batch queue for batching multiple writes
  private writeBatchQueue: Array<() => void> = [];
  private batchFlushTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly BATCH_FLUSH_INTERVAL_MS = 50; // Flush batch every 50ms

  constructor(config: DatabaseConfig = { mode: "file", filePath: "./data/polymarket.db" }) {
    this.config = config;
  }

  private ensureDataDir(): void {
    if (this.config.mode === "file" && this.config.filePath) {
      const dir = dirname(this.config.filePath);
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
      }
    }
  }

  connect(): Promise<void> {
    if (this.initialized) return Promise.resolve();

    this.ensureDataDir();

    if (this.config.mode === "memory" || !this.config.filePath) {
      this.db = new Database(":memory:");
    } else {
      this.db = new Database(this.config.filePath);
    }

    // OPTIMIZATION 3: Enable WAL mode for better concurrent read/write performance
    // WAL mode allows readers to not block writers and vice versa
    this.db.exec("PRAGMA journal_mode = WAL");

    // OPTIMIZATION 3: Set synchronous to NORMAL for good balance of safety and speed
    // NORMAL is safe for WAL mode and faster than FULL
    this.db.exec("PRAGMA synchronous = NORMAL");

    // OPTIMIZATION 3: Increase cache size for better performance (2000 pages = ~8MB)
    this.db.exec("PRAGMA cache_size = -2000");

    // OPTIMIZATION 3: Enable foreign keys
    this.db.exec("PRAGMA foreign_keys = ON");

    this.createSchema();
    this.initialized = true;

    // OPTIMIZATION 3: Start batch flush timer
    this.startBatchFlushTimer();

    console.log("[Database] Connected with WAL mode and write batching enabled");
    return Promise.resolve();
  }

  /** Start the batch flush timer - flushes write queue periodically */
  private startBatchFlushTimer(): void {
    if (this.batchFlushTimer) return;

    this.batchFlushTimer = setInterval(() => {
      this.flushWriteBatch();
    }, this.BATCH_FLUSH_INTERVAL_MS);
  }

  /** Flush all pending writes in a single transaction */
  private flushWriteBatch(): void {
    if (!this.db || this.writeBatchQueue.length === 0) return;

    try {
      // Execute all queued writes in a single transaction
      this.db.transaction(() => {
        for (const writeFn of this.writeBatchQueue) {
          writeFn();
        }
      })();

      const flushedCount = this.writeBatchQueue.length;
      this.writeBatchQueue = [];

      if (flushedCount > 1) {
        console.log(`[Database] Flushed ${flushedCount} writes in batch`);
      }
    } catch (error) {
      console.error("[Database] Batch flush error:", error);
      // Clear queue on error to prevent data corruption
      this.writeBatchQueue = [];
    }
  }

  /** Queue a write operation for batching */
  private queueWrite(writeFn: () => void): void {
    this.writeBatchQueue.push(writeFn);
  }

  /** Execute a write immediately without batching (for time-critical operations) */
  private executeWriteImmediate(writeFn: () => void): void {
    if (!this.db) return;

    try {
      this.db.transaction(writeFn)();
    } catch (error) {
      console.error("[Database] Immediate write error:", error);
    }
  }

  /** Get a cached prepared statement or create a new one */
  private getStatement(sql: string): Database.Statement {
    if (!this.db) {
      throw new Error("Database not connected");
    }

    let stmt = this.statementCache.get(sql);
    if (!stmt) {
      stmt = this.db.prepare(sql);
      this.statementCache.set(sql, stmt);
    }
    return stmt;
  }

  /** Clear all cached statements (for cleanup) */
  private clearStatementCache(): void {
    this.statementCache.clear();
  }

  private createSchema(): void {
    if (!this.db) return;

    // Markets table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS markets (
        id TEXT PRIMARY KEY,
        question TEXT,
        description TEXT,
        start_time INTEGER,
        end_time INTEGER,
        start_price REAL,
        end_price REAL,
        status TEXT,
        result TEXT,
        outcome_yes REAL,
        outcome_no REAL,
        volume REAL,
        liquidity REAL,
        category TEXT
      )
    `);

    // Positions table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS positions (
        id TEXT PRIMARY KEY,
        market_id TEXT,
        outcome TEXT,
        amount REAL,
        odds REAL,
        stake REAL,
        fee REAL,
        timestamp INTEGER,
        status TEXT,
        pnl REAL,
        bot_id TEXT,
        bot_name TEXT,
        FOREIGN KEY (market_id) REFERENCES markets(id)
      )
    `);

    // Bot sessions table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS bot_sessions (
        id TEXT PRIMARY KEY,
        bot_id TEXT,
        bot_name TEXT,
        strategy TEXT,
        start_time INTEGER,
        end_time INTEGER,
        start_balance REAL,
        end_balance REAL,
        total_trades INTEGER,
        winning_trades INTEGER,
        losing_trades INTEGER,
        total_pnl REAL,
        status TEXT,
        max_drawdown REAL,
        sharpe_ratio REAL
      )
    `);

    // Trades table (for detailed trade history)
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS trades (
        id TEXT PRIMARY KEY,
        position_id TEXT,
        market_id TEXT,
        type TEXT,
        outcome TEXT,
        amount REAL,
        price REAL,
        fee REAL,
        timestamp INTEGER,
        bot_id TEXT,
        FOREIGN KEY (position_id) REFERENCES positions(id),
        FOREIGN KEY (market_id) REFERENCES markets(id)
      )
    `);

    // Configuration table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS config (
        key TEXT PRIMARY KEY,
        value TEXT,
        updated_at INTEGER
      )
    `);

    // Create indexes for common queries
    this.db.exec(`CREATE INDEX IF NOT EXISTS idx_positions_market ON positions(market_id)`);
    this.db.exec(`CREATE INDEX IF NOT EXISTS idx_positions_bot ON positions(bot_id)`);
    this.db.exec(`CREATE INDEX IF NOT EXISTS idx_sessions_bot ON bot_sessions(bot_id)`);
    this.db.exec(`CREATE INDEX IF NOT EXISTS idx_trades_market ON trades(market_id)`);

    // Extend bot_sessions table with new columns (SQLite ALTER TABLE is limited)
    try {
      this.db.exec(`ALTER TABLE bot_sessions ADD COLUMN strategy_config TEXT`);
    } catch { /* column already exists */ }
    try {
      this.db.exec(`ALTER TABLE bot_sessions ADD COLUMN bot_config TEXT`);
    } catch { /* column already exists */ }
    try {
      this.db.exec(`ALTER TABLE bot_sessions ADD COLUMN session_notes TEXT`);
    } catch { /* column already exists */ }

    // Extend positions table with new columns
    try {
      this.db.exec(`ALTER TABLE positions ADD COLUMN decision_context TEXT`);
    } catch { /* column already exists */ }
    try {
      this.db.exec(`ALTER TABLE positions ADD COLUMN btc_price REAL`);
    } catch { /* column already exists */ }
    try {
      this.db.exec(`ALTER TABLE positions ADD COLUMN time_remaining INTEGER`);
    } catch { /* column already exists */ }

    // Create session_logs table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS session_logs (
        id TEXT PRIMARY KEY,
        session_id TEXT,
        bot_id TEXT,
        type TEXT,
        message TEXT,
        details TEXT,
        timestamp INTEGER,
        FOREIGN KEY (session_id) REFERENCES bot_sessions(id)
      )
    `);

    this.db.exec(`CREATE INDEX IF NOT EXISTS idx_session_logs_session ON session_logs(session_id)`);
    this.db.exec(`CREATE INDEX IF NOT EXISTS idx_session_logs_bot ON session_logs(bot_id)`);
  }

  // === Market Operations ===

  async saveMarket(market: {
    id: string;
    question: string;
    description: string;
    startTime: number;
    endTime: number;
    startPrice: number;
    endPrice: number | null;
    status: "active" | "settled" | "paused";
    result: "UP" | "DOWN" | null;
    outcomeYes: number;
    outcomeNo: number;
    volume: number;
    liquidity: number;
    category?: string;
  }): Promise<void> {
    if (!this.db) return;

    // OPTIMIZATION 3: Use cached prepared statement
    const stmt = this.getStatement(`
      INSERT OR REPLACE INTO markets
      (id, question, description, start_time, end_time, start_price, end_price,
       status, result, outcome_yes, outcome_no, volume, liquidity, category)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    // OPTIMIZATION 3: Queue write for batching
    this.queueWrite(() => {
      stmt.run(
        market.id,
        market.question,
        market.description,
        market.startTime,
        market.endTime,
        market.startPrice,
        market.endPrice,
        market.status,
        market.result,
        market.outcomeYes,
        market.outcomeNo,
        market.volume,
        market.liquidity,
        market.category || "Crypto"
      );
    });
  }

  async getMarket(id: string): Promise<MarketRow | null> {
    if (!this.db) return null;

    const stmt = this.db.prepare("SELECT * FROM markets WHERE id = ?");
    return stmt.get(id) as MarketRow | null;
  }

  async getMarketHistory(limit: number = 50): Promise<MarketRow[]> {
    if (!this.db) return [];

    const stmt = this.db.prepare(
      "SELECT * FROM markets ORDER BY start_time DESC LIMIT ?"
    );
    return stmt.all(limit) as MarketRow[];
  }

  // === Position Operations ===

  async savePosition(position: {
    id: string;
    marketId: string;
    outcome: "YES" | "NO";
    amount: number;
    odds: number;
    stake: number;
    fee: number;
    timestamp: number;
    status: "open" | "closed" | "settled";
    pnl: number | null;
    botId?: string | null;
    botName?: string | null;
    decisionContext?: Record<string, unknown>;
    btcPrice?: number;
    timeRemaining?: number;
  }): Promise<void> {
    if (!this.db) return;

    // OPTIMIZATION 3: Use cached prepared statement
    const stmt = this.getStatement(`
      INSERT OR REPLACE INTO positions
      (id, market_id, outcome, amount, odds, stake, fee, timestamp, status,
       pnl, bot_id, bot_name, decision_context, btc_price, time_remaining)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    // OPTIMIZATION 3: Queue write for batching
    this.queueWrite(() => {
      stmt.run(
        position.id,
        position.marketId,
        position.outcome,
        position.amount,
        position.odds,
        position.stake,
        position.fee,
        position.timestamp,
        position.status,
        position.pnl,
        position.botId || null,
        position.botName || null,
        position.decisionContext ? JSON.stringify(position.decisionContext) : null,
        position.btcPrice ?? null,
        position.timeRemaining ?? null
      );
    });
  }

  /** Save position immediately without batching (for time-critical operations) */
  async savePositionImmediate(position: {
    id: string;
    marketId: string;
    outcome: "YES" | "NO";
    amount: number;
    odds: number;
    stake: number;
    fee: number;
    timestamp: number;
    status: "open" | "closed" | "settled";
    pnl: number | null;
    botId?: string | null;
    botName?: string | null;
    decisionContext?: Record<string, unknown>;
    btcPrice?: number;
    timeRemaining?: number;
  }): Promise<void> {
    if (!this.db) return;

    const stmt = this.getStatement(`
      INSERT OR REPLACE INTO positions
      (id, market_id, outcome, amount, odds, stake, fee, timestamp, status,
       pnl, bot_id, bot_name, decision_context, btc_price, time_remaining)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    this.executeWriteImmediate(() => {
      stmt.run(
        position.id,
        position.marketId,
        position.outcome,
        position.amount,
        position.odds,
        position.stake,
        position.fee,
        position.timestamp,
        position.status,
        position.pnl,
        position.botId || null,
        position.botName || null,
        position.decisionContext ? JSON.stringify(position.decisionContext) : null,
        position.btcPrice ?? null,
        position.timeRemaining ?? null
      );
    });
  }

  async getPosition(id: string): Promise<PositionRow | null> {
    if (!this.db) return null;

    const stmt = this.db.prepare("SELECT * FROM positions WHERE id = ?");
    return stmt.get(id) as PositionRow | null;
  }

  async getPositionsByMarket(marketId: string): Promise<PositionRow[]> {
    if (!this.db) return [];

    const stmt = this.db.prepare(
      "SELECT * FROM positions WHERE market_id = ? ORDER BY timestamp DESC"
    );
    return stmt.all(marketId) as PositionRow[];
  }

  async getPositionsByBot(botId: string): Promise<PositionRow[]> {
    if (!this.db) return [];

    const stmt = this.db.prepare(
      "SELECT * FROM positions WHERE bot_id = ? ORDER BY timestamp DESC"
    );
    return stmt.all(botId) as PositionRow[];
  }

  async getOpenPositions(): Promise<PositionRow[]> {
    if (!this.db) return [];

    const stmt = this.db.prepare(
      "SELECT * FROM positions WHERE status = 'open' ORDER BY timestamp DESC"
    );
    return stmt.all() as PositionRow[];
  }

  async getSettledPositionsByBot(botId: string, limit: number = 100): Promise<PositionRow[]> {
    if (!this.db) return [];

    const stmt = this.db.prepare(
      "SELECT * FROM positions WHERE bot_id = ? AND status IN ('settled', 'closed') ORDER BY timestamp DESC LIMIT ?"
    );
    return stmt.all(botId, limit) as PositionRow[];
  }

  async getLatestBotSession(botId: string): Promise<BotSessionRow | null> {
    if (!this.db) return null;

    const stmt = this.db.prepare(
      "SELECT * FROM bot_sessions WHERE bot_id = ? ORDER BY start_time DESC LIMIT 1"
    );
    return stmt.get(botId) as BotSessionRow | null;
  }

  async updatePositionStatus(id: string, status: string, pnl: number | null): Promise<void> {
    if (!this.db) return;

    // OPTIMIZATION 3: Use cached prepared statement
    const stmt = this.getStatement("UPDATE positions SET status = ?, pnl = ? WHERE id = ?");

    // OPTIMIZATION 3: Queue write for batching
    this.queueWrite(() => {
      stmt.run(status, pnl, id);
    });
  }

  // === Bot Session Operations ===

  async saveBotSession(session: {
    id: string;
    botId: string;
    botName: string;
    strategy: string;
    startTime: number;
    endTime: number | null;
    startBalance: number;
    endBalance: number | null;
    totalTrades: number;
    winningTrades: number;
    losingTrades: number;
    totalPnL: number;
    status: "running" | "completed" | "paused";
    maxDrawdown?: number;
    sharpeRatio?: number;
    strategyConfig?: Record<string, unknown>;
    botConfig?: Record<string, unknown>;
    sessionNotes?: string;
  }): Promise<void> {
    if (!this.db) return;

    // OPTIMIZATION 3: Use cached prepared statement
    const stmt = this.getStatement(`
      INSERT OR REPLACE INTO bot_sessions
      (id, bot_id, bot_name, strategy, start_time, end_time, start_balance,
       end_balance, total_trades, winning_trades, losing_trades, total_pnl,
       status, max_drawdown, sharpe_ratio, strategy_config, bot_config, session_notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    // OPTIMIZATION 3: Queue write for batching
    this.queueWrite(() => {
      stmt.run(
        session.id,
        session.botId,
        session.botName,
        session.strategy,
        session.startTime,
        session.endTime,
        session.startBalance,
        session.endBalance,
        session.totalTrades,
        session.winningTrades,
        session.losingTrades,
        session.totalPnL,
        session.status,
        session.maxDrawdown ?? 0,
        session.sharpeRatio ?? 0,
        session.strategyConfig ? JSON.stringify(session.strategyConfig) : null,
        session.botConfig ? JSON.stringify(session.botConfig) : null,
        session.sessionNotes ?? null
      );
    });
  }

  async getBotSession(id: string): Promise<BotSessionRow | null> {
    if (!this.db) return null;

    const stmt = this.db.prepare("SELECT * FROM bot_sessions WHERE id = ?");
    return stmt.get(id) as BotSessionRow | null;
  }

  async getBotSessions(botId: string, limit: number = 50): Promise<BotSessionRow[]> {
    if (!this.db) return [];

    const stmt = this.db.prepare(
      "SELECT * FROM bot_sessions WHERE bot_id = ? ORDER BY start_time DESC LIMIT ?"
    );
    return stmt.all(botId, limit) as BotSessionRow[];
  }

  async getAllBotSessions(limit: number = 100): Promise<BotSessionRow[]> {
    if (!this.db) return [];

    const stmt = this.db.prepare(
      "SELECT * FROM bot_sessions ORDER BY start_time DESC LIMIT ?"
    );
    return stmt.all(limit) as BotSessionRow[];
  }

  // === Session Logs Operations ===

  async saveSessionLog(log: {
    id: string;
    sessionId: string;
    botId: string;
    type: string;
    message: string;
    details?: Record<string, unknown>;
    timestamp: number;
  }): Promise<void> {
    if (!this.db) return;

    const stmt = this.db.prepare(`
      INSERT INTO session_logs
      (id, session_id, bot_id, type, message, details, timestamp)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      log.id,
      log.sessionId,
      log.botId,
      log.type,
      log.message,
      log.details ? JSON.stringify(log.details) : null,
      log.timestamp
    );
  }

  async getSessionLogs(sessionId: string): Promise<SessionLogRow[]> {
    if (!this.db) return [];

    const stmt = this.db.prepare(
      "SELECT * FROM session_logs WHERE session_id = ? ORDER BY timestamp"
    );
    return stmt.all(sessionId) as SessionLogRow[];
  }

  async getBotSessionLogs(botId: string, limit: number = 100): Promise<SessionLogRow[]> {
    if (!this.db) return [];

    const stmt = this.db.prepare(
      "SELECT * FROM session_logs WHERE bot_id = ? ORDER BY timestamp DESC LIMIT ?"
    );
    return stmt.all(botId, limit) as SessionLogRow[];
  }

  // === Trade Operations ===

  async saveTrade(trade: {
    id: string;
    positionId: string;
    marketId: string;
    type: "buy" | "sell";
    outcome: "YES" | "NO";
    amount: number;
    price: number;
    fee: number;
    timestamp: number;
    botId?: string | null;
  }): Promise<void> {
    if (!this.db) return;

    // OPTIMIZATION 3: Use cached prepared statement
    const stmt = this.getStatement(`
      INSERT INTO trades
      (id, position_id, market_id, type, outcome, amount, price, fee, timestamp, bot_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    // OPTIMIZATION 3: Queue write for batching
    this.queueWrite(() => {
      stmt.run(
        trade.id,
        trade.positionId,
        trade.marketId,
        trade.type,
        trade.outcome,
        trade.amount,
        trade.price,
        trade.fee,
        trade.timestamp,
        trade.botId || null
      );
    });
  }

  // === Configuration Operations ===

  async getConfig(key: string): Promise<string | null> {
    if (!this.db) return null;

    const stmt = this.db.prepare("SELECT value FROM config WHERE key = ?");
    const result = stmt.get(key) as { value: string } | null;
    return result?.value ?? null;
  }

  async setConfig(key: string, value: string): Promise<void> {
    if (!this.db) return;

    // OPTIMIZATION 3: Use cached prepared statement
    const stmt = this.getStatement(`
      INSERT OR REPLACE INTO config (key, value, updated_at)
      VALUES (?, ?, ?)
    `);

    // OPTIMIZATION 3: Queue write for batching
    this.queueWrite(() => {
      stmt.run(key, value, Date.now());
    });
  }

  // === Database Management ===

  /** Flush all pending writes immediately (call before shutdown) */
  async flushPendingWrites(): Promise<void> {
    this.flushWriteBatch();
  }

  async close(): Promise<void> {
    if (this.db) {
      // Flush any pending writes before closing
      this.flushWriteBatch();

      // Clear batch flush timer
      if (this.batchFlushTimer) {
        clearInterval(this.batchFlushTimer);
        this.batchFlushTimer = null;
      }

      // Clear statement cache
      this.clearStatementCache();

      // checkpoint WAL to main database file
      try {
        this.db.exec("PRAGMA wal_checkpoint(TRUNCATE)");
      } catch (error) {
        console.error("[Database] WAL checkpoint error:", error);
      }

      this.db.close();
      this.db = null;
      this.initialized = false;

      console.log("[Database] Closed (WAL checkpoint complete)");
    }
  }

  async clearData(): Promise<void> {
    if (!this.db) return;

    const tables = ["trades", "positions", "bot_sessions", "markets", "config"];

    for (const table of tables) {
      this.db.exec(`DELETE FROM ${table}`);
    }
  }
}

// Singleton instance
export const dbService = new DatabaseService({ mode: "file", filePath: "./data/polymarket.db" });
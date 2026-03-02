import { Database } from "bun:sqlite";

const db = new Database("bot_sessions.db");

db.exec(`
  CREATE TABLE IF NOT EXISTS sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT UNIQUE NOT NULL,
    bot_id TEXT NOT NULL,
    bot_name TEXT NOT NULL,
    strategy TEXT NOT NULL,
    start_time INTEGER NOT NULL,
    end_time INTEGER,
    start_balance REAL NOT NULL,
    end_balance REAL,
    total_trades INTEGER DEFAULT 0,
    winning_trades INTEGER DEFAULT 0,
    total_pnl REAL DEFAULT 0,
    status TEXT DEFAULT 'running'
  );

  CREATE TABLE IF NOT EXISTS trades (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT NOT NULL,
    position_id TEXT NOT NULL,
    outcome TEXT NOT NULL,
    amount REAL NOT NULL,
    odds REAL NOT NULL,
    pnl REAL,
    market_id TEXT NOT NULL,
    market_result TEXT,
    created_at INTEGER NOT NULL,
    settled_at INTEGER
  );

  CREATE TABLE IF NOT EXISTS market_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    market_id TEXT UNIQUE NOT NULL,
    result TEXT NOT NULL,
    start_price REAL NOT NULL,
    end_price REAL NOT NULL,
    start_time INTEGER NOT NULL,
    end_time INTEGER NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_trades_session ON trades(session_id);
  CREATE INDEX IF NOT EXISTS idx_sessions_bot ON sessions(bot_id);
`);

export interface Session {
  id: number;
  session_id: string;
  bot_id: string;
  bot_name: string;
  strategy: string;
  start_time: number;
  end_time: number | null;
  start_balance: number;
  end_balance: number | null;
  total_trades: number;
  winning_trades: number;
  total_pnl: number;
  status: string;
}

export interface Trade {
  id: number;
  session_id: string;
  position_id: string;
  outcome: string;
  amount: number;
  odds: number;
  pnl: number | null;
  market_id: string;
  market_result: string | null;
  created_at: number;
  settled_at: number | null;
}

export function createSession(botId: string, botName: string, strategy: string, balance: number): string {
  const sessionId = `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  
  const stmt = db.prepare(`
    INSERT INTO sessions (session_id, bot_id, bot_name, strategy, start_time, start_balance, status)
    VALUES (?, ?, ?, ?, ?, ?, 'running')
  `);
  
  stmt.run(sessionId, botId, botName, strategy, Date.now(), balance);
  return sessionId;
}

export function endSession(sessionId: string, endBalance: number, totalTrades: number, winningTrades: number, totalPnl: number): void {
  const stmt = db.prepare(`
    UPDATE sessions 
    SET end_time = ?, end_balance = ?, total_trades = ?, winning_trades = ?, total_pnl = ?, status = 'completed'
    WHERE session_id = ?
  `);
  
  stmt.run(Date.now(), endBalance, totalTrades, winningTrades, totalPnl, sessionId);
}

export function addTrade(sessionId: string, positionId: string, outcome: string, amount: number, odds: number, marketId: string): void {
  const stmt = db.prepare(`
    INSERT INTO trades (session_id, position_id, outcome, amount, odds, market_id, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  
  stmt.run(sessionId, positionId, outcome, amount, odds, marketId, Date.now());
}

export function settleTrade(positionId: string, pnl: number, marketResult: string): void {
  const stmt = db.prepare(`
    UPDATE trades SET pnl = ?, market_result = ?, settled_at = ? WHERE position_id = ?
  `);
  
  stmt.run(pnl, marketResult, Date.now(), positionId);
}

export function addMarketHistory(marketId: string, result: string, startPrice: number, endPrice: number, startTime: number, endTime: number): void {
  const stmt = db.prepare(`
    INSERT OR REPLACE INTO market_history (market_id, result, start_price, end_price, start_time, end_time)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  
  stmt.run(marketId, result, startPrice, endPrice, startTime, endTime);
}

export function getSessions(limit = 50): Session[] {
  const stmt = db.prepare(`
    SELECT * FROM sessions ORDER BY start_time DESC LIMIT ?
  `);
  
  return stmt.all(limit) as Session[];
}

export function getSessionTrades(sessionId: string): Trade[] {
  const stmt = db.prepare(`
    SELECT * FROM trades WHERE session_id = ? ORDER BY created_at DESC
  `);
  
  return stmt.all(sessionId) as Trade[];
}

export function getSessionStats(sessionId: string): { totalTrades: number; winningTrades: number; totalPnl: number; winRate: number } {
  const stmt = db.prepare(`
    SELECT 
      COUNT(*) as totalTrades,
      SUM(CASE WHEN pnl > 0 THEN 1 ELSE 0 END) as winningTrades,
      COALESCE(SUM(pnl), 0) as totalPnl
    FROM trades 
    WHERE session_id = ? AND settled_at IS NOT NULL
  `);
  
  const result = stmt.get(sessionId) as any;
  return {
    totalTrades: result.totalTrades || 0,
    winningTrades: result.winningTrades || 0,
    totalPnl: result.totalPnl || 0,
    winRate: result.totalTrades > 0 ? (result.winningTrades || 0) / result.totalTrades : 0
  };
}

export function getMarketHistory(limit = 20): any[] {
  const stmt = db.prepare(`
    SELECT * FROM market_history ORDER BY end_time DESC LIMIT ?
  `);
  
  return stmt.all(limit);
}

export function getActiveSession(): Session | null {
  const stmt = db.prepare(`
    SELECT * FROM sessions WHERE status = 'running' ORDER BY start_time DESC LIMIT 1
  `);
  
  return stmt.get() as Session | null;
}

export { db };

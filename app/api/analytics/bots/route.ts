import { NextResponse } from 'next/server';
import { getDatabaseService } from '@/lib/global';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const dbService = getDatabaseService();

    // Wait for database to be ready
    let db: any;
    let attempts = 0;
    while (!db && attempts < 10) {
      db = (dbService as any)?.db;
      if (!db) {
        await new Promise(r => setTimeout(r, 100));
        attempts++;
      }
    }

    if (!db) {
      return NextResponse.json({
        success: true,
        bots: [],
        recentPositions: [],
        note: "Database not ready yet"
      });
    }

    const sessions = db.prepare(`
      SELECT 
        bot_name,
        strategy,
        SUM(total_trades) as total_trades,
        SUM(winning_trades) as wins,
        SUM(losing_trades) as losses,
        ROUND(SUM(total_pnl), 4) as total_pnl,
        ROUND(AVG(max_drawdown), 4) as avg_drawdown,
        ROUND(AVG(sharpe_ratio), 4) as avg_sharpe,
        COUNT(*) as session_count,
        MAX(start_time) as last_active
      FROM bot_sessions
      GROUP BY bot_name, strategy
      ORDER BY total_pnl DESC
    `).all();

    const bots = sessions.map((s: any) => ({
      botName: s.bot_name,
      strategy: s.strategy,
      totalTrades: s.total_trades || 0,
      wins: s.wins || 0,
      losses: s.losses || 0,
      totalPnl: s.total_pnl || 0,
      avgDrawdown: s.avg_drawdown || 0,
      avgSharpe: s.avg_sharpe || 0,
      sessionCount: s.session_count || 0,
      lastActive: s.last_active,
      winRate: s.total_trades > 0 ? Math.round((s.wins / s.total_trades) * 100) : 0,
      status: s.total_pnl > 0 ? 'profitable' : s.total_trades === 0 ? 'inactive' : 'losing',
    }));

    const recentPositions = db.prepare(`
      SELECT bot_name, outcome, amount, odds, pnl, status, timestamp
      FROM positions
      ORDER BY timestamp DESC
      LIMIT 40
    `).all();

    return NextResponse.json({ success: true, bots, recentPositions });
  } catch (error: any) {
    console.error('[API] Bot analytics error:', error);
    return NextResponse.json({ success: false, error: error.message, bots: [] }, { status: 500 });
  }
}

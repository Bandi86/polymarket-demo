'use client'

import { useState, useEffect } from "react";
import { TrendingUp, TrendingDown, Minus, RefreshCw, Activity, AlertTriangle, CheckCircle2, BarChart3 } from "lucide-react";

interface BotStat {
  botName: string;
  strategy: string;
  totalTrades: number;
  wins: number;
  losses: number;
  totalPnl: number;
  avgDrawdown: number;
  avgSharpe: number;
  winRate: number;
  status: 'profitable' | 'losing' | 'inactive';
  lastActive: number | null;
}

interface Position {
  bot_name: string;
  outcome: string;
  amount: number;
  odds: number;
  pnl: number | null;
  status: string;
  timestamp: number;
}

const STATUS_CONFIG = {
  profitable: { color: '#22c55e', bg: 'rgba(34,197,94,0.12)', label: 'Profitable', Icon: CheckCircle2 },
  losing:     { color: '#ef4444', bg: 'rgba(239,68,68,0.12)',  label: 'Losing',     Icon: TrendingDown },
  inactive:   { color: '#94a3b8', bg: 'rgba(148,163,184,0.1)', label: 'Inactive',   Icon: Minus },
};

export function BotAnalyticsTab() {
  const [bots, setBots] = useState<BotStat[]>([]);
  const [recentPositions, setRecentPositions] = useState<Position[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/analytics/bots');
      const data = await res.json();
      if (data.success) {
        setBots(data.bots || []);
        setRecentPositions(data.recentPositions || []);
      } else {
        setError(data.error || 'Failed to load analytics');
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const profitable = bots.filter(b => b.status === 'profitable');
  const losing     = bots.filter(b => b.status === 'losing');
  const inactive   = bots.filter(b => b.status === 'inactive');
  const totalPnl   = bots.reduce((s, b) => s + b.totalPnl, 0);
  const totalTrades = bots.reduce((s, b) => s + b.totalTrades, 0);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <BarChart3 className="w-5 h-5" style={{ color: 'var(--primary)' }} />
          <h2 style={{ margin: 0, fontSize: '1.125rem', fontWeight: 700 }}>Bot Performance Analytics</h2>
        </div>
        <button onClick={fetchData} disabled={loading}
          style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {error && (
        <div style={{ padding: '0.75rem', background: 'rgba(239,68,68,0.1)', borderRadius: 8, color: '#ef4444', fontSize: '0.875rem' }}>
          {error}
        </div>
      )}

      {/* Summary Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.75rem' }}>
        {[
          { label: 'Total PnL',    value: `${totalPnl >= 0 ? '+' : ''}$${totalPnl.toFixed(2)}`, color: totalPnl >= 0 ? '#22c55e' : '#ef4444' },
          { label: 'Total Trades', value: totalTrades.toString(), color: 'var(--text-primary)' },
          { label: 'Profitable',   value: profitable.length.toString(), color: '#22c55e' },
          { label: 'Losing',       value: losing.length.toString(), color: '#ef4444' },
        ].map(card => (
          <div key={card.label} className="glass-card" style={{ padding: '1rem', textAlign: 'center' }}>
            <div style={{ fontSize: '0.625rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.25rem' }}>{card.label}</div>
            <div style={{ fontSize: '1.25rem', fontWeight: 700, fontFamily: 'monospace', color: card.color }}>{card.value}</div>
          </div>
        ))}
      </div>

      {/* Bot Table */}
      <div className="glass-card" style={{ padding: '1rem', overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8125rem' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border)' }}>
              {['Bot', 'Strategy', 'Status', 'Trades', 'Win Rate', 'Total PnL', 'Drawdown', 'Sharpe'].map(h => (
                <th key={h} style={{ padding: '0.5rem 0.75rem', textAlign: 'left', color: 'var(--text-muted)', fontWeight: 600, fontSize: '0.7rem', textTransform: 'uppercase' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={8} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>Loading...</td></tr>
            ) : bots.length === 0 ? (
              <tr><td colSpan={8} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>No bot data available. Run bots to see analytics.</td></tr>
            ) : (
              bots.map(bot => {
                const cfg = STATUS_CONFIG[bot.status];
                return (
                  <tr key={bot.botName} style={{ borderBottom: '1px solid var(--border)', transition: 'background 0.15s' }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'var(--glass-bg)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                    <td style={{ padding: '0.625rem 0.75rem', fontWeight: 600 }}>{bot.botName}</td>
                    <td style={{ padding: '0.625rem 0.75rem', color: 'var(--text-muted)', fontFamily: 'monospace', fontSize: '0.75rem' }}>{bot.strategy}</td>
                    <td style={{ padding: '0.625rem 0.75rem' }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', padding: '0.15rem 0.5rem', borderRadius: 999, background: cfg.bg, color: cfg.color, fontSize: '0.7rem', fontWeight: 600 }}>
                        <cfg.Icon className="w-3 h-3" />
                        {cfg.label}
                      </span>
                    </td>
                    <td style={{ padding: '0.625rem 0.75rem', fontFamily: 'monospace' }}>{bot.totalTrades}</td>
                    <td style={{ padding: '0.625rem 0.75rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <div style={{ width: 48, height: 6, borderRadius: 3, background: 'var(--border)', overflow: 'hidden' }}>
                          <div style={{ width: `${bot.winRate}%`, height: '100%', background: bot.winRate >= 50 ? '#22c55e' : '#ef4444', borderRadius: 3 }} />
                        </div>
                        <span style={{ fontFamily: 'monospace', fontSize: '0.75rem', color: bot.winRate >= 50 ? '#22c55e' : '#ef4444' }}>{bot.winRate}%</span>
                      </div>
                    </td>
                    <td style={{ padding: '0.625rem 0.75rem', fontFamily: 'monospace', fontWeight: 700, color: bot.totalPnl >= 0 ? '#22c55e' : '#ef4444' }}>
                      {bot.totalPnl >= 0 ? '+' : ''}${bot.totalPnl.toFixed(4)}
                    </td>
                    <td style={{ padding: '0.625rem 0.75rem', fontFamily: 'monospace', color: 'var(--text-muted)' }}>{(bot.avgDrawdown * 100).toFixed(1)}%</td>
                    <td style={{ padding: '0.625rem 0.75rem', fontFamily: 'monospace', color: bot.avgSharpe > 0 ? '#22c55e' : 'var(--text-muted)' }}>{bot.avgSharpe.toFixed(2)}</td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Recent Positions */}
      {recentPositions.length > 0 && (
        <div className="glass-card" style={{ padding: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
            <Activity className="w-4 h-4" style={{ color: 'var(--primary)' }} />
            <span style={{ fontWeight: 600, fontSize: '0.875rem' }}>Recent Positions</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem', maxHeight: 220, overflowY: 'auto' }}>
            {recentPositions.slice(0, 15).map((pos, i) => {
              const pnl = pos.pnl ?? 0;
              return (
                <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.4rem 0.5rem', background: 'var(--glass-bg)', borderRadius: 6, fontSize: '0.75rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{ padding: '0.1rem 0.4rem', borderRadius: 4, background: pos.outcome === 'YES' ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)', color: pos.outcome === 'YES' ? '#22c55e' : '#ef4444', fontWeight: 700, fontSize: '0.65rem' }}>{pos.outcome}</span>
                    <span style={{ color: 'var(--text-muted)' }}>{pos.bot_name}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <span style={{ color: 'var(--text-muted)' }}>@{pos.odds?.toFixed(3)}</span>
                    <span style={{ fontFamily: 'monospace', fontWeight: 600, color: pnl >= 0 ? '#22c55e' : '#ef4444' }}>
                      {pos.status === 'open' ? 'Open' : `${pnl >= 0 ? '+' : ''}$${pnl.toFixed(3)}`}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

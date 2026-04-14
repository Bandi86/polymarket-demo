'use client';

import { useState, useEffect, useCallback } from 'react';

interface LiveStats {
  daily: {
    pnl: number;
    trades: number;
    wins: number;
    losses: number;
    winRate: string;
    roi: string;
  };
  monthly: {
    pnl: number;
    trades: number;
  };
  performance: {
    totalVolume: number;
    avgTradeSize: number;
    bestTrade: { profit: number; market: string; timestamp: number } | null;
    worstTrade: { loss: number; market: string; timestamp: number } | null;
    winStreak: number;
    lossStreak: number;
  };
  health: {
    status: string;
    apiLatency: number;
    errorCount: number;
  };
}

interface LiveState {
  isLiveMode: boolean;
  isConnected: boolean;
  balance: number;
  availableBalance: number;
  lockedBalance: number;
  totalBankroll: number;
  freeBankroll: number;
  positionsCount: number;
  health: {
    status: string;
    apiLatency: number;
    errorCount: number;
    warningCount: number;
  };
  alertsCount: number;
}

interface BotLiveSettings {
  botId: string;
  botName: string;
  strategy: string;
  enabled: boolean;
  maxBankrollPercent: number;
  riskLevel: string;
  autoStopLoss: number;
  dailyProfitTarget: number;
  maxDailyTrades: number;
  cooldownAfterLoss: number;
}

export default function LiveModeDashboard() {
  const [liveState, setLiveState] = useState<LiveState | null>(null);
  const [liveStats, setLiveStats] = useState<LiveStats | null>(null);
  const [botSettings, setBotSettings] = useState<BotLiveSettings[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingBot, setEditingBot] = useState<string | null>(null);

  const fetchLiveData = useCallback(async () => {
    try {
      const [stateRes, statsRes, settingsRes] = await Promise.all([
        fetch('/api/live/status'),
        fetch('/api/live/stats'),
        fetch('/api/live/bots/settings'),
      ]);

      if (stateRes.ok) {
        const stateData = await stateRes.json();
        setLiveState(stateData);
      }

      if (statsRes.ok) {
        const statsData = await statsRes.json();
        setLiveStats(statsData);
      }

      if (settingsRes.ok) {
        const settingsData = await settingsRes.json();
        setBotSettings(settingsData);
      }
    } catch (err) {
      console.error('Failed to fetch live data:', err);
    }
  }, []);

  useEffect(() => {
    fetchLiveData();
    const interval = setInterval(fetchLiveData, 10000);
    return () => clearInterval(interval);
  }, [fetchLiveData]);

  const enableLiveMode = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/live/status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'enable' }),
      });

      const data = await res.json();

      if (!data.success) {
        setError(data.error || 'Failed to enable live mode');
      } else {
        await fetchLiveData();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  };

  const disableLiveMode = async () => {
    setIsLoading(true);
    try {
      await fetch('/api/live/status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'disable' }),
      });
      await fetchLiveData();
    } finally {
      setIsLoading(false);
    }
  };

  const updateBotSettings = async (botId: string, settings: Partial<BotLiveSettings>) => {
    try {
      await fetch('/api/live/bots/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ botId, settings }),
      });
      await fetchLiveData();
      setEditingBot(null);
    } catch (err) {
      console.error('Failed to update bot settings:', err);
    }
  };

  const refreshBalance = async () => {
    try {
      await fetch('/api/live/balance');
      await fetchLiveData();
    } catch (err) {
      console.error('Failed to refresh balance:', err);
    }
  };

  // Not in live mode - show enable button
  if (!liveState?.isLiveMode) {
    return (
      <div className="p-6 bg-gradient-to-br from-slate-900 to-slate-800 rounded-xl border border-slate-700">
        <h2 className="text-2xl font-bold text-white mb-4">🔴 Live Mode</h2>
        <p className="text-slate-400 mb-6">
          Connect to Polymarket with real USDC to trade with actual funds.
        </p>

        <div className="bg-slate-800/50 rounded-lg p-4 mb-6">
          <h3 className="text-lg font-semibold text-white mb-2">Requirements</h3>
          <ul className="text-slate-400 space-y-2">
            <li className="flex items-center gap-2">
              <span className="text-green-400">✓</span> POLYMARKET_PRIVATE_KEY in .env
            </li>
            <li className="flex items-center gap-2">
              <span className="text-yellow-400">○</span> USDC deposited to Polymarket
            </li>
            <li className="flex items-center gap-2">
              <span className="text-yellow-400">○</span> Polygon network (chainId: 137)
            </li>
          </ul>
        </div>

        {error && (
          <div className="bg-red-900/30 border border-red-700 rounded-lg p-4 mb-4">
            <p className="text-red-400">{error}</p>
          </div>
        )}

        <button
          onClick={enableLiveMode}
          disabled={isLoading}
          className="w-full py-3 px-6 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 text-white font-semibold rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isLoading ? 'Connecting...' : '🚀 Enable Live Mode'}
        </button>

        <p className="text-xs text-slate-500 mt-4 text-center">
          ⚠️ Real money at risk. Only enable if you understand the risks.
        </p>
      </div>
    );
  }

  // Live mode is active
  return (
    <div className="space-y-6">
      {/* Status Header */}
      <div className="p-6 bg-gradient-to-br from-green-900/30 to-slate-900 rounded-xl border border-green-700/50">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            <span className="w-3 h-3 bg-green-500 rounded-full animate-pulse" />
            Live Mode Active
          </h2>
          <button
            onClick={disableLiveMode}
            className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-lg transition-colors"
          >
            Disable Live Mode
          </button>
        </div>

        {/* Balance Cards */}
        <div className="grid grid-cols-4 gap-4 mb-4">
          <div className="bg-slate-800/50 rounded-lg p-4">
            <p className="text-slate-400 text-sm">Total Balance</p>
            <p className="text-2xl font-bold text-white">${(liveState.balance ?? 0).toFixed(2)}</p>
          </div>
          <div className="bg-slate-800/50 rounded-lg p-4">
            <p className="text-slate-400 text-sm">Available</p>
            <p className="text-xl font-semibold text-green-400">${(liveState.availableBalance ?? 0).toFixed(2)}</p>
          </div>
          <div className="bg-slate-800/50 rounded-lg p-4">
            <p className="text-slate-400 text-sm">Locked</p>
            <p className="text-xl font-semibold text-yellow-400">${(liveState.lockedBalance ?? 0).toFixed(2)}</p>
          </div>
          <div className="bg-slate-800/50 rounded-lg p-4">
            <p className="text-slate-400 text-sm">Open Positions</p>
            <p className="text-xl font-semibold text-blue-400">{liveState.positionsCount}</p>
          </div>
        </div>

        {/* Health Status */}
        <div className="flex items-center gap-4 text-sm">
          <span className={`px-2 py-1 rounded ${
            liveState.health.status === 'healthy' ? 'bg-green-900/50 text-green-400' :
            liveState.health.status === 'degraded' ? 'bg-yellow-900/50 text-yellow-400' :
            'bg-red-900/50 text-red-400'
          }`}>
            {liveState.health.status.toUpperCase()}
          </span>
          <span className="text-slate-400">API Latency: {liveState.health.apiLatency}ms</span>
          {liveState.alertsCount > 0 && (
            <span className="px-2 py-1 bg-orange-900/50 text-orange-400 rounded">
              {liveState.alertsCount} Alert{liveState.alertsCount > 1 ? 's' : ''}
            </span>
          )}
          <button
            onClick={refreshBalance}
            className="ml-auto px-3 py-1 bg-slate-700 hover:bg-slate-600 text-white rounded transition-colors"
          >
            🔄 Refresh
          </button>
        </div>
      </div>

      {/* Stats Grid */}
      {liveStats && (
        <div className="grid grid-cols-2 gap-4">
          {/* Daily Stats */}
          <div className="p-4 bg-slate-800/50 rounded-xl border border-slate-700">
            <h3 className="text-lg font-semibold text-white mb-3">📈 Today</h3>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-slate-400">P&L</span>
                <span className={(liveStats.daily.pnl ?? 0) >= 0 ? 'text-green-400' : 'text-red-400'}>
                  ${(liveStats.daily.pnl ?? 0).toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Trades</span>
                <span className="text-white">{liveStats.daily.trades}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Win Rate</span>
                <span className="text-white">{liveStats.daily.winRate}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">ROI</span>
                <span className={parseFloat(liveStats.daily.roi) >= 0 ? 'text-green-400' : 'text-red-400'}>
                  {liveStats.daily.roi}%
                </span>
              </div>
            </div>
          </div>

          {/* Performance */}
          <div className="p-4 bg-slate-800/50 rounded-xl border border-slate-700">
            <h3 className="text-lg font-semibold text-white mb-3">🎯 Performance</h3>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-slate-400">Total Volume</span>
                <span className="text-white">${liveStats.performance.totalVolume.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Avg Trade</span>
                <span className="text-white">${liveStats.performance.avgTradeSize.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Win Streak</span>
                <span className="text-green-400">{liveStats.performance.winStreak}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Loss Streak</span>
                <span className="text-red-400">{liveStats.performance.lossStreak}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Bot Settings */}
      <div className="p-4 bg-slate-800/50 rounded-xl border border-slate-700">
        <h3 className="text-lg font-semibold text-white mb-4">🤖 Bot Live Settings</h3>
        <div className="space-y-3">
          {botSettings.map((bot) => (
            <div
              key={bot.botId}
              className={`p-3 rounded-lg border ${
                bot.enabled
                  ? 'bg-green-900/20 border-green-700/50'
                  : 'bg-slate-700/30 border-slate-600'
              }`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <span className="font-medium text-white">{bot.botName}</span>
                  <span className="text-slate-400 text-sm ml-2">({bot.strategy})</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-xs px-2 py-0.5 rounded ${
                    bot.riskLevel === 'conservative' ? 'bg-blue-900/50 text-blue-400' :
                    bot.riskLevel === 'aggressive' ? 'bg-red-900/50 text-red-400' :
                    'bg-yellow-900/50 text-yellow-400'
                  }`}>
                    {bot.riskLevel}
                  </span>
                  <button
                    onClick={() => setEditingBot(editingBot === bot.botId ? null : bot.botId)}
                    className="px-2 py-1 text-xs bg-slate-600 hover:bg-slate-500 text-white rounded"
                  >
                    {editingBot === bot.botId ? 'Cancel' : 'Edit'}
                  </button>
                  <button
                    onClick={() => updateBotSettings(bot.botId, { enabled: !bot.enabled })}
                    className={`px-3 py-1 text-xs rounded ${
                      bot.enabled
                        ? 'bg-red-600 hover:bg-red-500 text-white'
                        : 'bg-green-600 hover:bg-green-500 text-white'
                    }`}
                  >
                    {bot.enabled ? 'Disable' : 'Enable'}
                  </button>
                </div>
              </div>

              {editingBot === bot.botId && (
                <div className="mt-3 pt-3 border-t border-slate-600 space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-xs text-slate-400">Bankroll %</label>
                      <input
                        type="number"
                        defaultValue={bot.maxBankrollPercent}
                        className="w-full px-2 py-1 bg-slate-700 text-white rounded text-sm"
                        onChange={(e) => {
                          const value = parseFloat(e.target.value);
                          if (!isNaN(value)) {
                            updateBotSettings(bot.botId, { maxBankrollPercent: value });
                          }
                        }}
                      />
                    </div>
                    <div>
                      <label className="text-xs text-slate-400">Risk Level</label>
                      <select
                        defaultValue={bot.riskLevel}
                        className="w-full px-2 py-1 bg-slate-700 text-white rounded text-sm"
                        onChange={(e) => updateBotSettings(bot.botId, { riskLevel: e.target.value as 'conservative' | 'moderate' | 'aggressive' })}
                      >
                        <option value="conservative">Conservative</option>
                        <option value="moderate">Moderate</option>
                        <option value="aggressive">Aggressive</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-xs text-slate-400">Stop Loss %</label>
                      <input
                        type="number"
                        defaultValue={bot.autoStopLoss}
                        className="w-full px-2 py-1 bg-slate-700 text-white rounded text-sm"
                        onChange={(e) => {
                          const value = parseFloat(e.target.value);
                          if (!isNaN(value)) {
                            updateBotSettings(bot.botId, { autoStopLoss: value });
                          }
                        }}
                      />
                    </div>
                    <div>
                      <label className="text-xs text-slate-400">Daily Target $</label>
                      <input
                        type="number"
                        defaultValue={bot.dailyProfitTarget}
                        className="w-full px-2 py-1 bg-slate-700 text-white rounded text-sm"
                        onChange={(e) => {
                          const value = parseFloat(e.target.value);
                          if (!isNaN(value)) {
                            updateBotSettings(bot.botId, { dailyProfitTarget: value });
                          }
                        }}
                      />
                    </div>
                    <div>
                      <label className="text-xs text-slate-400">Max Daily Trades</label>
                      <input
                        type="number"
                        defaultValue={bot.maxDailyTrades}
                        className="w-full px-2 py-1 bg-slate-700 text-white rounded text-sm"
                        onChange={(e) => {
                          const value = parseInt(e.target.value);
                          if (!isNaN(value)) {
                            updateBotSettings(bot.botId, { maxDailyTrades: value });
                          }
                        }}
                      />
                    </div>
                    <div>
                      <label className="text-xs text-slate-400">Cooldown (min)</label>
                      <input
                        type="number"
                        defaultValue={bot.cooldownAfterLoss}
                        className="w-full px-2 py-1 bg-slate-700 text-white rounded text-sm"
                        onChange={(e) => {
                          const value = parseInt(e.target.value);
                          if (!isNaN(value)) {
                            updateBotSettings(bot.botId, { cooldownAfterLoss: value });
                          }
                        }}
                      />
                    </div>
                  </div>
                </div>
              )}

              <div className="mt-2 text-xs text-slate-400">
                Max {bot.maxBankrollPercent}% bankroll • Stop at {bot.autoStopLoss}% loss
                {bot.dailyProfitTarget > 0 && ` • Target: $${bot.dailyProfitTarget}`}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
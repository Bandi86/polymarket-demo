'use client'

import { Bell, X, Check, CheckCheck, Trash2, Settings, Filter, TrendingUp, BarChart3, Clock } from 'lucide-react';
import { useNotifications } from '@/lib/notifications';
import { motion, AnimatePresence } from 'framer-motion';
import { useState, useMemo } from 'react';

export function NotificationCenter() {
  const {
    notifications,
    unread,
    unreadCount,
    preferences,
    markAllAsRead,
    clearAll,
    setPreferences,
    getBotStreak,
  } = useNotifications();

  const [isOpen, setIsOpen] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [filterType, setFilterType] = useState<'all' | 'trade' | 'settlement' | 'session_complete' | 'error'>('all');
  const [groupByBot, setGroupByBot] = useState(true);
  const [expandedBots, setExpandedBots] = useState<Set<string>>(new Set(['all']));

  const formatTime = (timestamp: number) => {
    const diff = Date.now() - timestamp;
    const minutes = Math.floor(diff / 60000);
    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'trade': return '📊';
      case 'settlement': return '✓';
      case 'session_complete': return '🏆';
      case 'error': return '✕';
      case 'warning': return '⚠';
      case 'info': return 'ℹ';
      default: return '📬';
    }
  };

  const getNotificationColor = (type: string) => {
    switch (type) {
      case 'trade': return 'border-blue-500/30 bg-blue-500/5';
      case 'settlement': return 'border-green-500/30 bg-green-500/5';
      case 'session_complete': return 'border-purple-500/30 bg-purple-500/5';
      case 'error': return 'border-red-500/30 bg-red-500/5';
      case 'warning': return 'border-amber-500/30 bg-amber-500/5';
      case 'info': return 'border-gray-500/30 bg-gray-500/5';
      default: return 'border-gray-500/30 bg-gray-500/5';
    }
  };

  // Extract bot name from notification title
  const extractBotName = (title: string): string => {
    const match = title.match(/^([^ ]+)/);
    return match ? match[0] : 'Other';
  };

  // Group notifications by bot
  const groupedNotifications = useMemo(() => {
    if (!groupByBot) {
      return { all: notifications };
    }

    const groups: Record<string, typeof notifications> = {};
    notifications.forEach(notif => {
      const botName = extractBotName(notif.title);
      if (!groups[botName]) {
        groups[botName] = [];
      }
      groups[botName].push(notif);
    });
    return groups;
  }, [notifications, groupByBot]);

  // Filter notifications
  const filteredNotifications = useMemo(() => {
    if (filterType === 'all') return notifications;
    return notifications.filter(n => n.type === filterType);
  }, [notifications, filterType]);

  // Calculate statistics
  const stats = useMemo(() => {
    const trades = notifications.filter(n => n.type === 'trade');
    const settlements = notifications.filter(n => n.type === 'settlement');
    const wins = settlements.filter(s => s.data?.won === true);
    const losses = settlements.filter(s => s.data?.won === false);
    const errors = notifications.filter(n => n.type === 'error');

    return {
      totalTrades: trades.length,
      totalSettlements: settlements.length,
      wins: wins.length,
      losses: losses.length,
      winRate: settlements.length > 0 ? (wins.length / settlements.length) * 100 : 0,
      errors: errors.length,
    };
  }, [notifications]);

  const toggleBotGroup = (botName: string) => {
    const newExpanded = new Set(expandedBots);
    if (newExpanded.has(botName)) {
      newExpanded.delete(botName);
    } else {
      newExpanded.add(botName);
    }
    setExpandedBots(newExpanded);
  };

  return (
    <>
      {/* Bell Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 rounded-lg hover:bg-white/5 transition-colors"
        style={{ position: 'relative' }}
      >
        <Bell className="w-5 h-5" style={{ color: 'var(--text-secondary)' }} />
        {unreadCount > 0 && (
          <span
            className="absolute -top-1 -right-1 flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[10px] font-bold rounded-full"
            style={{
              background: '#ef4444',
              color: 'white',
              boxShadow: '0 0 8px rgba(239, 68, 68, 0.5)',
            }}
          >
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Notification Panel */}
      <AnimatePresence>
        {isOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsOpen(false)}
              style={{
                position: 'fixed',
                inset: 0,
                zIndex: 9998,
              }}
            />

            {/* Panel */}
            <motion.div
              initial={{ opacity: 0, y: -10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.95 }}
              style={{
                position: 'fixed',
                top: 'calc(64px + 1rem)',
                right: '1rem',
                width: 450,
                maxHeight: 'calc(100vh - 64px - 2rem)',
                background: 'rgba(11, 11, 15, 0.98)',
                backdropFilter: 'blur(20px)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: 16,
                boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
                zIndex: 9999,
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              {/* Header */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '1rem 1.25rem',
                  borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <span style={{ fontWeight: 700, fontSize: '1rem' }}>Notifications</span>
                  {unreadCount > 0 && (
                    <span
                      className="px-2 py-0.5 text-[10px] font-bold rounded-full"
                      style={{
                        background: 'rgba(239, 68, 68, 0.15)',
                        color: '#ef4444',
                      }}
                    >
                      {unreadCount} new
                    </span>
                  )}
                </div>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  {unread.length > 0 && (
                    <button
                      onClick={markAllAsRead}
                      className="p-1.5 rounded-lg hover:bg-white/5 transition-colors"
                      title="Mark all as read"
                    >
                      <CheckCheck className="w-4 h-4" style={{ color: 'var(--text-muted)' }} />
                    </button>
                  )}
                  <button
                    onClick={() => setShowSettings(!showSettings)}
                    className="p-1.5 rounded-lg hover:bg-white/5 transition-colors"
                    title="Settings"
                  >
                    <Settings className="w-4 h-4" style={{ color: 'var(--text-muted)' }} />
                  </button>
                  <button
                    onClick={() => setIsOpen(false)}
                    className="p-1.5 rounded-lg hover:bg-white/5 transition-colors"
                  >
                    <X className="w-4 h-4" style={{ color: 'var(--text-muted)' }} />
                  </button>
                </div>
              </div>

              {/* Statistics Bar */}
              {notifications.length > 0 && (
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(4, 1fr)',
                    gap: '0.5rem',
                    padding: '0.75rem 1.25rem',
                    borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
                    background: 'rgba(255, 255, 255, 0.02)',
                  }}
                >
                  <StatItem icon="📊" label="Trades" value={stats.totalTrades} color="#3b82f6" />
                  <StatItem icon="✓" label="Wins" value={stats.wins} color="#22c55e" />
                  <StatItem icon="✕" label="Losses" value={stats.losses} color="#ef4444" />
                  <StatItem icon="%" label="Win Rate" value={`${stats.winRate.toFixed(0)}%`} color="#a855f7" />
                </div>
              )}

              {/* Settings Panel */}
              {showSettings && (
                <div
                  style={{
                    padding: '1rem 1.25rem',
                    borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
                  }}
                >
                  <div style={{ fontSize: '0.75rem', fontWeight: 600, marginBottom: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Notification Preferences
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    <ToggleRow
                      label="All Notifications"
                      checked={preferences.enabled}
                      onChange={(v) => setPreferences({ enabled: v })}
                    />
                    <ToggleRow
                      label="Trade Alerts"
                      checked={preferences.tradeEnabled}
                      onChange={(v) => setPreferences({ tradeEnabled: v })}
                      disabled={!preferences.enabled}
                    />
                    <ToggleRow
                      label="Settlement Alerts"
                      checked={preferences.settlementEnabled}
                      onChange={(v) => setPreferences({ settlementEnabled: v })}
                      disabled={!preferences.enabled}
                    />
                    <ToggleRow
                      label="Session Complete"
                      checked={preferences.sessionCompleteEnabled}
                      onChange={(v) => setPreferences({ sessionCompleteEnabled: v })}
                      disabled={!preferences.enabled}
                    />
                    <ToggleRow
                      label="Sound Effects"
                      checked={preferences.soundEnabled}
                      onChange={(v) => setPreferences({ soundEnabled: v })}
                    />
                  </div>
                </div>
              )}

              {/* Filter Bar */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  padding: '0.75rem 1.25rem',
                  borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
                }}
              >
                <Filter className="w-3.5 h-3.5" style={{ color: 'var(--text-muted)' }} />
                <div style={{ display: 'flex', gap: '0.25rem', flex: 1, overflowX: 'auto' }}>
                  <FilterChip active={filterType === 'all'} onClick={() => setFilterType('all')} label="All" count={notifications.length} />
                  <FilterChip active={filterType === 'trade'} onClick={() => setFilterType('trade')} label="Trades" count={stats.totalTrades} />
                  <FilterChip active={filterType === 'settlement'} onClick={() => setFilterType('settlement')} label="Settlements" count={stats.totalSettlements} />
                  <FilterChip active={filterType === 'error'} onClick={() => setFilterType('error')} label="Errors" count={stats.errors} />
                </div>
                <button
                  onClick={() => setGroupByBot(!groupByBot)}
                  className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
                    groupByBot ? 'bg-blue-500/20 text-blue-400' : 'bg-white/5 text-gray-400 hover:bg-white/10'
                  }`}
                >
                  Group by Bot
                </button>
              </div>

              {/* Notifications List */}
              <div
                style={{
                  flex: 1,
                  overflowY: 'auto',
                  padding: '0.75rem',
                }}
              >
                {filteredNotifications.length === 0 ? (
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      padding: '3rem 1rem',
                      textAlign: 'center',
                      color: 'var(--text-muted)',
                    }}
                  >
                    <Bell className="w-12 h-12 mb-3 opacity-20" />
                    <div style={{ fontSize: '0.875rem', fontWeight: 500 }}>No notifications yet</div>
                    <div style={{ fontSize: '0.75rem', marginTop: '0.25rem' }}>
                      When bots start trading, you'll see notifications here
                    </div>
                  </div>
                ) : groupByBot ? (
                  // Grouped view
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    {Object.entries(groupedNotifications).map(([botName, botNotifs]) => {
                      const filteredBotNotifs = botNotifs.filter(n =>
                        filterType === 'all' || n.type === filterType
                      );
                      if (filteredBotNotifs.length === 0) return null;

                      const isExpanded = expandedBots.has(botName);
                      const botWins = filteredBotNotifs.filter(n => n.data?.won === true).length;
                      const botLosses = filteredBotNotifs.filter(n => n.data?.won === false).length;
                      const botTrades = filteredBotNotifs.filter(n => n.type === 'trade').length;

                      return (
                        <BotGroup
                          key={botName}
                          botName={botName}
                          notifications={filteredBotNotifs}
                          isExpanded={isExpanded}
                          onToggle={() => toggleBotGroup(botName)}
                          stats={{ trades: botTrades, wins: botWins, losses: botLosses }}
                          getNotificationIcon={getNotificationIcon}
                          getNotificationColor={getNotificationColor}
                          formatTime={formatTime}
                          getBotStreak={getBotStreak}
                        />
                      );
                    })}
                  </div>
                ) : (
                  // Flat view
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {filteredNotifications.map((notif) => (
                      <NotificationItem
                        key={notif.id}
                        notification={notif}
                        icon={getNotificationIcon(notif.type)}
                        colorClass={getNotificationColor(notif.type)}
                        formatTime={formatTime}
                      />
                    ))}
                  </div>
                )}
              </div>

              {/* Footer */}
              {filteredNotifications.length > 0 && (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '0.75rem 1.25rem',
                    borderTop: '1px solid rgba(255, 255, 255, 0.05)',
                  }}
                >
                  <button
                    onClick={clearAll}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg hover:bg-white/5 transition-colors text-xs font-medium"
                    style={{ color: 'var(--text-muted)' }}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Clear all
                  </button>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                    Showing {filteredNotifications.length} notification{filteredNotifications.length !== 1 ? 's' : ''}
                  </div>
                </div>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}

// === Sub-components ===

function StatItem({ icon, label, value, color }: { icon: string; label: string; value: string | number; color: string }) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '0.25rem',
        padding: '0.5rem',
        background: 'rgba(255, 255, 255, 0.03)',
        borderRadius: 8,
      }}
    >
      <span style={{ fontSize: '1rem' }}>{icon}</span>
      <span style={{ fontSize: '0.875rem', fontWeight: 700, color }}>{typeof value === 'number' ? value.toLocaleString() : value}</span>
      <span style={{ fontSize: '0.6rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>{label}</span>
    </div>
  );
}

function FilterChip({ active, onClick, label, count }: { active: boolean; onClick: () => void; label: string; count: number }) {
  return (
    <button
      onClick={onClick}
      className={`px-2.5 py-1 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
        active
          ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
          : 'bg-white/5 text-gray-400 hover:bg-white/10 border border-transparent'
      }`}
    >
      {label} ({count})
    </button>
  );
}

function ToggleRow({
  label,
  checked,
  onChange,
  disabled,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}
    >
      <span style={{ fontSize: '0.8rem', color: disabled ? 'var(--text-muted)' : 'var(--text-secondary)' }}>
        {label}
      </span>
      <button
        onClick={() => !disabled && onChange(!checked)}
        className="relative w-10 h-5 rounded-full transition-colors"
        style={{
          background: checked && !disabled ? 'rgba(34, 197, 94, 0.5)' : 'rgba(255, 255, 255, 0.1)',
          cursor: disabled ? 'not-allowed' : 'pointer',
          opacity: disabled ? 0.5 : 1,
        }}
      >
        <span
          className="absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform"
          style={{
            transform: checked ? 'translateX(20px)' : 'translateX(0)',
          }}
        />
      </button>
    </div>
  );
}

function BotGroup({
  botName,
  notifications,
  isExpanded,
  onToggle,
  stats,
  getNotificationIcon,
  getNotificationColor,
  formatTime,
  getBotStreak,
}: {
  botName: string;
  notifications: import('@/lib/notifications').Notification[];
  isExpanded: boolean;
  onToggle: () => void;
  stats: { trades: number; wins: number; losses: number };
  getNotificationIcon: (type: string) => string;
  getNotificationColor: (type: string) => string;
  formatTime: (ts: number) => string;
  getBotStreak: (botName: string) => { consecutive: number; wins: number; losses: number } | null;
}) {
  const latestNotif = notifications[0];
  const winRate = stats.trades > 0 ? ((stats.wins / stats.trades) * 100).toFixed(0) : '0';
  const streak = getBotStreak(botName);
  const streakConsecutive = streak?.consecutive || 0;
  const streakColor = streakConsecutive > 0 ? '#22c55e' : streakConsecutive < 0 ? '#ef4444' : '#6b7280';
  const streakIcon = streakConsecutive > 0 ? '🔥' : streakConsecutive < 0 ? '📉' : '➖';

  return (
    <div
      style={{
        border: '1px solid rgba(255, 255, 255, 0.08)',
        borderRadius: 12,
        background: 'rgba(255, 255, 255, 0.02)',
        overflow: 'hidden',
      }}
    >
      {/* Bot Header */}
      <button
        onClick={onToggle}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0.75rem 1rem',
          width: '100%',
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flex: 1 }}>
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.2), rgba(147, 51, 234, 0.2))',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <BarChart3 className="w-4 h-4" style={{ color: '#60a5fa' }} />
          </div>
          <div style={{ textAlign: 'left' }}>
            <div style={{ fontWeight: 600, fontSize: '0.875rem', color: 'var(--text-primary)' }}>{botName}</div>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span>{stats.trades} trades • {winRate}% win rate</span>
              <span style={{ color: streakColor, display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                {streakIcon} {Math.abs(streakConsecutive)} {streakConsecutive > 0 ? 'win' : streakConsecutive < 0 ? 'loss' : ''} streak
              </span>
            </div>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Last activity: {formatTime(latestNotif.timestamp)}</div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <div
            style={{
              display: 'flex',
              gap: '0.25rem',
              fontSize: '0.65rem',
              padding: '0.25rem 0.5rem',
              background: 'rgba(34, 197, 94, 0.1)',
              borderRadius: 4,
              color: '#22c55e',
            }}
          >
            <span>W: {stats.wins}</span>
            <span style={{ color: 'rgba(255,255,255,0.3)' }}>|</span>
            <span style={{ color: '#ef4444' }}>L: {stats.losses}</span>
          </div>
          <motion.div
            animate={{ rotate: isExpanded ? 180 : 0 }}
            transition={{ duration: 0.2 }}
          >
            <svg className="w-4 h-4" style={{ color: 'var(--text-muted)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </motion.div>
        </div>
      </button>

      {/* Expanded Notifications */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            style={{ overflow: 'hidden' }}
          >
            <div style={{ padding: '0 1rem 1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {notifications.map((notif) => (
                <NotificationItem
                  key={notif.id}
                  notification={notif}
                  icon={getNotificationIcon(notif.type)}
                  colorClass={getNotificationColor(notif.type)}
                  formatTime={formatTime}
                  compact
                />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function NotificationItem({
  notification,
  icon,
  colorClass,
  formatTime,
  compact = false,
}: {
  notification: import('@/lib/notifications').Notification;
  icon: string;
  colorClass: string;
  formatTime: (ts: number) => string;
  compact?: boolean;
}) {
  const { markAsRead, clearNotification } = useNotifications();

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className={`rounded-lg border p-3 ${colorClass}`}
      style={{
        opacity: notification.read ? 0.6 : 1,
        padding: compact ? '0.5rem 0.75rem' : '0.75rem',
      }}
    >
      <div style={{ display: 'flex', gap: compact ? '0.5rem' : '0.75rem' }}>
        {/* Icon */}
        <div
          className="flex items-center justify-center flex-shrink-0 rounded-lg"
          style={{
            width: compact ? 28 : 36,
            height: compact ? 28 : 36,
            background: 'rgba(255, 255, 255, 0.05)',
            fontSize: compact ? '0.875rem' : '1.125rem',
          }}
        >
          {icon}
        </div>

        {/* Content */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              justifyContent: 'space-between',
              marginBottom: compact ? '0.15rem' : '0.25rem',
            }}
          >
            <span
              className={`font-semibold ${compact ? 'text-xs' : 'text-sm'}`}
              style={{
                color: notification.read ? 'var(--text-secondary)' : 'var(--text-primary)',
              }}
            >
              {notification.title}
            </span>
            <button
              onClick={() => clearNotification(notification.id)}
              className="p-0.5 rounded hover:bg-white/5 transition-colors"
              style={{ marginLeft: '0.5rem' }}
            >
              <X className="w-3 h-3" style={{ color: 'var(--text-muted)' }} />
            </button>
          </div>

          {notification.message && (
            <div
              className={`text-xs ${compact ? 'text-[10px]' : ''}`}
              style={{ color: 'var(--text-secondary)', marginBottom: compact ? '0.25rem' : '0.5rem' }}
            >
              {notification.message}
            </div>
          )}

          {/* Extended data for trades/settlements */}
          {!compact && notification.data && (
            <div
              style={{
                display: 'flex',
                gap: '0.75rem',
                fontSize: '0.65rem',
                color: 'var(--text-muted)',
                marginBottom: '0.5rem',
              }}
            >
              {(notification.data.strategy as string | undefined) && (
                <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                  <TrendingUp className="w-3 h-3" />
                  {notification.data.strategy as string}
                </span>
              )}
              {notification.data.balance !== undefined && (
                <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                  <BarChart3 className="w-3 h-3" />
                  Balance: ${(notification.data.balance as number).toFixed(2)}
                </span>
              )}
            </div>
          )}

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              fontSize: '0.65rem',
              color: 'var(--text-muted)',
            }}
          >
            <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
              <Clock className="w-3 h-3" />
              {formatTime(notification.timestamp)}
            </span>
            {!notification.read && (
              <>
                <span>•</span>
                <button
                  onClick={() => markAsRead(notification.id)}
                  className="flex items-center gap-1 hover:text-green-400 transition-colors"
                >
                  <Check className="w-3 h-3" />
                  Mark as read
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

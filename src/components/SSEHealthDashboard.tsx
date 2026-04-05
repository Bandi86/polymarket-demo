'use client';

import { Activity, AlertTriangle, CheckCircle, Wifi, WifiOff, Clock, TrendingUp, BarChart3 } from 'lucide-react';
import { useSSEHealth } from '@/hooks/useSSEHealth';
import { motion, AnimatePresence } from 'framer-motion';

export function SSEHealthDashboard() {
  const { isConnected, status, isHealthy, metrics, alerts, lastMessageTime } = useSSEHealth();

  const formatTime = (timestamp: number | null) => {
    if (!timestamp) return 'Never';
    const diff = Date.now() - timestamp;
    const seconds = Math.floor(diff / 1000);
    if (seconds < 60) return `${seconds}s ago`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    return `${hours}h ago`;
  };

  const getStatusIcon = () => {
    if (!isConnected) return WifiOff;
    if (status === 'healthy') return CheckCircle;
    if (status === 'degraded') return Activity;
    return AlertTriangle;
  };

  const getStatusColor = () => {
    if (!isConnected) return '#ef4444';
    if (status === 'healthy') return '#22c55e';
    if (status === 'degraded') return '#f59e0b';
    return '#ef4444';
  };

  const StatusIcon = getStatusIcon();
  const statusColor = getStatusColor();

  return (
    <div
      style={{
        background: 'rgba(11, 11, 15, 0.95)',
        backdropFilter: 'blur(20px)',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        borderRadius: 16,
        padding: '1.5rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '1.5rem',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingBottom: '1rem',
          borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div
            className="flex items-center justify-center rounded-lg w-10 h-10"
            style={{ background: `${statusColor}15` }}
          >
            <StatusIcon className="w-5 h-5" style={{ color: statusColor }} />
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: '1rem' }}>SSE Connection Health</div>
            <div
              style={{
                fontSize: '0.75rem',
                color: statusColor,
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
              }}
            >
              {status}
            </div>
          </div>
        </div>

        <div
          className="flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium"
          style={{
            background: isConnected ? 'rgba(34, 197, 94, 0.15)' : 'rgba(239, 68, 68, 0.15)',
            color: isConnected ? '#22c55e' : '#ef4444',
          }}
        >
          <div
            className="w-2 h-2 rounded-full animate-pulse"
            style={{ background: isConnected ? '#22c55e' : '#ef4444' }}
          />
          {isConnected ? 'Connected' : 'Disconnected'}
        </div>
      </div>

      {/* Metrics Grid */}
      <div
        className="grid grid-cols-2 md:grid-cols-4 gap-3"
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
          gap: '0.75rem',
        }}
      >
        <MetricCard
          icon={Wifi}
          label="Message Count"
          value={metrics.messageCount.toString()}
          color="#3b82f6"
        />
        <MetricCard
          icon={Clock}
          label="Last Message"
          value={formatTime(lastMessageTime)}
          color="#8b5cf6"
          subValue={metrics.avgLatency > 0 ? `${metrics.avgLatency.toFixed(0)}ms avg` : undefined}
        />
        <MetricCard
          icon={TrendingUp}
          label="Uptime"
          value={`${metrics.uptime.toFixed(1)}%`}
          color="#22c55e"
        />
        <MetricCard
          icon={BarChart3}
          label="Msg Frequency"
          value={`${metrics.messageFrequency.toFixed(2)}/s`}
          color="#f59e0b"
        />
      </div>

      {/* Secondary Metrics */}
      <div
        className="grid grid-cols-3 gap-3"
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: '0.75rem',
          padding: '1rem',
          background: 'rgba(255, 255, 255, 0.02)',
          borderRadius: 12,
          border: '1px solid rgba(255, 255, 255, 0.05)',
        }}
      >
        <MiniMetric
          label="Reconnects"
          value={metrics.reconnectCount}
          warnThreshold={3}
        />
        <MiniMetric
          label="Errors"
          value={metrics.errorCount}
          warnThreshold={10}
        />
        <MiniMetric
          label="Avg Latency"
          value={`${Math.round(metrics.avgLatency)}ms`}
          isLatency
          warnThreshold={5000}
        />
      </div>

      {/* Alerts */}
      <AnimatePresence>
        {alerts.length > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
          >
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '0.5rem',
                maxHeight: '200px',
                overflowY: 'auto',
              }}
            >
              {alerts.slice(-5).reverse().map((alert, index) => (
                <AlertItem key={alert.timestamp} alert={alert} isLatest={index === 0} />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* No Alerts Message */}
      {alerts.length === 0 && isHealthy && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            padding: '0.75rem 1rem',
            borderRadius: 8,
            background: 'rgba(34, 197, 94, 0.1)',
            border: '1px solid rgba(34, 197, 94, 0.2)',
          }}
        >
          <CheckCircle className="w-4 h-4" style={{ color: '#22c55e' }} />
          <span style={{ fontSize: '0.8rem', color: '#22c55e', fontWeight: 500 }}>
            All systems healthy
          </span>
        </div>
      )}
    </div>
  );
}

// === Sub-components ===

function MetricCard({
  icon: Icon,
  label,
  value,
  color,
  subValue,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  color: string;
  subValue?: string;
}) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '0.5rem',
        padding: '1rem',
        background: 'rgba(255, 255, 255, 0.02)',
        borderRadius: 12,
        border: '1px solid rgba(255, 255, 255, 0.05)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <Icon className="w-4 h-4" style={{ color }} />
        <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          {label}
        </span>
      </div>
      <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)' }}>
        {value}
      </div>
      {subValue && (
        <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>
          {subValue}
        </div>
      )}
    </div>
  );
}

function MiniMetric({
  label,
  value,
  warnThreshold,
  isLatency,
}: {
  label: string;
  value: number | string;
  warnThreshold?: number;
  isLatency?: boolean;
}) {
  const isWarning = typeof value === 'number' && warnThreshold && value >= warnThreshold;

  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>
        {label}
      </div>
      <div
        style={{
          fontSize: '1rem',
          fontWeight: 700,
          color: isWarning ? '#f59e0b' : 'var(--text-primary)',
        }}
      >
        {value}
      </div>
    </div>
  );
}

function AlertItem({ alert, isLatest }: { alert: any; isLatest: boolean }) {
  const getAlertColor = () => {
    if (alert.severity === 'critical') return '#ef4444';
    return '#f59e0b';
  };

  const getAlertIcon = () => {
    if (alert.severity === 'critical') return AlertTriangle;
    return Activity;
  };

  const AlertIcon = getAlertIcon();
  const color = getAlertColor();

  const formatAlertTime = (timestamp: number) => {
    const diff = Date.now() - timestamp;
    const seconds = Math.floor(diff / 1000);
    if (seconds < 60) return 'just now';
    const minutes = Math.floor(seconds / 60);
    return `${minutes}m ago`;
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -10 }}
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: '0.75rem',
        padding: '0.75rem',
        background: `${color}08`,
        border: `1px solid ${color}30`,
        borderRadius: 8,
      }}
    >
      <AlertIcon className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            marginBottom: '0.25rem',
          }}
        >
          <span
            className="px-1.5 py-0.5 rounded text-[10px] font-bold uppercase"
            style={{
              background: `${color}20`,
              color,
            }}
          >
            {alert.severity}
          </span>
          <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
            {formatAlertTime(alert.timestamp)}
          </span>
          {isLatest && (
            <span
              className="px-1.5 py-0.5 rounded text-[10px] font-bold"
              style={{ background: '#3b82f6', color: 'white' }}
            >
              NEW
            </span>
          )}
        </div>
        <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
          {alert.message}
        </div>
      </div>
    </motion.div>
  );
}

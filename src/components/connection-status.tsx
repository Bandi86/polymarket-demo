import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Wifi, WifiOff, AlertTriangle, RefreshCw } from "lucide-react";

export type ConnectionStatus = "connected" | "disconnected" | "reconnecting" | "degraded";

interface ConnectionStatusIndicatorProps {
  status: ConnectionStatus;
  latency?: number;
  lastUpdate?: number;
  onReconnect?: () => void;
  showLatency?: boolean;
  compact?: boolean;
}

export function ConnectionStatusIndicator({
  status,
  latency,
  lastUpdate,
  onReconnect,
  showLatency = true,
  compact = false,
}: ConnectionStatusIndicatorProps) {
  const [isStale, setIsStale] = useState(false);

  useEffect(() => {
    if (!lastUpdate) return;

    const checkStale = () => {
      const staleThreshold = 10000; // 10 seconds
      setIsStale(Date.now() - lastUpdate > staleThreshold);
    };

    checkStale();
    const interval = setInterval(checkStale, 1000);
    return () => clearInterval(interval);
  }, [lastUpdate]);

  const statusConfig = {
    connected: {
      icon: Wifi,
      color: "text-emerald-400",
      bgColor: "bg-emerald-500/20",
      label: "Connected",
      pulse: false,
    },
    disconnected: {
      icon: WifiOff,
      color: "text-red-400",
      bgColor: "bg-red-500/20",
      label: "Disconnected",
      pulse: true,
    },
    reconnecting: {
      icon: RefreshCw,
      color: "text-amber-400",
      bgColor: "bg-amber-500/20",
      label: "Reconnecting...",
      pulse: true,
    },
    degraded: {
      icon: AlertTriangle,
      color: "text-orange-400",
      bgColor: "bg-orange-500/20",
      label: "Degraded",
      pulse: true,
    },
  };

  const config = isStale && status === "connected" 
    ? statusConfig.degraded 
    : statusConfig[status];
  const Icon = config.icon;

  if (compact) {
    return (
      <motion.div
        className={`flex items-center gap-1.5 px-2 py-1 rounded-full ${config.bgColor}`}
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
      >
        <motion.div
          animate={config.pulse ? { scale: [1, 1.2, 1] } : {}}
          transition={{ duration: 1, repeat: config.pulse ? Infinity : 0 }}
        >
          <Icon className={`w-3.5 h-3.5 ${config.color}`} />
        </motion.div>
        {showLatency && latency !== undefined && status === "connected" && (
          <span className="text-xs text-[var(--color-text-secondary)]">{latency}ms</span>
        )}
      </motion.div>
    );
  }

  return (
    <div className="flex items-center gap-3">
      <motion.div
        className={`flex items-center gap-2 px-3 py-1.5 rounded-lg ${config.bgColor}`}
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        key={status}
      >
        <motion.div
          animate={config.pulse ? { scale: [1, 1.1, 1] } : {}}
          transition={{ duration: 0.8, repeat: config.pulse ? Infinity : 0 }}
        >
          <Icon className={`w-4 h-4 ${config.color}`} />
        </motion.div>

        <AnimatePresence mode="wait">
          <motion.span
            key={config.label}
            initial={{ opacity: 0, y: -5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 5 }}
            className={`text-sm font-medium ${config.color}`}
          >
            {config.label}
          </motion.span>
        </AnimatePresence>

        {showLatency && latency !== undefined && status === "connected" && (
          <span className="text-xs text-[var(--color-text-secondary)]">
            {latency}ms
          </span>
        )}
      </motion.div>

      {(status === "disconnected" || status === "reconnecting") && onReconnect && (
        <motion.button
          onClick={onReconnect}
          className="flex items-center gap-1 px-2 py-1 text-xs rounded bg-[var(--color-surface)] hover:bg-[var(--color-surface-hover)] text-[var(--color-text-secondary)] transition-colors"
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          <RefreshCw className="w-3 h-3" />
          Retry
        </motion.button>
      )}
    </div>
  );
}

// Latency graph for performance monitoring
interface LatencyGraphProps {
  data: number[];
  height?: number;
  width?: number;
}

export function LatencyGraph({ data, height = 30, width = 100 }: LatencyGraphProps) {
  const maxLatency = Math.max(...data, 100);

  const points = data
    .map((latency, i) => {
      const x = (i / (data.length - 1)) * width;
      const y = height - (latency / maxLatency) * height;
      return `${x},${y}`;
    })
    .join(" ");

  const getLatencyColor = (latency: number) => {
    if (latency < 100) return "#22c55e";
    if (latency < 300) return "#f59e0b";
    return "#ef4444";
  };

  const avgLatency = data.reduce((a, b) => a + b, 0) / data.length;
  const color = getLatencyColor(avgLatency);

  return (
    <svg width={width} height={height} className="overflow-visible">
      <motion.polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        initial={{ pathLength: 0, opacity: 0 }}
        animate={{ pathLength: 1, opacity: 1 }}
        transition={{ duration: 0.5 }}
      />
    </svg>
  );
}
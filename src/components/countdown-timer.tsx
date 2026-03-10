import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface CountdownTimerProps {
  endTime: number;
  onExpire?: () => void;
  showSeconds?: boolean;
  size?: "sm" | "md" | "lg";
}

export function CountdownTimer({
  endTime,
  onExpire,
  showSeconds = true,
  size = "md",
}: CountdownTimerProps) {
  const [timeRemaining, setTimeRemaining] = useState(Math.max(0, endTime - Date.now()));

  useEffect(() => {
    const interval = setInterval(() => {
      const remaining = Math.max(0, endTime - Date.now());
      setTimeRemaining(remaining);
      if (remaining === 0 && onExpire) {
        onExpire();
      }
    }, 100);

    return () => clearInterval(interval);
  }, [endTime, onExpire]);

  const formatTime = (ms: number) => {
    const totalSeconds = Math.floor(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    const milliseconds = Math.floor((ms % 1000) / 100);

    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
    }
    if (showSeconds) {
      return `${minutes}:${seconds.toString().padStart(2, "0")}.${milliseconds}`;
    }
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  };

  // Determine urgency level
  const getUrgency = () => {
    const seconds = timeRemaining / 1000;
    if (seconds <= 10) return "critical";
    if (seconds <= 30) return "urgent";
    if (seconds <= 60) return "warning";
    return "normal";
  };

  const urgency = getUrgency();

  const sizeStyles = {
    sm: "text-sm font-medium",
    md: "text-lg font-semibold",
    lg: "text-2xl font-bold",
  };

  const urgencyStyles = {
    normal: "text-[var(--color-text-secondary)]",
    warning: "text-amber-400",
    urgent: "text-orange-400",
    critical: "text-red-400 animate-pulse",
  };

  return (
    <motion.div
      className={`flex items-center gap-1.5 ${sizeStyles[size]} ${urgencyStyles[urgency]}`}
      animate={urgency === "critical" ? { scale: [1, 1.02, 1] } : {}}
      transition={{ duration: 0.5, repeat: urgency === "critical" ? Infinity : 0 }}
    >
      <AnimatePresence mode="wait">
        <motion.span
          key={Math.floor(timeRemaining / 1000)}
          initial={{ y: -10, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 10, opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="tabular-nums"
        >
          {formatTime(timeRemaining)}
        </motion.span>
      </AnimatePresence>

      {/* Urgency indicator dot */}
      {urgency !== "normal" && (
        <motion.span
          className={`w-2 h-2 rounded-full ${
            urgency === "critical" ? "bg-red-500" : urgency === "urgent" ? "bg-orange-500" : "bg-amber-500"
          }`}
          animate={{ scale: [1, 1.2, 1], opacity: [1, 0.7, 1] }}
          transition={{ duration: 0.5, repeat: Infinity }}
        />
      )}
    </motion.div>
  );
}

// Progress bar with countdown
interface CountdownProgressProps {
  startTime: number;
  endTime: number;
  height?: number;
  showLabel?: boolean;
}

export function CountdownProgress({
  startTime,
  endTime,
  height = 4,
  showLabel = true,
}: CountdownProgressProps) {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const updateProgress = () => {
      const now = Date.now();
      const total = endTime - startTime;
      const elapsed = now - startTime;
      const pct = Math.min(100, Math.max(0, (elapsed / total) * 100));
      setProgress(pct);
    };

    updateProgress();
    const interval = setInterval(updateProgress, 100);
    return () => clearInterval(interval);
  }, [startTime, endTime]);

  const getProgressColor = () => {
    if (progress >= 95) return "bg-red-500";
    if (progress >= 80) return "bg-orange-500";
    if (progress >= 60) return "bg-amber-500";
    return "bg-[var(--color-primary)]";
  };

  return (
    <div className="w-full">
      <div
        className="w-full bg-[var(--color-surface)] rounded-full overflow-hidden"
        style={{ height }}
      >
        <motion.div
          className={`h-full rounded-full ${getProgressColor()}`}
          initial={{ width: 0 }}
          animate={{ width: `${progress}%` }}
          transition={{ duration: 0.1 }}
        />
      </div>
      {showLabel && (
        <div className="flex justify-between mt-1 text-xs text-[var(--color-text-muted)]">
          <span>Start</span>
          <span>{progress.toFixed(0)}%</span>
          <span>End</span>
        </div>
      )}
    </div>
  );
}
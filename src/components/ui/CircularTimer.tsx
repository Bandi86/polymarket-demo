import { useEffect, useState } from "react";
import { Timer } from "lucide-react";

interface CircularTimerProps {
  timeRemaining: number;
  totalDuration: number;
  size?: number;
  strokeWidth?: number;
  showLabel?: boolean;
}

export function CircularTimer({
  timeRemaining,
  totalDuration,
  size = 80,
  strokeWidth = 6,
  showLabel = true,
}: CircularTimerProps) {
  const [pulse, setPulse] = useState(false);

  // Calculate progress (0 to 1, where 1 is full time remaining)
  const progress = totalDuration > 0 ? timeRemaining / totalDuration : 0;
  const progressPercent = progress * 100;

  // Determine color based on time remaining
  const getColor = () => {
    if (progressPercent < 20) return { stroke: "#ef4444", glow: "rgba(239, 68, 68, 0.5)" };
    if (progressPercent < 40) return { stroke: "#f59e0b", glow: "rgba(245, 158, 11, 0.5)" };
    return { stroke: "#22c55e", glow: "rgba(34, 197, 94, 0.3)" };
  };

  const colors = getColor();

  // Pulse animation when low time
  useEffect(() => {
    if (progressPercent < 20) {
      const interval = setInterval(() => {
        setPulse((p) => !p);
      }, 500);
      return () => clearInterval(interval);
    }
  }, [progressPercent]);

  // Format time
  const formatTime = (ms: number) => {
    if (!ms || ms <= 0) return "0:00";
    const totalSeconds = Math.floor(ms / 1000);
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  // SVG calculations
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference * (1 - progress);

  return (
    <div
      style={{
        position: "relative",
        width: size,
        height: size,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {/* Background circle */}
      <svg
        width={size}
        height={size}
        style={{ position: "absolute", transform: "rotate(-90deg)" }}
      >
        {/* Background track */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="rgba(255, 255, 255, 0.1)"
          strokeWidth={strokeWidth}
        />
        {/* Progress circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={colors.stroke}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          style={{
            transition: "stroke-dashoffset 0.5s ease, stroke 0.3s ease",
            filter: `drop-shadow(0 0 6px ${colors.glow})`,
            opacity: pulse ? 0.7 : 1,
          }}
        />
      </svg>

      {/* Center content */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 1,
        }}
      >
        <span
          style={{
            fontFamily: "ui-monospace, monospace",
            fontSize: size > 60 ? "1rem" : "0.75rem",
            fontWeight: 700,
            color: colors.stroke,
            textShadow: `0 0 10px ${colors.glow}`,
          }}
        >
          {formatTime(timeRemaining)}
        </span>
        {showLabel && (
          <span
            style={{
              fontSize: "0.5rem",
              color: "var(--text-muted)",
              textTransform: "uppercase",
              letterSpacing: "0.05em",
            }}
          >
            left
          </span>
        )}
      </div>
    </div>
  );
}

// Bot Run Timer - Prominent display for competition/run countdown
interface BotRunTimerProps {
  runTimeRemaining: number;
  isRunning: boolean;
  totalDuration?: number;
}

export function BotRunTimer({ runTimeRemaining, isRunning, totalDuration }: BotRunTimerProps) {
  const [flash, setFlash] = useState(false);

  // Flash when < 1 minute
  useEffect(() => {
    if (isRunning && runTimeRemaining > 0 && runTimeRemaining < 60000) {
      const interval = setInterval(() => {
        setFlash((f) => !f);
      }, 500);
      return () => clearInterval(interval);
    }
  }, [isRunning, runTimeRemaining]);

  const formatTime = (ms: number) => {
    if (!ms || ms <= 0) return "0:00";
    const totalSeconds = Math.floor(ms / 1000);
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const isLowTime = runTimeRemaining < 60000;

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "0.5rem",
        padding: "0.5rem 1rem",
        borderRadius: 12,
        background: isRunning
          ? isLowTime
            ? "linear-gradient(135deg, rgba(239, 68, 68, 0.2), rgba(239, 68, 68, 0.1))"
            : "linear-gradient(135deg, rgba(34, 197, 94, 0.2), rgba(34, 197, 94, 0.1))"
          : "rgba(107, 114, 128, 0.1)",
        border: `1px solid ${isRunning ? (isLowTime ? "rgba(239, 68, 68, 0.3)" : "rgba(34, 197, 94, 0.3)") : "var(--border)"}`,
        opacity: flash ? 0.6 : 1,
        transition: "opacity 0.2s",
      }}
    >
      <Timer
        style={{
          width: 18,
          height: 18,
          color: isRunning ? (isLowTime ? "#ef4444" : "#22c55e") : "#6b7280",
        }}
      />
      <div style={{ display: "flex", flexDirection: "column" }}>
        <span
          style={{
            fontFamily: "ui-monospace, monospace",
            fontSize: "1.125rem",
            fontWeight: 700,
            color: isRunning ? (isLowTime ? "#ef4444" : "#22c55e") : "#6b7280",
          }}
        >
          {isRunning ? formatTime(runTimeRemaining) : "STOPPED"}
        </span>
        {totalDuration && isRunning && (
          <div
            style={{
              width: 60,
              height: 3,
              background: "rgba(255,255,255,0.1)",
              borderRadius: 2,
              overflow: "hidden",
            }}
          >
            <div
              style={{
                width: `${(runTimeRemaining / totalDuration) * 100}%`,
                height: "100%",
                background: isLowTime ? "#ef4444" : "#22c55e",
                borderRadius: 2,
                transition: "width 1s linear",
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
}
'use client'

import { cn } from '@/lib/utils';

interface ProgressRingProps {
  value: number; // 0-100
  size?: number;
  strokeWidth?: number;
  showValue?: boolean;
  className?: string;
}

export function ProgressRing({
  value,
  size = 60,
  strokeWidth = 4,
  showValue = false,
  className,
}: ProgressRingProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const clampedValue = Math.max(0, Math.min(100, value));
  const offset = circumference - (clampedValue / 100) * circumference;

  // Determine color based on value
  const getColor = () => {
    if (clampedValue >= 70) return 'hsl(142 71% 45%)'; // success
    if (clampedValue >= 40) return 'hsl(38 92% 50%)'; // warning
    return 'hsl(0 84% 60%)'; // danger
  };

  const color = getColor();

  return (
    <div className={cn('relative inline-flex items-center justify-center', className)}>
      <svg width={size} height={size} className="-rotate-90">
        {/* Background circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="hsl(217 33% 17%)"
          strokeWidth={strokeWidth}
        />
        {/* Progress circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="transition-all duration-500 ease-out"
        />
      </svg>
      {showValue && (
        <span className="absolute text-xs font-mono font-semibold" style={{ color }}>
          {Math.round(clampedValue)}%
        </span>
      )}
    </div>
  );
}
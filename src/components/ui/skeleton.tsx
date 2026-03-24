'use client'

import { motion } from "framer-motion";

interface SkeletonProps {
  className?: string;
  variant?: "text" | "circular" | "rectangular" | "card";
  width?: string | number;
  height?: string | number;
  animate?: boolean;
}

export function Skeleton({
  className = "",
  variant = "rectangular",
  width,
  height,
  animate = true,
}: SkeletonProps) {
  const baseClasses = "bg-[var(--color-surface-elevated)] relative overflow-hidden";
  
  const variantClasses = {
    text: "rounded h-4",
    circular: "rounded-full",
    rectangular: "rounded-lg",
    card: "rounded-xl",
  };

  const style: React.CSSProperties = {};
  if (width) style.width = typeof width === "number" ? `${width}px` : width;
  if (height) style.height = typeof height === "number" ? `${height}px` : height;

  return (
    <motion.div
      className={`${baseClasses} ${variantClasses[variant]} ${className}`}
      style={style}
      initial={animate ? { opacity: 0.5 } : undefined}
      animate={animate ? { opacity: 1 } : undefined}
      transition={animate ? { duration: 1, repeat: Infinity, repeatType: "reverse" } : undefined}
    >
      {animate && (
        <motion.div
          className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent"
          initial={{ x: "-100%" }}
          animate={{ x: "100%" }}
          transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
        />
      )}
    </motion.div>
  );
}

// Pre-built skeleton layouts
export function MarketPanelSkeleton() {
  return (
    <div className="p-4 space-y-4 rounded-xl bg-[var(--color-card)] border border-[var(--color-border)]">
      <div className="flex items-center justify-between">
        <Skeleton width={120} height={24} />
        <Skeleton width={60} height={24} variant="circular" />
      </div>
      <div className="space-y-2">
        <Skeleton width="80%" height={16} />
        <Skeleton width="60%" height={16} />
      </div>
      <div className="flex gap-2">
        <Skeleton width={80} height={32} />
        <Skeleton width={80} height={32} />
        <Skeleton width={80} height={32} />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <Skeleton height={80} variant="card" />
        <Skeleton height={80} variant="card" />
      </div>
    </div>
  );
}

export function ChartPanelSkeleton() {
  return (
    <div className="p-4 rounded-xl bg-[var(--color-card)] border border-[var(--color-border)]">
      <div className="flex items-center justify-between mb-4">
        <Skeleton width={100} height={20} />
        <div className="flex gap-2">
          <Skeleton width={60} height={24} />
          <Skeleton width={60} height={24} />
        </div>
      </div>
      <Skeleton height={300} variant="rectangular" className="w-full" />
    </div>
  );
}

export function TradingPanelSkeleton() {
  return (
    <div className="p-4 space-y-4 rounded-xl bg-[var(--color-card)] border border-[var(--color-border)]">
      <Skeleton width={120} height={20} />
      <div className="space-y-3">
        <Skeleton height={40} />
        <div className="grid grid-cols-2 gap-2">
          <Skeleton height={48} />
          <Skeleton height={48} />
        </div>
      </div>
      <div className="pt-4 border-t border-[var(--color-border)] space-y-2">
        <Skeleton width="60%" height={16} />
        <Skeleton width="40%" height={16} />
      </div>
    </div>
  );
}

export function BotPanelSkeleton() {
  return (
    <div className="p-4 space-y-4 rounded-xl bg-[var(--color-card)] border border-[var(--color-border)]">
      <div className="flex items-center justify-between">
        <Skeleton width={80} height={20} />
        <Skeleton width={60} height={24} />
      </div>
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex items-center gap-3 p-2 rounded-lg bg-[var(--color-surface)]">
            <Skeleton width={32} height={32} variant="circular" />
            <div className="flex-1 space-y-1">
              <Skeleton width="60%" height={14} />
              <Skeleton width="40%" height={12} />
            </div>
            <Skeleton width={50} height={20} />
          </div>
        ))}
      </div>
    </div>
  );
}

export function PortfolioPanelSkeleton() {
  return (
    <div className="p-4 space-y-4 rounded-xl bg-[var(--color-card)] border border-[var(--color-border)]">
      <Skeleton width={100} height={20} />
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1">
          <Skeleton width="50%" height={12} />
          <Skeleton width="80%" height={24} />
        </div>
        <div className="space-y-1">
          <Skeleton width="50%" height={12} />
          <Skeleton width="80%" height={24} />
        </div>
      </div>
      <Skeleton height={100} variant="rectangular" />
    </div>
  );
}

export function ActivityLogSkeleton() {
  return (
    <div className="p-4 space-y-3 rounded-xl bg-[var(--color-card)] border border-[var(--color-border)]">
      <Skeleton width={80} height={20} />
      <div className="space-y-2">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="flex items-center gap-2 p-2 rounded bg-[var(--color-surface)]">
            <Skeleton width={24} height={24} variant="circular" />
            <div className="flex-1">
              <Skeleton width="70%" height={14} />
            </div>
            <Skeleton width={40} height={12} />
          </div>
        ))}
      </div>
    </div>
  );
}
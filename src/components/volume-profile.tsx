'use client'

import { useMemo } from "react";
import { motion } from "framer-motion";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  ResponsiveContainer,
  Tooltip,
  Cell,
} from "recharts";

interface VolumeProfileProps {
  data: Array<{ price: number; volume: number; side: "buy" | "sell" }>;
  priceLevels?: number;
  height?: number;
}

export function VolumeProfile({ data, priceLevels = 20, height = 300 }: VolumeProfileProps) {
  const profileData = useMemo(() => {
    if (data.length === 0) return [];

    // Group by price levels
    const prices = data.map((d) => d.price);
    const minPrice = Math.min(...prices);
    const maxPrice = Math.max(...prices);
    const priceStep = (maxPrice - minPrice) / priceLevels;

    const levels: Array<{ price: number; buyVolume: number; sellVolume: number }> = [];

    for (let i = 0; i < priceLevels; i++) {
      const priceFrom = minPrice + i * priceStep;
      const priceTo = minPrice + (i + 1) * priceStep;
      const midpoint = (priceFrom + priceTo) / 2;

      const buyVolume = data
        .filter((d) => d.price >= priceFrom && d.price < priceTo && d.side === "buy")
        .reduce((sum, d) => sum + d.volume, 0);

      const sellVolume = data
        .filter((d) => d.price >= priceFrom && d.price < priceTo && d.side === "sell")
        .reduce((sum, d) => sum + d.volume, 0);

      levels.push({ price: midpoint, buyVolume, sellVolume });
    }

    return levels;
  }, [data, priceLevels]);

  const maxVolume = Math.max(
    ...profileData.map((d) => Math.max(d.buyVolume, d.sellVolume)),
    1
  );

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      style={{ width: "100%", height }}
    >
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={profileData}
          layout="vertical"
          margin={{ top: 5, right: 20, left: 40, bottom: 5 }}
        >
          <XAxis
            type="number"
            hide
            domain={[0, maxVolume]}
          />
          <YAxis
            type="category"
            dataKey="price"
            stroke="var(--color-text-muted)"
            fontSize={10}
            tickFormatter={(v) => `${(v * 100).toFixed(0)}¢`}
          />
          <Tooltip
            contentStyle={{
              background: "var(--color-card)",
              border: "1px solid var(--color-border)",
              borderRadius: "8px",
              fontSize: "11px",
            }}
            formatter={(value, name) => [
              `$${Number(value).toFixed(2)}`,
              name === "buyVolume" ? "Buy Volume" : "Sell Volume",
            ]}
          />
          <Bar
            dataKey="buyVolume"
            stackId="a"
            fill="#22c55e"
            opacity={0.7}
            isAnimationActive
            animationDuration={500}
          />
          <Bar
            dataKey="sellVolume"
            stackId="a"
            fill="#ef4444"
            opacity={0.7}
            isAnimationActive
            animationDuration={500}
          />
        </BarChart>
      </ResponsiveContainer>
    </motion.div>
  );
}

// Horizontal volume bars for order book visualization
interface VolumeBarProps {
  buyVolume: number;
  sellVolume: number;
  maxVolume: number;
  height?: number;
}

export function VolumeBar({ buyVolume, sellVolume, maxVolume, height = 24 }: VolumeBarProps) {
  const buyWidth = (buyVolume / maxVolume) * 50; // 50% max for each side
  const sellWidth = (sellVolume / maxVolume) * 50;

  return (
    <div className="relative flex items-center" style={{ height }}>
      {/* Sell volume (left side) */}
      <div className="flex-1 flex justify-end">
        <motion.div
          className="h-full bg-red-500/30 rounded-l"
          initial={{ width: 0 }}
          animate={{ width: `${sellWidth}%` }}
          transition={{ duration: 0.3 }}
        />
      </div>

      {/* Center line */}
      <div className="w-px h-full bg-[var(--color-border)]" />

      {/* Buy volume (right side) */}
      <div className="flex-1">
        <motion.div
          className="h-full bg-emerald-500/30 rounded-r"
          initial={{ width: 0 }}
          animate={{ width: `${buyWidth}%` }}
          transition={{ duration: 0.3 }}
        />
      </div>
    </div>
  );
}
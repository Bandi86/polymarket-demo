import { useMemo } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Area,
  AreaChart,
  ReferenceLine,
} from "recharts";
import { motion, AnimatePresence } from "framer-motion";

interface PriceChartProps {
  data: Array<{ timestamp: number; price: number }>;
  yesPrice?: number;
  noPrice?: number;
  color?: string;
  height?: number;
  showGrid?: boolean;
  animate?: boolean;
}

export function AnimatedPriceChart({
  data,
  yesPrice,
  noPrice,
  color = "#3b82f6",
  height = 200,
  showGrid = true,
  animate = true,
}: PriceChartProps) {
  const chartData = useMemo(() => {
    return data.map((point) => ({
      ...point,
      time: new Date(point.timestamp).toLocaleTimeString(),
    }));
  }, [data]);

  const priceDomain = useMemo(() => {
    if (chartData.length === 0) return [0, 1];
    const prices = chartData.map((d) => d.price);
    const min = Math.min(...prices);
    const max = Math.max(...prices);
    const padding = (max - min) * 0.1;
    return [Math.max(0, min - padding), Math.min(1, max + padding)];
  }, [chartData]);

  return (
    <motion.div
      initial={animate ? { opacity: 0 } : false}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
      style={{ width: "100%", height }}
    >
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id={`color-${color.replace("#", "")}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={color} stopOpacity={0.3} />
              <stop offset="95%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          {showGrid && (
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="var(--color-border)"
              vertical={false}
            />
          )}
          <XAxis
            dataKey="time"
            stroke="var(--color-text-muted)"
            fontSize={10}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            domain={priceDomain}
            stroke="var(--color-text-muted)"
            fontSize={10}
            tickLine={false}
            axisLine={false}
            tickFormatter={(v) => `${(v * 100).toFixed(0)}¢`}
          />
          <Tooltip
            contentStyle={{
              background: "var(--color-card)",
              border: "1px solid var(--color-border)",
              borderRadius: "8px",
              fontSize: "12px",
            }}
            labelStyle={{ color: "var(--color-text-primary)" }}
            formatter={(value) => [`${(Number(value) * 100).toFixed(1)}¢`, "Price"]}
          />
          {yesPrice !== undefined && (
            <ReferenceLine
              y={yesPrice}
              stroke="#22c55e"
              strokeDasharray="5 5"
              label={{ value: "YES", fontSize: 10, fill: "#22c55e" }}
            />
          )}
          {noPrice !== undefined && (
            <ReferenceLine
              y={noPrice}
              stroke="#ef4444"
              strokeDasharray="5 5"
              label={{ value: "NO", fontSize: 10, fill: "#ef4444" }}
            />
          )}
          <Area
            type="monotone"
            dataKey="price"
            stroke={color}
            strokeWidth={2}
            fill={`url(#color-${color.replace("#", "")})`}
            isAnimationActive={animate}
            animationDuration={1000}
          />
        </AreaChart>
      </ResponsiveContainer>
    </motion.div>
  );
}

// Combined YES/NO price chart
interface YesNoChartProps {
  data: Array<{ timestamp: number; yesPrice: number; noPrice: number }>;
  height?: number;
}

export function YesNoPriceChart({ data, height = 200 }: YesNoChartProps) {
  const chartData = useMemo(() => {
    return data.map((point) => ({
      ...point,
      time: new Date(point.timestamp).toLocaleTimeString(),
    }));
  }, [data]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
      style={{ width: "100%", height }}
    >
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
          <XAxis
            dataKey="time"
            stroke="var(--color-text-muted)"
            fontSize={10}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            domain={[0, 1]}
            stroke="var(--color-text-muted)"
            fontSize={10}
            tickLine={false}
            axisLine={false}
            tickFormatter={(v) => `${(v * 100).toFixed(0)}¢`}
          />
          <Tooltip
            contentStyle={{
              background: "var(--color-card)",
              border: "1px solid var(--color-border)",
              borderRadius: "8px",
              fontSize: "12px",
            }}
            formatter={(value, name) => [
              `${(Number(value) * 100).toFixed(1)}¢`,
              name === "yesPrice" ? "YES" : "NO",
            ]}
          />
          <Line
            type="monotone"
            dataKey="yesPrice"
            stroke="#22c55e"
            strokeWidth={2}
            dot={false}
            name="YES"
            isAnimationActive
            animationDuration={1000}
          />
          <Line
            type="monotone"
            dataKey="noPrice"
            stroke="#ef4444"
            strokeWidth={2}
            dot={false}
            name="NO"
            isAnimationActive
            animationDuration={1000}
          />
        </LineChart>
      </ResponsiveContainer>
    </motion.div>
  );
}

// Mini sparkline for compact displays
interface SparklineProps {
  data: number[];
  color?: string;
  width?: number;
  height?: number;
}

export function Sparkline({ data, color = "#3b82f6", width = 60, height = 20 }: SparklineProps) {
  const points = useMemo(() => {
    if (data.length < 2) return "";
    const min = Math.min(...data);
    const max = Math.max(...data);
    const range = max - min || 1;

    return data
      .map((value, index) => {
        const x = (index / (data.length - 1)) * width;
        const y = height - ((value - min) / range) * height;
        return `${x},${y}`;
      })
      .join(" ");
  }, [data, width, height]);

  const trend = data.length >= 2 ? data[data.length - 1] >= data[0] : true;
  const strokeColor = trend ? "#22c55e" : "#ef4444";

  return (
    <svg width={width} height={height} className="overflow-visible">
      <motion.polyline
        points={points}
        fill="none"
        stroke={color || strokeColor}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 1, ease: "easeOut" }}
      />
    </svg>
  );
}
import { useMemo } from "react";
import {
  ComposedChart,
  Line,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import { motion } from "framer-motion";

interface Candle {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
}

interface CandlestickChartProps {
  data: Array<{ timestamp: number; price: number }>;
  interval?: number; // ms per candle
  height?: number;
  showVolume?: boolean;
}

export function CandlestickChart({
  data,
  interval = 60000, // 1 minute candles by default
  height = 300,
  showVolume = true,
}: CandlestickChartProps) {
  const candleData = useMemo(() => {
    if (data.length < 2) return [];

    const candles: Candle[] = [];
    let currentCandle: Partial<Candle> | null = null;

    for (const point of data) {
      const candleTime = Math.floor(point.timestamp / interval) * interval;

      if (!currentCandle || currentCandle.timestamp !== candleTime) {
        if (currentCandle?.open !== undefined) {
          candles.push(currentCandle as Candle);
        }
        currentCandle = {
          timestamp: candleTime,
          open: point.price,
          high: point.price,
          low: point.price,
          close: point.price,
          volume: 1,
        };
      } else {
        currentCandle.high = Math.max(currentCandle.high!, point.price);
        currentCandle.low = Math.min(currentCandle.low!, point.price);
        currentCandle.close = point.price;
        currentCandle.volume = (currentCandle.volume || 0) + 1;
      }
    }

    if (currentCandle?.open !== undefined) {
      candles.push(currentCandle as Candle);
    }

    return candles;
  }, [data, interval]);

  const chartData = useMemo(() => {
    return candleData.map((candle) => ({
      ...candle,
      time: new Date(candle.timestamp).toLocaleTimeString(),
      isUp: candle.close >= candle.open,
      // For the bar, we need to handle the candlestick rendering
      bodyLow: Math.min(candle.open, candle.close),
      bodyHigh: Math.max(candle.open, candle.close),
      wickLow: candle.low,
      wickHigh: candle.high,
    }));
  }, [candleData]);

  const priceDomain = useMemo(() => {
    if (chartData.length === 0) return [0, 1];
    const allPrices = chartData.flatMap((d) => [d.high, d.low]);
    const min = Math.min(...allPrices);
    const max = Math.max(...allPrices);
    const padding = (max - min) * 0.1;
    return [min - padding, max + padding];
  }, [chartData]);

  const volumeDomain = useMemo(() => {
    if (chartData.length === 0) return [0, 10];
    const volumes = chartData.map((d) => d.volume || 0);
    return [0, Math.max(...volumes)];
  }, [chartData]);

  if (chartData.length === 0) {
    return (
      <div style={{ height }} className="flex items-center justify-center text-[var(--color-text-muted)]">
        No candlestick data available
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      style={{ width: "100%", height }}
    >
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
          <XAxis
            dataKey="time"
            stroke="var(--color-text-muted)"
            fontSize={10}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            yAxisId="price"
            domain={priceDomain}
            stroke="var(--color-text-muted)"
            fontSize={10}
            tickLine={false}
            axisLine={false}
            tickFormatter={(v) => `${(v * 100).toFixed(0)}¢`}
          />
          {showVolume && (
            <YAxis
              yAxisId="volume"
              orientation="right"
              domain={volumeDomain}
              stroke="var(--color-text-muted)"
              fontSize={10}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v) => `${v}`}
              hide
            />
          )}
          <Tooltip
            contentStyle={{
              background: "var(--color-card)",
              border: "1px solid var(--color-border)",
              borderRadius: "8px",
              fontSize: "11px",
            }}
            formatter={(value, name) => [
              `${(Number(value) * 100).toFixed(1)}¢`,
              name,
            ]}
          />

          {/* Volume bars */}
          {showVolume && (
            <Bar
              yAxisId="volume"
              dataKey="volume"
              fill="var(--color-primary)"
              opacity={0.3}
              barSize={4}
            />
          )}

          {/* Candlestick wicks */}
          <Line
            yAxisId="price"
            type="monotone"
            dataKey="wickHigh"
            stroke="transparent"
            dot={false}
            activeDot={false}
          />
          <Line
            yAxisId="price"
            type="monotone"
            dataKey="wickLow"
            stroke="transparent"
            dot={false}
            activeDot={false}
          />

          {/* Candlestick bodies - using ReferenceLine for each candle */}
          {chartData.map((d, i) => (
            <ReferenceLine
              key={i}
              yAxisId="price"
              y={d.close}
              stroke={d.isUp ? "#22c55e" : "#ef4444"}
              strokeWidth={2}
              ifOverflow="extendDomain"
            />
          ))}

          {/* Close price line */}
          <Line
            yAxisId="price"
            type="monotone"
            dataKey="close"
            stroke="var(--color-primary)"
            strokeWidth={1}
            dot={false}
            isAnimationActive
            animationDuration={500}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </motion.div>
  );
}

// Simplified OHLC display
interface OHLCProps {
  open: number;
  high: number;
  low: number;
  close: number;
  previousClose?: number;
}

export function OHLCDisplay({ open, high, low, close, previousClose }: OHLCProps) {
  const change = previousClose ? close - previousClose : close - open;
  const changePercent = previousClose ? (change / previousClose) * 100 : (change / open) * 100;
  const isUp = change >= 0;

  return (
    <div className="flex items-center gap-4 text-xs">
      <div className="flex flex-col">
        <span className="text-[var(--color-text-muted)]">O</span>
        <span className="font-mono">{(open * 100).toFixed(1)}¢</span>
      </div>
      <div className="flex flex-col">
        <span className="text-[var(--color-text-muted)]">H</span>
        <span className="font-mono text-emerald-400">{(high * 100).toFixed(1)}¢</span>
      </div>
      <div className="flex flex-col">
        <span className="text-[var(--color-text-muted)]">L</span>
        <span className="font-mono text-red-400">{(low * 100).toFixed(1)}¢</span>
      </div>
      <div className="flex flex-col">
        <span className="text-[var(--color-text-muted)]">C</span>
        <span className="font-mono">{(close * 100).toFixed(1)}¢</span>
      </div>
      <div className="flex flex-col">
        <span className="text-[var(--color-text-muted)]">Chg</span>
        <motion.span
          className={`font-mono ${isUp ? "text-emerald-400" : "text-red-400"}`}
          key={change}
          initial={{ y: -5, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
        >
          {isUp ? "+" : ""}{(changePercent).toFixed(2)}%
        </motion.span>
      </div>
    </div>
  );
}
import { useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface OrderBookEntry {
  price: number;
  size: number;
  total: number;
}

interface OrderBookProps {
  yesBids: OrderBookEntry[];
  yesAsks: OrderBookEntry[];
  noBids: OrderBookEntry[];
  noAsks: OrderBookEntry[];
  maxDepth?: number;
}

export function OrderBook({ yesBids, yesAsks, noBids, noAsks, maxDepth = 10 }: OrderBookProps) {
  const maxTotal = useMemo(() => {
    const allTotals = [
      ...yesBids.map((b) => b.total),
      ...yesAsks.map((a) => a.total),
      ...noBids.map((b) => b.total),
      ...noAsks.map((a) => a.total),
    ];
    return Math.max(...allTotals, 1);
  }, [yesBids, yesAsks, noBids, noAsks]);

  const formatPrice = (price: number) => `${(price * 100).toFixed(1)}¢`;
  const formatSize = (size: number) => size.toFixed(2);

  return (
    <div className="grid grid-cols-2 gap-4">
      {/* YES Side */}
      <div className="space-y-1">
        <div className="flex items-center justify-between text-xs text-[var(--color-text-secondary)] px-1 mb-2">
          <span>YES Bids</span>
          <span>Spread</span>
          <span>YES Asks</span>
        </div>
        
        {/* Asks (sell orders) - displayed reversed so highest is at top */}
        <div className="space-y-0.5">
          <AnimatePresence>
            {yesAsks.slice(0, maxDepth).reverse().map((ask, i) => (
              <OrderBookRow
                key={`yes-ask-${i}`}
                entry={ask}
                type="ask"
                maxTotal={maxTotal}
                formatPrice={formatPrice}
                formatSize={formatSize}
              />
            ))}
          </AnimatePresence>
        </div>

        {/* Spread */}
        <div className="py-2 px-1 text-center text-xs bg-[var(--color-surface)] rounded">
          <span className="text-[var(--color-text-secondary)]">Spread: </span>
          <span className="font-mono text-[var(--color-text-primary)]">
            {yesAsks.length > 0 && yesBids.length > 0
              ? formatPrice(yesAsks[0].price - yesBids[0].price)
              : "-"}
          </span>
        </div>

        {/* Bids (buy orders) */}
        <div className="space-y-0.5">
          <AnimatePresence>
            {yesBids.slice(0, maxDepth).map((bid, i) => (
              <OrderBookRow
                key={`yes-bid-${i}`}
                entry={bid}
                type="bid"
                maxTotal={maxTotal}
                formatPrice={formatPrice}
                formatSize={formatSize}
              />
            ))}
          </AnimatePresence>
        </div>
      </div>

      {/* NO Side */}
      <div className="space-y-1">
        <div className="flex items-center justify-between text-xs text-[var(--color-text-secondary)] px-1 mb-2">
          <span>NO Bids</span>
          <span>Spread</span>
          <span>NO Asks</span>
        </div>

        {/* Asks */}
        <div className="space-y-0.5">
          <AnimatePresence>
            {noAsks.slice(0, maxDepth).reverse().map((ask, i) => (
              <OrderBookRow
                key={`no-ask-${i}`}
                entry={ask}
                type="ask"
                maxTotal={maxTotal}
                formatPrice={formatPrice}
                formatSize={formatSize}
                colorScheme="inverse"
              />
            ))}
          </AnimatePresence>
        </div>

        {/* Spread */}
        <div className="py-2 px-1 text-center text-xs bg-[var(--color-surface)] rounded">
          <span className="text-[var(--color-text-secondary)]">Spread: </span>
          <span className="font-mono text-[var(--color-text-primary)]">
            {noAsks.length > 0 && noBids.length > 0
              ? formatPrice(noAsks[0].price - noBids[0].price)
              : "-"}
          </span>
        </div>

        {/* Bids */}
        <div className="space-y-0.5">
          <AnimatePresence>
            {noBids.slice(0, maxDepth).map((bid, i) => (
              <OrderBookRow
                key={`no-bid-${i}`}
                entry={bid}
                type="bid"
                maxTotal={maxTotal}
                formatPrice={formatPrice}
                formatSize={formatSize}
                colorScheme="inverse"
              />
            ))}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

interface OrderBookRowProps {
  entry: OrderBookEntry;
  type: "bid" | "ask";
  maxTotal: number;
  formatPrice: (p: number) => string;
  formatSize: (s: number) => string;
  colorScheme?: "normal" | "inverse";
}

function OrderBookRow({
  entry,
  type,
  maxTotal,
  formatPrice,
  formatSize,
  colorScheme = "normal",
}: OrderBookRowProps) {
  const width = (entry.total / maxTotal) * 100;

  const getColors = () => {
    if (colorScheme === "inverse") {
      return type === "bid"
        ? { bg: "bg-red-500/20", border: "border-red-500/30" }
        : { bg: "bg-emerald-500/20", border: "border-emerald-500/30" };
    }
    return type === "bid"
      ? { bg: "bg-emerald-500/20", border: "border-emerald-500/30" }
      : { bg: "bg-red-500/20", border: "border-red-500/30" };
  };

  const colors = getColors();

  return (
    <motion.div
      initial={{ opacity: 0, x: type === "bid" ? -10 : 10 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.15 }}
      className="relative flex items-center justify-between px-1 py-0.5 rounded text-xs font-mono"
    >
      {/* Depth bar */}
      <div
        className={`absolute inset-y-0 ${type === "bid" ? "right-0" : "left-0"} ${colors.bg} rounded transition-all duration-300`}
        style={{ width: `${width}%` }}
      />

      {/* Content */}
      <span className={`relative z-10 ${type === "ask" ? "text-red-400" : "text-emerald-400"}`}>
        {formatPrice(entry.price)}
      </span>
      <span className="relative z-10 text-[var(--color-text-secondary)]">
        {formatSize(entry.size)}
      </span>
      <span className="relative z-10 text-[var(--color-text-muted)]">
        {entry.total.toFixed(2)}
      </span>
    </motion.div>
  );
}

// Depth chart visualization
interface DepthChartProps {
  bids: OrderBookEntry[];
  asks: OrderBookEntry[];
  height?: number;
}

export function DepthChart({ bids, asks, height = 150 }: DepthChartProps) {
  const chartData = useMemo(() => {
    const bidPoints = bids.map((b) => ({ price: b.price, depth: b.total, type: "bid" }));
    const askPoints = asks.map((a) => ({ price: a.price, depth: a.total, type: "ask" }));
    return [...bidPoints.reverse(), ...askPoints];
  }, [bids, asks]);

  const maxDepth = Math.max(...chartData.map((d) => d.depth), 1);

  return (
    <div className="relative" style={{ height }}>
      <svg width="100%" height="100%" className="overflow-visible">
        {/* Bid depth (green, from left) */}
        <motion.path
          d={`
            M 0,${height}
            ${bids
              .slice(0, 20)
              .map((b, i) => {
                const x = (b.price * 100) + "%";
                const y = height - (b.total / maxDepth) * height;
                return `L ${x},${y}`;
              })
              .join(" ")}
            L ${(bids[0]?.price ?? 0.5) * 100}%,${height}
          `}
          fill="rgba(34, 197, 94, 0.3)"
          stroke="rgba(34, 197, 94, 0.8)"
          strokeWidth="1"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5 }}
        />

        {/* Ask depth (red, from right) */}
        <motion.path
          d={`
            M 100%,${height}
            ${asks
              .slice(0, 20)
              .map((a, i) => {
                const x = (a.price * 100) + "%";
                const y = height - (a.total / maxDepth) * height;
                return `L ${x},${y}`;
              })
              .join(" ")}
            L ${(asks[0]?.price ?? 0.5) * 100}%,${height}
          `}
          fill="rgba(239, 68, 68, 0.3)"
          stroke="rgba(239, 68, 68, 0.8)"
          strokeWidth="1"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.1 }}
        />

        {/* Mid price line */}
        <line
          x1="50%"
          y1="0"
          x2="50%"
          y2={height}
          stroke="var(--color-text-muted)"
          strokeDasharray="4 4"
          strokeWidth="1"
        />
      </svg>
    </div>
  );
}
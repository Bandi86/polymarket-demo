'use client'

interface PnLChartProps {
  data: { time: number; pnl: number }[];
  height?: number;
}

export function PnLChart({ data, height = 100 }: PnLChartProps) {
  if (data.length < 2) {
    return (
      <div style={{ height, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-muted)", fontSize: "0.75rem" }}>
        No data yet
      </div>
    );
  }

  const pnls = data.map(d => d.pnl);
  const minPnL = Math.min(...pnls, 0);
  const maxPnL = Math.max(...pnls, 0);
  const range = maxPnL - minPnL || 1;

  // Create SVG path
  const points = data.map((d, i) => {
    const x = (i / (data.length - 1)) * 100;
    const y = 100 - ((d.pnl - minPnL) / range) * 100;
    return `${x},${y}`;
  }).join(" ");

  const areaPoints = `0,100 ${points} 100,100`;
  const isPositive = data[data.length - 1].pnl >= 0;
  const color = isPositive ? "var(--green)" : "var(--red)";

  return (
    <div style={{ height, position: "relative" }}>
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" style={{ width: "100%", height: "100%" }}>
        <defs>
          <linearGradient id="pnlGradient" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor={color} stopOpacity="0.3" />
            <stop offset="100%" stopColor={color} stopOpacity="0.02" />
          </linearGradient>
        </defs>
        <polygon fill="url(#pnlGradient)" points={areaPoints} />
        <polyline
          fill="none"
          stroke={color}
          strokeWidth="1"
          points={points}
        />
      </svg>
      
      {/* Labels */}
      <div style={{ position: "absolute", left: 4, top: 4, fontSize: "0.65rem", color: "var(--text-muted)" }}>
        +${maxPnL.toFixed(0)}
      </div>
      <div style={{ position: "absolute", left: 4, bottom: 4, fontSize: "0.65rem", color: "var(--text-muted)" }}>
        ${minPnL.toFixed(0)}
      </div>
    </div>
  );
}

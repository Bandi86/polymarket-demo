import { BarChart3 } from "lucide-react";
import { cn } from "../lib/utils";
import { Card, CardHeader, CardTitle, CardContent } from "./ui/card";
import { Badge } from "./ui/badge";
import type { StrategyAnalysis } from "../types";

interface StrategyPanelProps {
  analysis: StrategyAnalysis | null;
}

export function StrategyPanel({ analysis }: StrategyPanelProps) {
  if (!analysis) return null;

  return (
    <Card className="mb-4">
      <CardHeader>
        <div className="flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-[var(--color-primary)]" />
          <CardTitle className="text-sm">Strategy Signals</CardTitle>
        </div>
        <Badge variant="info">Real-time</Badge>
      </CardHeader>
      <CardContent className="p-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="p-3 bg-[var(--color-surface-elevated)] rounded-lg">
            <p className="text-xs text-[var(--color-text-muted)] mb-1">Fair Value</p>
            <p className={cn("font-bold", analysis.fairValue?.action === "BUY_YES" ? "text-[var(--color-success)]" : analysis.fairValue?.action === "BUY_NO" ? "text-[var(--color-danger)]" : "text-[var(--color-text-secondary)]")}>
              {analysis.fairValue?.action || "HOLD"}
            </p>
            <p className="text-xs text-[var(--color-text-muted)] mt-1">
              Edge: {(analysis.fairValue?.edge || 0).toFixed(3)}
            </p>
          </div>
          <div className="p-3 bg-[var(--color-surface-elevated)] rounded-lg">
            <p className="text-xs text-[var(--color-text-muted)] mb-1">Anomaly</p>
            <p className={cn("font-bold", analysis.anomaly?.action === "BUY_BOTH" ? "text-[var(--color-primary)]" : "text-[var(--color-text-secondary)]")}>
              {analysis.anomaly?.action || "HOLD"}
            </p>
            <p className="text-xs text-[var(--color-text-muted)] mt-1">
              Sum: {(analysis.anomaly?.sum || 0).toFixed(3)}
            </p>
          </div>
          <div className="p-3 bg-[var(--color-surface-elevated)] rounded-lg">
            <p className="text-xs text-[var(--color-text-muted)] mb-1">Momentum</p>
            <p className={cn("font-bold", analysis.momentum?.action === "BUY_YES" ? "text-[var(--color-success)]" : analysis.momentum?.action === "BUY_NO" ? "text-[var(--color-danger)]" : "text-[var(--color-text-secondary)]")}>
              {analysis.momentum?.action || "HOLD"}
            </p>
            <p className="text-xs text-[var(--color-text-muted)] mt-1">
              {(analysis.momentum?.momentum || 0).toFixed(5)}
            </p>
          </div>
          <div className="p-3 bg-[var(--color-surface-elevated)] rounded-lg">
            <p className="text-xs text-[var(--color-text-muted)] mb-1">Volatility</p>
            <p className="font-bold text-[var(--color-text-primary)]">
              {(analysis.volatility || 0).toFixed(4)}
            </p>
            <p className="text-xs text-[var(--color-text-muted)] mt-1">
              2min σ
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

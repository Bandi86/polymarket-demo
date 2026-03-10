import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { cn } from "../lib/utils";
import { TrendingUp, TrendingDown, Minus, Activity, Zap, Target } from "lucide-react";
import type { StrategyAnalysis } from "../types";

interface StrategyPanelProps {
  analysis: StrategyAnalysis | null;
}

export function StrategyPanel({ analysis }: StrategyPanelProps) {
  if (!analysis) return null;

  const getActionColor = (action: string) => {
    if (action.includes("BUY_YES") || action === "BUY") return "text-emerald-400";
    if (action.includes("BUY_NO") || action === "SELL") return "text-red-400";
    return "text-[var(--color-text-secondary)]";
  };

  const getActionIcon = (action: string) => {
    if (action.includes("BUY_YES") || action === "BUY") return TrendingUp;
    if (action.includes("BUY_NO") || action === "SELL") return TrendingDown;
    return Minus;
  };

  const ActionIcon = getActionIcon(analysis.recommendation.action);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Activity className="w-4 h-4" />
          Strategy Analysis
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Main Recommendation */}
        <div className="p-4 rounded-lg bg-[var(--color-surface)] border border-[var(--color-border)]">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-[var(--color-text-muted)]">Recommendation</span>
            <span className="text-xs text-[var(--color-text-muted)]">
              {analysis.recommendation.confidence.toFixed(0)}% confidence
            </span>
          </div>
          <div className={cn("flex items-center gap-2 text-lg font-bold", getActionColor(analysis.recommendation.action))}>
            <ActionIcon className="w-5 h-5" />
            {analysis.recommendation.action.replace(/_/g, " ")}
          </div>
          {analysis.recommendation.reasons.length > 0 && (
            <ul className="mt-2 space-y-1">
              {analysis.recommendation.reasons.map((reason, i) => (
                <li key={i} className="text-xs text-[var(--color-text-secondary)] flex items-start gap-1">
                  <span className="text-[var(--color-primary)]">•</span>
                  {reason}
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Market Price */}
        <div className="grid grid-cols-2 gap-3">
          <div className="p-3 bg-[var(--color-surface-elevated)] rounded-lg">
            <p className="text-xs text-[var(--color-text-muted)] mb-1">YES Price</p>
            <p className="font-bold text-emerald-400">{(analysis.marketPrice.yesPrice * 100).toFixed(1)}¢</p>
          </div>
          <div className="p-3 bg-[var(--color-surface-elevated)] rounded-lg">
            <p className="text-xs text-[var(--color-text-muted)] mb-1">NO Price</p>
            <p className="font-bold text-red-400">{(analysis.marketPrice.noPrice * 100).toFixed(1)}¢</p>
          </div>
        </div>

        {/* Technical Indicators */}
        <div className="grid grid-cols-2 gap-3">
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
              {(analysis.volatility?.value || 0).toFixed(4)}
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
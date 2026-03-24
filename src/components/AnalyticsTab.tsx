'use client'

// Analytics Tab - Main analytics dashboard with all visualizations
import { StrategyCorrelationMatrix } from "@/components/StrategyCorrelationMatrix";
import { PerformanceCharts } from "@/components/PerformanceCharts";
import { StrategyRecommendation } from "@/components/StrategyRecommendation";

export function AnalyticsTab() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      {/* Strategy Recommendation */}
      <StrategyRecommendation />

      {/* Strategy Correlation Matrix */}
      <StrategyCorrelationMatrix />

      {/* Performance Charts */}
      <PerformanceCharts />
    </div>
  );
}
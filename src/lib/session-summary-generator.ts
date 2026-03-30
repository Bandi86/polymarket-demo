// Session Summary Generator
// Generates markdown reports for bot trading sessions

import type { BotSessionRow, PositionRow } from "./database";
import { mkdirSync, existsSync, writeFileSync } from "fs";
import { dirname } from "path";

export interface StrategyAnalysis {
  strategy: string;
  botName: string;
  roi: number;
  winRate: number;
  trades: number;
  config: Record<string, unknown>;
  insights: string[];
  recommendation: string;
}

export class SessionSummaryGenerator {
  /**
   * Generate markdown summary for sessions
   */
  generate(sessions: BotSessionRow[], positions: PositionRow[]): string {
    const timestamp = new Date().toISOString();
    const duration = this.calculateDuration(sessions);
    const rankedSessions = this.rankByPerformance(sessions);

    let md = `# Bot Session Summary - ${timestamp.split("T")[0]}\n\n`;
    md += `**Generated:** ${timestamp}\n\n`;

    // Overview section
    md += `## Competition Overview\n\n`;
    md += `- **Duration:** ${duration}\n`;
    md += `- **Total bots:** ${sessions.length}\n`;
    md += `- **Total trades:** ${sessions.reduce((s, r) => s + r.total_trades, 0)}\n\n`;

    // Performance ranking table
    md += `## Bot Performance Ranking\n\n`;
    md += `| Rank | Bot | Strategy | Trades | Win Rate | ROI | Notes |\n`;
    md += `|------|-----|----------|--------|----------|-----|-------|\n`;

    rankedSessions.forEach((s, i) => {
      const roi = this.calculateROI(s.start_balance, s.end_balance || s.start_balance);
      const winRate = s.total_trades > 0 ? ((s.winning_trades / s.total_trades) * 100).toFixed(0) : "0";
      const note = roi > 50 ? "Excellent!" : roi > 0 ? "Good" : roi < -20 ? "Poor" : "";
      md += `| ${i + 1} | ${s.bot_name} | ${s.strategy} | ${s.total_trades} | ${winRate}% | ${roi > 0 ? "+" : ""}${roi.toFixed(0)}% | ${note} |\n`;
    });

    md += "\n";

    // Strategy analysis section
    md += `## Strategy Analysis\n\n`;
    const analyses = this.generateStrategyAnalyses(sessions, positions);
    analyses.forEach(a => {
      md += `### ${a.botName} (${a.strategy})\n\n`;
      md += `- **Config:** ${JSON.stringify(a.config)}\n`;
      md += `- **ROI:** ${a.roi > 0 ? "+" : ""}${a.roi.toFixed(0)}%\n`;
      md += `- **Win Rate:** ${a.winRate.toFixed(0)}%\n`;
      md += `- **Trades:** ${a.trades}\n`;
      if (a.insights.length > 0) {
        md += `- **Insights:**\n`;
        a.insights.forEach(ins => md += `  - ${ins}\n`);
      }
      md += `- **Recommendation:** ${a.recommendation}\n\n`;
    });

    // Recommendations section
    md += `## Recommendations for Next Session\n\n`;
    const recommendations = this.generateRecommendations(analyses);
    if (recommendations.length === 0) {
      md += "No specific recommendations - all strategies performing within expected parameters.\n";
    } else {
      recommendations.forEach((rec, i) => {
        md += `${i + 1}. ${rec}\n`;
      });
    }

    md += "\n---\n";
    md += `Session IDs: ${sessions.map(s => s.id).join(", ")}\n`;

    return md;
  }

  /**
   * Calculate ROI percentage
   */
  calculateROI(start: number, end: number): number {
    if (start === 0) return 0;
    return ((end - start) / start) * 100;
  }

  /**
   * Rank sessions by performance (ROI)
   */
  rankByPerformance(sessions: BotSessionRow[]): BotSessionRow[] {
    return [...sessions].sort((a, b) => {
      const roiA = this.calculateROI(a.start_balance, a.end_balance || a.start_balance);
      const roiB = this.calculateROI(b.start_balance, b.end_balance || b.start_balance);
      return roiB - roiA;
    });
  }

  /**
   * Generate per-strategy analysis
   */
  generateStrategyAnalyses(sessions: BotSessionRow[], positions: PositionRow[]): StrategyAnalysis[] {
    return sessions.map(s => {
      const roi = this.calculateROI(s.start_balance, s.end_balance || s.start_balance);
      const winRate = s.total_trades > 0 ? (s.winning_trades / s.total_trades) * 100 : 0;
      const config = s.strategy_config ? JSON.parse(s.strategy_config) : {};
      const botPositions = positions.filter(p => p.bot_id === s.bot_id);

      const insights: string[] = [];
      let recommendation = "Keep current settings";

      // Generate insights based on performance
      if (roi > 100) {
        insights.push("Outstanding performance - analyze what conditions led to success");
      }
      if (winRate > 80 && s.total_trades >= 5) {
        insights.push("High win rate with sufficient trades - strategy is working well");
      }
      if (winRate < 40 && s.total_trades >= 5) {
        recommendation = `Consider adjusting thresholds - current win rate ${winRate.toFixed(0)}% is below target`;
      }
      if (s.total_trades < 3 && roi < 0) {
        recommendation = "Strategy may be too conservative - consider lowering thresholds";
      }

      // Check for lucky outlier trades
      if (botPositions.length > 0) {
        const pnls = botPositions.filter(p => p.pnl !== null).map(p => p.pnl!);
        if (pnls.length > 0) {
          const maxPnl = Math.max(...pnls);
          const avgPnl = pnls.reduce((a, b) => a + b, 0) / pnls.length;
          if (maxPnl > avgPnl * 3 && avgPnl > 0) {
            insights.push(`Best trade ($${maxPnl.toFixed(2)}) is 3x+ avg - may be luck, not strategy`);
          }
        }
      }

      return {
        strategy: s.strategy,
        botName: s.bot_name,
        roi,
        winRate,
        trades: s.total_trades,
        config,
        insights,
        recommendation,
      };
    });
  }

  /**
   * Generate actionable recommendations
   */
  generateRecommendations(analyses: StrategyAnalysis[]): string[] {
    const recs: string[] = [];

    // Top performer recommendation
    const top = analyses.reduce((best, a) => a.roi > best.roi ? a : best, analyses[0]);
    if (top.roi > 50) {
      recs.push(`${top.botName} is top performer - keep ${top.strategy} config: ${JSON.stringify(top.config)}`);
    }

    // Poor performers
    const poor = analyses.filter(a => a.roi < -20);
    poor.forEach(a => {
      recs.push(`${a.botName} underperforming - ${a.recommendation}`);
    });

    // Strategies needing more trades
    const lowTrade = analyses.filter(a => a.trades < 3);
    lowTrade.forEach(a => {
      recs.push(`${a.botName} only ${a.trades} trades - consider lowering thresholds to increase activity`);
    });

    return recs;
  }

  /**
   * Calculate session duration from sessions
   */
  private calculateDuration(sessions: BotSessionRow[]): string {
    if (sessions.length === 0) return "N/A";

    const startTimes = sessions.map(s => s.start_time);
    const endTimes = sessions.map(s => s.end_time || Date.now());

    const minStart = Math.min(...startTimes);
    const maxEnd = Math.max(...endTimes);

    const durationMs = maxEnd - minStart;
    const minutes = Math.floor(durationMs / 60000);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) {
      return `${hours}h ${minutes % 60}m`;
    }
    return `${minutes}m`;
  }

  /**
   * Save summary to file
   */
  saveToFile(summary: string, directory: string = "docs/sessions"): string {
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-").split("T");
    const filename = `${timestamp[0]}-${timestamp[1].slice(0, 8)}-session-summary.md`;
    const filepath = `${directory}/${filename}`;

    // Ensure directory exists
    if (!existsSync(dirname(filepath))) {
      mkdirSync(dirname(filepath), { recursive: true });
    }

    writeFileSync(filepath, summary, "utf-8");
    return filepath;
  }
}

// Singleton instance
export const sessionSummaryGenerator = new SessionSummaryGenerator();
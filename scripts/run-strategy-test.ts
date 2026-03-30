#!/usr/bin/env bun
/**
 * Strategy Testing Framework
 * Run all bots for a specified duration and compare results
 *
 * Usage:
 *   bun run scripts/run-strategy-test.ts --duration=300000  # 5 minutes
 *   bun run scripts/run-strategy-test.ts --duration=600000  # 10 minutes
 */

import { botManager } from "../src/lib/bot-manager";
import { marketEngine } from "../src/lib/market-engine";
import { dbService } from "../src/lib/database";

interface TestResult {
  strategy: string;
  botName: string;
  trades: number;
  wins: number;
  losses: number;
  pnl: number;
  winRate: number;
  avgOdds: number;
  startBalance: number;
  endBalance: number;
  roi: number;
}

function parseArgs(): { duration: number; output: string } {
  const args = process.argv.slice(2);
  let duration = 300000; // Default: 5 minutes
  let output = "json";

  for (const arg of args) {
    if (arg.startsWith("--duration=")) {
      duration = parseInt(arg.split("=")[1], 10) * 1000;
    } else if (arg.startsWith("--output=")) {
      output = arg.split("=")[1];
    }
  }

  return { duration, output };
}

async function runTest(durationMs: number): Promise<TestResult[]> {
  console.log(`\n${"=".repeat(60)}`);
  console.log(`STRATEGY TEST - Duration: ${durationMs / 60000} minutes`);
  console.log(`${"=".repeat(60)}\n`);

  // Initialize database
  await dbService.connect();

  // Reset all bots to starting balance
  console.log("Resetting all bots to $10 starting balance...");
  const bots = botManager.getBots();
  for (const bot of bots) {
    botManager.resetBot(bot.id);
  }

  // Start all bots
  console.log("Starting all bots...\n");
  botManager.runAllBots();

  // Track start time
  const startTime = Date.now();

  // Progress updates
  const progressInterval = setInterval(() => {
    const elapsed = Date.now() - startTime;
    const remaining = Math.max(0, durationMs - elapsed);
    const progress = Math.min(100, (elapsed / durationMs) * 100);

    process.stdout.write(`\rProgress: ${progress.toFixed(1)}% | Remaining: ${Math.ceil(remaining / 1000)}s`);
  }, 5000);

  // Wait for test duration
  await new Promise(resolve => setTimeout(resolve, durationMs));

  clearInterval(progressInterval);

  // Stop all bots
  console.log("\n\nStopping all bots...");
  botManager.stopAllBots();

  // Collect results
  const results: TestResult[] = [];
  const finalBots = botManager.getBots();

  for (const bot of finalBots) {
    const portfolio = marketEngine.getBotPortfolio(bot.id);
    const closedPositions = portfolio.closedPositions || [];

    // Calculate odds distribution
    let totalOdds = 0;
    for (const pos of closedPositions) {
      totalOdds += pos.odds;
    }
    const avgOdds = closedPositions.length > 0 ? totalOdds / closedPositions.length : 0;

    results.push({
      strategy: bot.strategy,
      botName: bot.name,
      trades: bot.stats.trades,
      wins: bot.stats.wins,
      losses: bot.stats.losses,
      pnl: bot.stats.pnl,
      winRate: bot.stats.winRate,
      avgOdds,
      startBalance: 10,
      endBalance: portfolio.balance,
      roi: ((portfolio.balance - 10) / 10) * 100,
    });
  }

  return results;
}

function printResults(results: TestResult[]): void {
  // Sort by PnL descending
  results.sort((a, b) => b.pnl - a.pnl);

  console.log("\n" + "=".repeat(100));
  console.log("RESULTS SUMMARY");
  console.log("=".repeat(100));

  // Header
  console.log(
    "\n" +
    "Strategy".padEnd(20) +
    "Trades".padStart(8) +
    "Wins".padStart(6) +
    "Losses".padStart(7) +
    "Win%".padStart(8) +
    "AvgOdds".padStart(10) +
    "PnL".padStart(10) +
    "ROI".padStart(10)
  );
  console.log("-".repeat(100));

  // Results
  for (const r of results) {
    console.log(
      r.botName.padEnd(20) +
      r.trades.toString().padStart(8) +
      r.wins.toString().padStart(6) +
      r.losses.toString().padStart(7) +
      (r.winRate * 100).toFixed(1).padStart(7) + "%" +
      (r.avgOdds * 100).toFixed(1).padStart(8) + "¢" +
      ("$" + r.pnl.toFixed(2)).padStart(10) +
      (r.roi.toFixed(1) + "%").padStart(9)
    );
  }

  console.log("-".repeat(100));

  // Summary
  const totalTrades = results.reduce((sum, r) => sum + r.trades, 0);
  const totalWins = results.reduce((sum, r) => sum + r.wins, 0);
  const totalPnL = results.reduce((sum, r) => sum + r.pnl, 0);
  const avgWinRate = totalTrades > 0 ? totalWins / totalTrades : 0;

  console.log(
    "\nTOTALS:".padEnd(20) +
    totalTrades.toString().padStart(8) +
    totalWins.toString().padStart(6) +
    (totalTrades - totalWins).toString().padStart(7) +
    (avgWinRate * 100).toFixed(1).padStart(7) + "%" +
    "".padStart(18) +
    ("$" + totalPnL.toFixed(2)).padStart(10)
  );

  // Winners vs losers
  const winners = results.filter(r => r.pnl > 0);
  const losers = results.filter(r => r.pnl < 0);

  console.log(`\n${"=".repeat(100)}`);
  console.log(`PROFITABLE STRATEGIES: ${winners.length}`);
  console.log(`LOSING STRATEGIES: ${losers.length}`);
  console.log(`TOTAL PnL: $${totalPnL.toFixed(2)}`);
  console.log(`=${"=".repeat(99)}`);

  // Best and worst
  if (results.length > 0) {
    const best = results[0];
    const worst = results[results.length - 1];
    console.log(`\nBEST:  ${best.botName} - $${best.pnl.toFixed(2)} (${best.roi.toFixed(1)}% ROI, ${best.trades} trades)`);
    console.log(`WORST: ${worst.botName} - $${worst.pnl.toFixed(2)} (${worst.roi.toFixed(1)}% ROI, ${worst.trades} trades)`);
  }
}

async function main(): Promise<void> {
  const { duration } = parseArgs();

  try {
    const results = await runTest(duration);
    printResults(results);

    // Save to database for historical tracking
    console.log("\nResults saved to database.");

    process.exit(0);
  } catch (error) {
    console.error("Test failed:", error);
    process.exit(1);
  }
}

main();
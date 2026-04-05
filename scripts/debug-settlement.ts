/**
 * Settlement Debug Script
 *
 * This script analyzes all settled positions to detect discrepancies:
 * - Positions that should have won but didn't payout
 * - Positions that should have lost but weren't deducted
 * - BTC price movement vs market result mismatches
 * - Portfolio balance inconsistencies
 */

import { dbService } from "../src/lib/database";

async function analyzeSettlements() {
  console.log("=== SETTLEMENT DEBUG ANALYSIS ===\n");

  // Connect to database
  await dbService.connect();

  // 1. Get all settled positions
  const allPositions = await dbService.getPositionsByBot("bot-volatility");
  const settledPositions = allPositions.filter(p => p.status === "settled" || p.status === "closed");

  console.log(`Total positions found: ${allPositions.length}`);
  console.log(`Settled positions: ${settledPositions.length}\n`);

  // 2. Analyze each settlement
  let totalWon = 0;
  let totalLost = 0;
  let totalPnl = 0;
  let discrepancies: Array<{
    positionId: string;
    botId: string;
    outcome: string;
    marketResult: string;
    expectedWon: boolean;
    actualPnl: number;
    expectedPnl: number;
    discrepancy: string;
  }> = [];

  for (const pos of settledPositions.slice(0, 20)) { // Last 20 positions
    const btcStartPrice = pos.btc_price;
    const expectedWon = (pos.outcome === "YES" && btcStartPrice! > 0) ||
                        (pos.outcome === "NO" && btcStartPrice! < 0);

    // Calculate expected PnL
    const expectedPayout = expectedWon ? pos.stake : 0;
    const expectedPnl = expectedPayout - pos.amount - pos.fee;

    const actualPnl = pos.pnl || 0;
    const pnlDiff = Math.abs(actualPnl - expectedPnl);

    // Check if position was settled correctly
    const won = actualPnl > 0;
    const shouldHaveWon = (pos.outcome === "YES" && pos.btc_price! > 0) ||
                          (pos.outcome === "NO" && pos.btc_price! < 0);

    if (won !== shouldHaveWon || pnlDiff > 0.01) {
      discrepancies.push({
        positionId: pos.id,
        botId: pos.bot_id || "unknown",
        outcome: pos.outcome,
        marketResult: pos.btc_price! > 0 ? "UP" : "DOWN",
        expectedWon: shouldHaveWon,
        actualPnl,
        expectedPnl,
        discrepancy: won !== shouldHaveWon
          ? `Win/loss mismatch: expected ${shouldHaveWon ? "WIN" : "LOSS"}, got ${won ? "WIN" : "LOSS"}`
          : `PnL mismatch: expected $${expectedPnl.toFixed(2)}, got $${actualPnl.toFixed(2)}`
      });
    }

    if (won) {
      totalWon++;
    } else {
      totalLost++;
    }
    totalPnl += actualPnl;

    console.log(`[${new Date(pos.timestamp).toLocaleTimeString()}] ${pos.bot_id || "manual"}`);
    console.log(`  Outcome: ${pos.outcome} | Amount: $${pos.amount.toFixed(2)} | Odds: ${pos.odds.toFixed(3)}`);
    console.log(`  BTC Price: ${(pos.btc_price || 0) > 0 ? "+" : ""}${((pos.btc_price || 0) * 100).toFixed(2)}%`);
    console.log(`  PnL: $${actualPnl.toFixed(2)} | Expected: $${expectedPnl.toFixed(2)} | Diff: $${pnlDiff.toFixed(2)}`);
    console.log(`  Status: ${won ? "WON" : "LOST"} | Expected: ${shouldHaveWon ? "WON" : "LOST"}`);
    if (pnlDiff > 0.01 || won !== shouldHaveWon) {
      console.log(`  ⚠️  DISCREPANCY DETECTED!`);
    }
    console.log("");
  }

  // 3. Summary
  console.log("\n=== SUMMARY ===");
  console.log(`Total Won: ${totalWon}`);
  console.log(`Total Lost: ${totalLost}`);
  console.log(`Total PnL: $${totalPnl.toFixed(2)}`);
  console.log(`Discrepancies Found: ${discrepancies.length}`);

  if (discrepancies.length > 0) {
    console.log("\n=== DISCREPANCIES ===");
    for (const d of discrepancies) {
      console.log(`\n⚠️  Position: ${d.positionId}`);
      console.log(`  Bot: ${d.botId}`);
      console.log(`  Outcome: ${d.outcome} | Market: ${d.marketResult}`);
      console.log(`  Expected: ${d.expectedWon ? "WIN" : "LOSS"} | Actual: ${d.actualPnl > 0 ? "WIN" : "LOSS"}`);
      console.log(`  Expected PnL: $${d.expectedPnl.toFixed(2)} | Actual: $${d.actualPnl.toFixed(2)}`);
      console.log(`  Issue: ${d.discrepancy}`);
    }
  }

  // 4. Check bot sessions for consistency
  console.log("\n=== BOT SESSION ANALYSIS ===");
  const sessions = await dbService.getBotSessions("bot-volatility", 5);

  for (const session of sessions) {
    console.log(`\nSession: ${session.id}`);
    console.log(`  Bot: ${session.bot_name} (${session.strategy})`);
    console.log(`  Period: ${new Date(session.start_time).toLocaleString()} - ${session.end_time ? new Date(session.end_time).toLocaleString() : "running"}`);
    console.log(`  Balance: $${session.start_balance.toFixed(2)} → $${session.end_balance?.toFixed(2) || "N/A"}`);
    console.log(`  PnL: $${session.total_pnl.toFixed(2)}`);
    console.log(`  Trades: ${session.total_trades} (${session.winning_trades}W / ${session.losing_trades}L)`);
    console.log(`  Win Rate: ${(session.winning_trades / (session.total_trades || 1) * 100).toFixed(1)}%`);
  }

  process.exit(0);
}

// Run analysis
analyzeSettlements().catch(console.error);

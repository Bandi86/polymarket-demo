/**
 * Live Settlement Debug - Real-time monitoring
 * Can be called via API or directly to check current settlement state
 */

import { marketEngine } from "./market-engine";
import { priceService } from "./price";
import { botManager } from "./bot-manager";

export async function debugSettlement() {
  console.log("=== LIVE SETTLEMENT DEBUG ===\n");

  // 1. Current market state
  const market = marketEngine.getCurrentMarket();
  if (!market) {
    console.log("❌ No active market found");
    return;
  }

  console.log("📊 MARKET STATE:");
  console.log(`  ID: ${market.id}`);
  console.log(`  Question: ${market.question}`);
  console.log(`  Status: ${market.status}`);
  console.log(`  Start Time: ${new Date(market.startTime).toLocaleString()}`);
  console.log(`  End Time: ${new Date(market.endTime).toLocaleString()}`);
  console.log(`  YES Price: ${(parseFloat(market.outcomePrices.yes) * 100).toFixed(1)}¢`);
  console.log(`  NO Price: ${(parseFloat(market.outcomePrices.no) * 100).toFixed(1)}¢`);

  // 2. BTC prices
  const btcStartPrice = marketEngine.getMarketStartBtcPrice();
  const btcCurrentPrice = priceService.getPrice();

  console.log("\n💰 BTC PRICES:");
  console.log(`  Start: $${btcStartPrice?.toFixed(2) || 'N/A'}`);
  console.log(`  Current: $${btcCurrentPrice.toFixed(2)}`);
  console.log(`  Change: ${btcStartPrice ? (((btcCurrentPrice - btcStartPrice) / btcStartPrice) * 100).toFixed(4) : 'N/A'}%`);

  // 3. Calculated result
  const btcChange = btcCurrentPrice - (btcStartPrice || btcCurrentPrice);
  const calculatedResult = btcChange >= 0 ? "UP" : "DOWN";

  console.log("\n📈 CALCULATED RESULT:");
  console.log(`  BTC Movement: ${btcChange >= 0 ? '+' : ''}$${btcChange.toFixed(2)} (${((btcChange / (btcStartPrice || btcCurrentPrice)) * 100).toFixed(4)}%)`);
  console.log(`  Result: ${calculatedResult}`);

  // 4. All bot positions
  console.log("\n🤖 BOT POSITIONS:");
  const bots = botManager.getBots();

  for (const bot of bots) {
    const portfolio = botManager.getBot(bot.id)?.portfolio;
    if (!portfolio || (portfolio.openPositions.length === 0 && portfolio.closedPositions.length === 0)) continue;

    console.log(`\n  ${bot.name} (${bot.strategy}):`);
    console.log(`    Balance: $${portfolio.balance.toFixed(2)} (started: $${portfolio.initialBalance.toFixed(2)})`);
    console.log(`    Total PnL: $${portfolio.totalPnL.toFixed(2)}`);
    console.log(`    Trades: ${portfolio.totalTrades} (${portfolio.winningTrades}W / ${portfolio.losingTrades}L)`);

    if (portfolio.openPositions.length > 0) {
      console.log(`    OPEN POSITIONS (${portfolio.openPositions.length}):`);
      for (const pos of portfolio.openPositions) {
        console.log(`      - ${pos.outcome} $${pos.amount.toFixed(2)} @ ${(pos.odds * 100).toFixed(1)}¢ | PnL: $${(pos.unrealizedPnl || 0).toFixed(2)}`);
      }
    }

    if (portfolio.closedPositions.length > 0) {
      console.log(`    SETTLED POSITIONS (${portfolio.closedPositions.length}):`);
      for (const pos of portfolio.closedPositions.slice(0, 5)) {
        const won = pos.pnl && pos.pnl > 0;
        console.log(`      - ${pos.outcome} $${pos.amount.toFixed(2)} @ ${(pos.odds * 100).toFixed(1)}¢ | PnL: $${(pos.pnl || 0).toFixed(2)} | ${won ? '✅ WON' : '❌ LOST'}`);
      }
    }
  }

  // 5. Settlement validation preview
  console.log("\n🔍 SETTLEMENT PREVIEW:");
  console.log(`  If market closed NOW:`);
  console.log(`    Final YES price: ${(parseFloat(market.outcomePrices.yes) * 100).toFixed(1)}¢`);
  console.log(`    Polymarket result would be: ${parseFloat(market.outcomePrices.yes) > 0.5 ? 'UP' : 'DOWN'}`);
  console.log(`    Our calculated result: ${calculatedResult}`);
  console.log(`    Match: ${
    (parseFloat(market.outcomePrices.yes) > 0.5) === (calculatedResult === 'UP')
      ? '✅ YES'
      : '❌ NO - DISCREPANCY!'
  }`);

  console.log("\n========================\n");
}

// Export for API use
export default debugSettlement;

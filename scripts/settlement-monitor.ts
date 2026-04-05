/**
 * Settlement Monitor - Console log watcher for settlement events
 * Run this alongside the dev server to see detailed settlement logs
 */

// This script attaches to the marketEngine settlement events
import { marketEngine } from '../src/lib/market-engine';
import { botManager } from '../src/lib/bot-manager';

// Subscribe to settlement events
marketEngine.onSettlement((data) => {
  console.log('\n' + '='.repeat(60));
  console.log('🔔 SETTLEMENT EVENT DETECTED');
  console.log('='.repeat(60));
  console.log(`Position ID: ${data.position.id}`);
  console.log(`Bot ID: ${data.position.botId}`);
  console.log(`Outcome: ${data.position.outcome}`);
  console.log(`Market Result: ${data.marketResult}`);
  console.log(`Won: ${data.won ? '✅ YES' : '❌ NO'}`);
  console.log(`PnL: $${data.pnl.toFixed(2)}`);

  // Verify calculation
  const shouldHaveWon =
    (data.position.outcome === 'YES' && data.marketResult === 'UP') ||
    (data.position.outcome === 'NO' && data.marketResult === 'DOWN');

  console.log(`\nVERIFICATION:`);
  console.log(`  Position outcome: ${data.position.outcome}`);
  console.log(`  Market result: ${data.marketResult}`);
  console.log(`  Should have won: ${shouldHaveWon ? 'YES' : 'NO'}`);
  console.log(`  Actually won: ${data.won ? 'YES' : 'NO'}`);
  console.log(`  Match: ${shouldHaveWon === data.won ? '✅ CORRECT' : '❌ ERROR!'}`);

  // Check portfolio balance update
  if (data.position.botId) {
    const portfolio = botManager.getBot(data.position.botId)?.portfolio;
    if (portfolio) {
      console.log(`\nPortfolio State:`);
      console.log(`  Balance: $${portfolio.balance.toFixed(2)}`);
      console.log(`  Total PnL: $${portfolio.totalPnL.toFixed(2)}`);
      console.log(`  Total Trades: ${portfolio.totalTrades}`);
      console.log(`  Winning Trades: ${portfolio.winningTrades}`);
      console.log(`  Losing Trades: ${portfolio.losingTrades}`);
    }
  }

  console.log('='.repeat(60) + '\n');
});

console.log('[SettlementMonitor] Listening for settlement events...');

// Keep running
setInterval(() => {}, 1000);

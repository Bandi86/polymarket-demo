import { polymarketProvider } from "../src/lib/providers/polymarket-provider";

async function run() {
  const markets = await polymarketProvider.fetchActiveBitcoinMarkets();
  console.log(`Received ${markets.length} markets.`);
  if (markets.length > 0) {
    console.log("Top Markets:");
    for (let i = 0; i < Math.min(10, markets.length); i++) {
        console.log(`${i+1}. ${markets[i].question} (ID: ${markets[i].id}) - Ends: ${new Date(markets[i].endTime!).toISOString()} - is5Min: ${(markets[i] as any).is5Min}`);
    }
  }
}

run().catch(console.error);

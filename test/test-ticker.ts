import axios from "axios";

async function run() {
  const GAMMA_API = "https://gamma-api.polymarket.com";
  
  const now = Date.now();
  console.log("Current time:", new Date(now).toISOString());

  // Calculate the end of the current 5-minute interval
  // e.g., 10:58 -> 11:00
  // 5 minutes in milliseconds = 300000
  const intervalMs = 300000;
  const nextIntervalEndMs = Math.ceil(now / intervalMs) * intervalMs;
  const nextIntervalEndSec = Math.floor(nextIntervalEndMs / 1000);
  
  // Also check the one after that just in case
  const followingIntervalEndSec = nextIntervalEndSec + 300;

  const tickersToTest = [
    `btc-updown-5m-${nextIntervalEndSec}`,
    `btc-updown-5m-${followingIntervalEndSec}`
  ];

  for (const ticker of tickersToTest) {
    console.log(`Testing ticker: ${ticker}`);
    const url = `${GAMMA_API}/events?ticker=${ticker}`;
    try {
      const res = await axios.get(url, { timeout: 10000 });
      if (res.data && res.data.length > 0) {
        const event = res.data[0];
        console.log(`Found event: ${event.title}`);
        for (const market of event.markets) {
           console.log(`  Market: ${market.question} | ID: ${market.id} | active: ${market.active}`);
           console.log(`  End time: ${new Date(market.endDate).toISOString()}`);
        }
      } else {
        console.log("No events found for this ticker.");
      }
    } catch(e: any) {
       console.error(`Error fetching ticker ${ticker}:`, e.message);
    }
  }
}

run().catch(console.error);

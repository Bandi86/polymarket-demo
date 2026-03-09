import axios from "axios";

async function run() {
  const GAMMA_API = "https://gamma-api.polymarket.com";
  
  const now = new Date();
  const nowStr = now.toISOString();
  
  const url = `${GAMMA_API}/events?limit=100&active=true&closed=false&order=startDate&ascending=false&end_date_min=${nowStr}`;
  const res = await axios.get(url, { timeout: 10000 });
  const events = res.data;
  
  let found = 0;
  for (const event of events) {
    if (event.ticker && event.ticker.includes("btc-updown-5m")) {
      found++;
      for (const market of event.markets) {
        if (!market.active || market.closed || market.outcomes !== '["Yes", "No"]') continue;

        const endTime = new Date(market.endDate).getTime();
        const diffSeconds = (endTime - now.getTime()) / 1000;
        
        console.log(`Event: ${event.title}`);
        console.log(`  End time: ${new Date(endTime).toISOString()} (in ${diffSeconds.toFixed(1)}s)`);
      }
    }
  }
  console.log(`Found ${found} 5-min events ending after ${nowStr}`);
}

run().catch(console.error);

import axios from "axios";

async function run() {
  const GAMMA_API = "https://gamma-api.polymarket.com";
  
  const url = `${GAMMA_API}/events?limit=300&active=true&closed=false&order=endDate&ascending=true`;
  const res = await axios.get(url, { timeout: 10000 });
  const events = res.data;
  
  const now = Date.now();
  console.log("Current time:", new Date(now).toISOString());

  for (const event of events) {
    if (event.ticker && event.ticker.includes("btc-updown-5m")) {
      for (const market of event.markets) {
        if (!market.active || market.closed || market.outcomes !== '["Yes", "No"]') continue;

        const endTime = new Date(market.endDate).getTime();
        const diffSeconds = (endTime - now) / 1000;
        
        console.log(`Event: ${event.title}`);
        console.log(`  End time: ${new Date(endTime).toISOString()} (in ${diffSeconds.toFixed(1)}s)`);
      }
    }
  }
}

run().catch(console.error);

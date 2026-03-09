import axios from "axios";

async function run() {
  const GAMMA_API = "https://gamma-api.polymarket.com";
  let offset = 0;
  const limit = 500;
  let keepFetching = true;
  let count = 0;

  console.log("Fetching active events from Polymarket...");

  while (keepFetching) {
    try {
      const url = `${GAMMA_API}/events?limit=${limit}&offset=${offset}&active=true&closed=false`;
      const res = await axios.get(url, { timeout: 10000 });
      const events = res.data;
      
      if (events.length === 0) {
        keepFetching = false;
        break;
      }

      for (const event of events) {
        const title = event.title.toLowerCase();
        // Look for 5 minute bitcoin markets
        if ((title.includes("btc") || title.includes("bitcoin")) && 
            (title.includes("5m") || title.includes("5 min") || title.includes("minute") || title.includes("down") || title.includes("up") || event.ticker.includes("BTC-5M"))) {
            
            // Further filter to match "Up/Down" or "price" format
            console.log(`\nEvent: ${event.title}`);
            console.log(`  Ticker: ${event.ticker} | ID: ${event.id}`);
            console.log(`  Tags: ${(event.tags || []).join(", ")}`);
            
            for (const m of event.markets) {
               console.log(`    Market: ${m.question} | ID: ${m.id} | active: ${m.active} | closed: ${m.closed}`);
            }
            count++;
        }
      }
      
      offset += limit;
      console.log(`Fetched ${offset} events so far...`);
    } catch (e: any) {
      console.error("Error fetching:", e.message);
      keepFetching = false;
    }
  }
  
  console.log(`\nTotal matching events found: ${count}`);
}

run().catch(console.error);

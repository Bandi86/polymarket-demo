import axios from "axios";

async function run() {
  const GAMMA_API = "https://gamma-api.polymarket.com";
  
  const nowStr = new Date().toISOString();
  
  const filters = [
    `end_date_min=${nowStr}`,
    `endDate_gt=${nowStr}`,
    `end_date_gt=${nowStr}`,
    `start_date_min=${nowStr}`
  ];

  for (const filter of filters) {
     console.log(`\nTesting filter: ${filter}`);
     const url = `${GAMMA_API}/events?limit=5&active=true&closed=false&order=volume24hr&ascending=false&${filter}`;
     try {
       const res = await axios.get(url, { timeout: 10000 });
       for (const event of res.data) {
           console.log(`  Event: ${event.title} | End: ${event.endDate}`);
       }
     } catch (e: any) {
        console.error("  Error:", e.message);
     }
  }
}

run().catch(console.error);

import axios from "axios";

async function run() {
  const GAMMA_API = "https://gamma-api.polymarket.com";
  
  // Test different order parameters to get them fast
  const orders = ["startDate", "endDate", "volume24hr"];
  
  for (const order of orders) {
    console.log(`\nTesting order=${order} for 5-min markets...`);
    const url = `${GAMMA_API}/events?limit=100&active=true&closed=false&order=${order}&ascending=true`;
    
    try {
      const res = await axios.get(url, { timeout: 10000 });
      let count = 0;
      for (const event of res.data) {
        if (event.ticker && event.ticker.includes("btc-updown-5m")) {
          count++;
        }
      }
      console.log(`Found ${count} 5-min markets in first 100 events (ascending=true)`);
    } catch (e: any) {
       console.log("Error", e.message);
    }

    const urlDesc = `${GAMMA_API}/events?limit=100&active=true&closed=false&order=${order}&ascending=false`;
    try {
      const res = await axios.get(urlDesc, { timeout: 10000 });
      let count = 0;
      for (const event of res.data) {
        if (event.ticker && event.ticker.includes("btc-updown-5m")) {
          count++;
        }
      }
      console.log(`Found ${count} 5-min markets in first 100 events (ascending=false)`);
    } catch(e: any) {
        console.log("Error", e.message);
    }
  }
}

run().catch(console.error);

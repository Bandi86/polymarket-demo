import axios from "axios";

async function run() {
  const GAMMA_API = "https://gamma-api.polymarket.com";
  
  // Find a known 5 min market and print its tags properly
  const url = `${GAMMA_API}/events?ticker=btc-updown-5m-1772874900`;
  const res = await axios.get(url, { timeout: 10000 });
  const event = res.data[0];
  if (event) {
     console.log("Tags:", JSON.stringify(event.tags, null, 2));
  }
}

run().catch(console.error);

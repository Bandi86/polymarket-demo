// Bun Server - Serves React app and API routes

import { serve } from "bun";
import { marketEngine } from "./lib/market-engine";
import { priceService } from "./lib/price";
import { botManager } from "./lib/bot-manager";
import { dbService } from "./lib/database";
import { binanceKlineProvider } from "./lib/providers/binance-kline-provider";
import { polymarketProvider } from "./lib/providers/polymarket-provider";

const PORT = 3000;

// Initialize database
dbService.connect().catch((e) => console.error("[Server] DB init error:", e));

// Sync BTC price with polymarket provider for simulation
priceService.subscribeToUpdates((update) => {
  polymarketProvider.setBtcPrice(update.price);
});

// Subscribe to bot logs and broadcast to SSE
botManager.onLog((log) => {
  broadcastUpdate({
    type: "bot_log",
    data: log,
  });
});

// Store connected SSE clients
const sseClients = new Set<ReadableStreamDefaultController>();

// Broadcast updates to all SSE clients
function broadcastUpdate(data: unknown) {
  const message = `data: ${JSON.stringify(data)}\n\n`;
  sseClients.forEach((client) => {
    try {
      client.enqueue(new TextEncoder().encode(message));
    } catch {
      // Client disconnected
      sseClients.delete(client);
    }
  });
}

// Broadcast updates every 2 seconds
setInterval(() => {
  const market = marketEngine.getCurrentMarket();
  if (!market) return;
  
  broadcastUpdate({
    type: "market",
    data: {
      yesPrice: parseFloat(market.outcomePrices?.yes || "0.5"),
      noPrice: parseFloat(market.outcomePrices?.no || "0.5"),
      btcPrice: priceService.getPrice(),
      timeRemaining: marketEngine.getTimeRemaining(),
      timestamp: Date.now(),
    }
  });
}, 2000);

// CORS headers
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

async function parseBody(req: Request): Promise<unknown> {
  try {
    return await req.json();
  } catch {
    return null;
  }
}

serve({
  port: PORT,

  async fetch(req: Request): Promise<Response> {
    const url = new URL(req.url);
    const path = url.pathname;
    const method = req.method;

    if (method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    // SSE endpoint for real-time updates
    if (path === "/api/sse") {
      const stream = new ReadableStream({
        start(controller) {
          sseClients.add(controller);
          
          // Send initial data
          const market = marketEngine.getCurrentMarket();
          const data = {
            type: "connected",
            data: {
              yesPrice: parseFloat(market?.outcomePrices?.yes || "0.5"),
              noPrice: parseFloat(market?.outcomePrices?.no || "0.5"),
              btcPrice: priceService.getPrice(),
              timeRemaining: marketEngine.getTimeRemaining(),
              timestamp: Date.now(),
            }
          };
          controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify(data)}\n\n`));
        },
        cancel(controller) {
          sseClients.delete(controller);
        }
      });
      
      return new Response(stream, {
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          "Connection": "keep-alive",
          ...corsHeaders
        }
      });
    }

    if (path.startsWith("/api/")) {
      const response = await handleApiRoute(req, path, method);
      Object.entries(corsHeaders).forEach(([k, v]) => response.headers.set(k, v));
      return response;
    }

    // Serve built assets from dist
    if (path !== "/" && !path.startsWith("/api/")) {
      try {
        const assetPath = "./dist" + path;
        const file = Bun.file(assetPath);
        if (await file.exists()) {
          return new Response(file);
        }
      } catch {
        // Continue to serve index.html
      }
    }

    // Serve the HTML
    try {
      const htmlFile = Bun.file("./dist/index.html");
      if (await htmlFile.exists()) {
        return new Response(htmlFile, { headers: { "Content-Type": "text/html" } });
      }
    } catch {
      // File doesn't exist
    }

    return new Response("Not found - run bun run build first", { status: 404 });
  },

  development: { hmr: true, console: true },
});

async function handleApiRoute(req: Request, path: string, method: string): Promise<Response> {
  const url = new URL(req.url);

  // GET /api/market - Current market state
  if (path === "/api/market" && method === "GET") {
    const market = marketEngine.getCurrentMarket();
    const timeRemaining = marketEngine.getTimeRemaining();
    const totalDuration = market ? market.endTime - market.startTime : 0;

    return Response.json({
      market,
      btcPrice: priceService.getPrice(),
      priceHistory: [],
      yesPriceHistory: market?.yesPriceHistory || [],
      btcPriceHistory: [],
      timeRemaining,
      marketDuration: totalDuration,
      startedAt: market?.startTime || Date.now(),
    });
  }

  // GET /api/markets/available - List of tradeable markets
  if (path === "/api/markets/available" && method === "GET") {
    const markets = marketEngine.getAvailableMarkets();
    return Response.json(markets);
  }

  // POST /api/market/switch - Switch to a different market
  if (path === "/api/market/switch" && method === "POST") {
    const body = (await parseBody(req)) as { marketId?: string };
    if (!body?.marketId) {
      return Response.json({ success: false, error: "Missing marketId" }, { status: 400 });
    }
    const success = await marketEngine.switchMarket(body.marketId);
    return Response.json({ success });
  }

  // POST /api/market/refresh - Force new market
  if (path === "/api/market/refresh" && method === "POST") {
    marketEngine.forceNewMarket();
    return Response.json({ success: true });
  }

  // GET /api/market/history - Completed markets
  if (path === "/api/market/history" && method === "GET") {
    return Response.json(marketEngine.getMarketHistory());
  }

  // POST /api/trade - Place a trade
  if (path === "/api/trade" && method === "POST") {
    const body = (await parseBody(req)) as { outcome?: string; amount?: number; marketId?: string };

    if (!body?.outcome || !body?.amount) {
      return Response.json({ success: false, error: "Missing outcome or amount" }, { status: 400 });
    }

    if (body.amount < 0.01) {
      return Response.json({ success: false, error: "Minimum bet is $0.01" }, { status: 400 });
    }

    const position = marketEngine.placeTrade(body.outcome as "YES" | "NO", body.amount);

    if (!position) {
      return Response.json({ success: false, error: "Failed to place trade" }, { status: 400 });
    }

    return Response.json({ success: true, position });
  }

  // GET /api/portfolio - Get portfolio
  if (path === "/api/portfolio" && method === "GET") {
    return Response.json(marketEngine.getPortfolio());
  }

  // GET /api/positions - Get all positions
  if (path === "/api/positions" && method === "GET") {
    return Response.json({
      open: marketEngine.getOpenPositions(),
      settled: marketEngine.getClosedPositions(),
    });
  }

  // POST /api/positions/:id/close - Close a position
  const closeMatch = path.match(/^\/api\/positions\/([^/]+)\/close$/);
  if (closeMatch && method === "POST") {
    const positionId = closeMatch[1];
    const position = marketEngine.closePosition(positionId);
    if (!position) {
      return Response.json({ success: false, error: "Position not found or already closed" }, { status: 404 });
    }
    return Response.json({ success: true, position });
  }

  // GET /api/bots - Get all bots
  if (path === "/api/bots" && method === "GET") {
    return Response.json(botManager.getBots());
  }

  // POST /api/bots/:id/toggle - Toggle bot
  const toggleMatch = path.match(/^\/api\/bots\/([^/]+)\/toggle$/);
  if (toggleMatch && method === "POST") {
    const botId = toggleMatch[1];
    const bot = botManager.toggleBot(botId);
    if (!bot) {
      return Response.json({ error: "Bot not found" }, { status: 404 });
    }
    return Response.json(bot);
  }

  // POST /api/bots/:id/config - Update bot config
  const configMatch = path.match(/^\/api\/bots\/([^/]+)\/config$/);
  if (configMatch && method === "POST") {
    const body = (await parseBody(req)) as Record<string, unknown>;
    const bot = botManager.updateBotConfig(configMatch[1], body);
    if (!bot) {
      return Response.json({ error: "Bot not found" }, { status: 404 });
    }
    return Response.json(bot);
  }

  // POST /api/bots/stop-all
  if (path === "/api/bots/stop-all" && method === "POST") {
    botManager.stopAllBots();
    return Response.json({ success: true });
  }

  // POST /api/bots/reset-all
  if (path === "/api/bots/reset-all" && method === "POST") {
    botManager.resetAllBots();
    return Response.json({ success: true });
  }

  // POST /api/bots/run-all
  if (path === "/api/bots/run-all" && method === "POST") {
    const body = (await parseBody(req)) as { betSize?: number; interval?: number };
    botManager.runAllBots(body);
    return Response.json({ success: true });
  }

  // GET /api/sessions
  if (path === "/api/sessions" && method === "GET") {
    return Response.json(botManager.getSessions());
  }

  // GET /api/strategy/strategies
  if (path === "/api/strategy/strategies" && method === "GET") {
    return Response.json(botManager.getStrategies());
  }

  // GET /api/strategy/analyze — Use Polymarket odds
  if (path === "/api/strategy/analyze" && method === "GET") {
    const market = marketEngine.getCurrentMarket();
    const yesPrice = parseFloat(market?.outcomePrices?.yes || "0.5");
    const noPrice = parseFloat(market?.outcomePrices?.no || "0.5");
    const yesPriceHistory = market?.yesPriceHistory || [];
    const priceHistory = yesPriceHistory.map((p) => p.price);

    // Calculate volatility
    let volatility = 0;
    if (priceHistory.length >= 5) {
      const changes: number[] = [];
      for (let i = 1; i < priceHistory.length; i++) {
        changes.push(Math.abs(priceHistory[i] - priceHistory[i - 1]));
      }
      volatility = changes.reduce((a, b) => a + b, 0) / changes.length;
    }

    // Calculate momentum
    let momentum = 0;
    if (priceHistory.length >= 3) {
      const recent = priceHistory.slice(-3);
      const older = priceHistory.slice(-6, -3);
      if (older.length > 0) {
        momentum = (recent.reduce((a, b) => a + b, 0) / recent.length) -
                   (older.reduce((a, b) => a + b, 0) / older.length);
      }
    }

    // Fair value signal
    const fairValue = 0.5; // Neutral baseline
    const edge = fairValue - yesPrice;
    const fairValueAction = edge > 0.05 ? "BUY_YES" : edge < -0.05 ? "BUY_NO" : "HOLD";

    // Anomaly
    const sum = yesPrice + noPrice;
    const anomalyAction = sum < 0.98 ? "BUY_BOTH" : "HOLD";

    // Momentum signal
    const momentumAction = momentum > 0.005 ? "BUY_YES" : momentum < -0.005 ? "BUY_NO" : "HOLD";

    return Response.json({
      fairValue: { action: fairValueAction, fairValue, edge },
      anomaly: { action: anomalyAction, sum, confidence: Math.abs(1 - sum) },
      momentum: { action: momentumAction, momentum, confidence: Math.abs(momentum) * 50 },
      volatility,
      marketPrice: { yesPrice, noPrice },
    });
  }

  // POST /api/mode
  if (path === "/api/mode" && method === "POST") {
    const body = (await parseBody(req)) as { mode?: string; startingBalance?: number };
    marketEngine.setMode(body.mode as "real" | "simulated", body.startingBalance);
    return Response.json({ success: true, mode: body.mode });
  }

  // GET /api/mode
  if (path === "/api/mode" && method === "GET") {
    return Response.json({ mode: marketEngine.getMode() });
  }

  // POST /api/reset
  if (path === "/api/reset" && method === "POST") {
    marketEngine.reset();
    botManager.resetAllBots();
    return Response.json({ success: true });
  }

  // GET /api/health
  if (path === "/api/health" && method === "GET") {
    return Response.json({
      status: "ok",
      timestamp: Date.now(),
      btcPrice: priceService.getPrice(),
      marketActive: !!marketEngine.getCurrentMarket(),
    });
  }

  // GET /api/events
  if (path === "/api/events" && method === "GET") {
    return Response.json([]);
  }

  // GET /api/signal - Get Binance signal data
  if (path === "/api/signal" && method === "GET") {
    const lastSignal = binanceKlineProvider.getLastSignal();
    const signalHistory = binanceKlineProvider.getSignalHistory(20);
    const stats = binanceKlineProvider.getStats();
    const currentKline = binanceKlineProvider.getCurrentKline();
    const previousKline = binanceKlineProvider.getPreviousKline();

    return Response.json({
      currentKline,
      previousKline,
      lastSignal,
      signalHistory,
      stats,
      threshold: binanceKlineProvider.getThreshold(),
    });
  }

  // POST /api/signal/threshold - Set signal threshold
  if (path === "/api/signal/threshold" && method === "POST") {
    const body = (await parseBody(req)) as { threshold?: number };
    if (body?.threshold !== undefined && body.threshold > 0) {
      binanceKlineProvider.setThreshold(body.threshold);
      return Response.json({ success: true, threshold: body.threshold });
    }
    return Response.json({ success: false, error: "Invalid threshold" }, { status: 400 });
  }

  // GET /api/signal/klines - Get kline history
  if (path === "/api/signal/klines" && method === "GET") {
    const limit = parseInt(url.searchParams.get("limit") || "100");
    const klines = binanceKlineProvider.getKlineHistory(limit);
    return Response.json(klines);
  }

  // GET /api/dashboard - Combined dashboard data
  if (path === "/api/dashboard" && method === "GET") {
    const market = marketEngine.getCurrentMarket();
    const timeRemaining = marketEngine.getTimeRemaining();
    const portfolio = marketEngine.getPortfolio();
    const lastSignal = binanceKlineProvider.getLastSignal();
    const signalStats = binanceKlineProvider.getStats();
    const bots = botManager.getBots();
    const activeBots = bots.filter((b) => b.enabled);

    return Response.json({
      market,
      timeRemaining,
      portfolio,
      btcPrice: priceService.getPrice(),
      signal: lastSignal,
      signalStats,
      activeBots: activeBots.length,
      totalBots: bots.length,
      timestamp: Date.now(),
    });
  }

  // GET /api/markets/signals - Get signals for all active crypto markets
  if (path === "/api/markets/signals" && method === "GET") {
    const markets = marketEngine.getAvailableMarkets();
    const lastSignal = binanceKlineProvider.getLastSignal();
    const btcPrice = priceService.getPrice();
    const signalStats = binanceKlineProvider.getStats();

    // Calculate signal for each market
    const marketSignals = markets.map((market) => {
      const yesPrice = parseFloat(market.outcomePrices?.yes || "0.5");
      const noPrice = parseFloat(market.outcomePrices?.no || "0.5");
      const timeRemaining = market.endTime - Date.now();

      // Determine if market is in scalp window (last 3-12 seconds)
      const inScalpWindow = timeRemaining <= 12000 && timeRemaining >= 3000;

      // Get signal recommendation based on Binance data
      let recommendation = "HOLD";
      let confidence = 0;
      let reason = "";

      if (lastSignal && lastSignal.type !== "NEUTRAL") {
        const signalAge = Date.now() - lastSignal.timestamp;
        if (signalAge < 8000) {
          recommendation = lastSignal.predictedOutcome || "HOLD";
          confidence = lastSignal.confidence;
          reason = `Binance ${lastSignal.type}: ${lastSignal.changePercent >= 0 ? "+" : ""}${lastSignal.changePercent.toFixed(4)}%`;
        }
      }

      // Calculate ROI for each outcome
      const yesRoi = yesPrice > 0 ? (1 / yesPrice - 1) * 100 : 0;
      const noRoi = noPrice > 0 ? (1 / noPrice - 1) * 100 : 0;

      return {
        id: market.id,
        question: market.question,
        category: market.category,
        endTime: market.endTime,
        timeRemaining,
        yesPrice,
        noPrice,
        yesRoi,
        noRoi,
        volume: market.volumeNum || 0,
        liquidity: market.liquidity || 0,
        signal: {
          recommendation,
          confidence,
          reason,
          inScalpWindow,
        },
        is5Min: (market as any).is5Min,
      };
    });

    return Response.json({
      markets: marketSignals,
      btcPrice,
      lastSignal,
      signalStats,
      timestamp: Date.now(),
    });
  }

  // POST /api/simulation/toggle - Toggle simulation mode
  if (path === "/api/simulation/toggle" && method === "POST") {
    const body = (await parseBody(req)) as { enabled?: boolean };
    const enabled = body?.enabled ?? true;
    polymarketProvider.setSimulationMode(enabled);
    return Response.json({ success: true, simulationEnabled: enabled });
  }

  // GET /api/simulation/status - Get simulation status
  if (path === "/api/simulation/status" && method === "GET") {
    return Response.json({ simulationEnabled: true }); // Always true for now
  }

  // GET /api/bots/logs - Get bot activity logs
  if (path === "/api/bots/logs" && method === "GET") {
    const limit = parseInt(url.searchParams.get("limit") || "50");
    return Response.json(botManager.getLogs(limit));
  }

  // POST /api/market/timeframe - Switch timeframe
  if (path === "/api/market/timeframe" && method === "POST") {
    const body = (await parseBody(req)) as { timeframe?: string };
    if (!body?.timeframe) {
      return Response.json({ success: false, error: "Missing timeframe" }, { status: 400 });
    }
    const success = await marketEngine.setTimeframe(body.timeframe);
    return Response.json({
      success,
      timeframe: body.timeframe,
      availableTimeframes: polymarketProvider.getAvailableTimeframes(),
    });
  }

  // GET /api/market/timeframe - Get current timeframe
  if (path === "/api/market/timeframe" && method === "GET") {
    return Response.json({
      timeframe: marketEngine.getTimeframe(),
      availableTimeframes: polymarketProvider.getAvailableTimeframes(),
    });
  }

  // POST /api/market/asset - Switch asset
  if (path === "/api/market/asset" && method === "POST") {
    const body = (await parseBody(req)) as { asset?: string };
    if (!body?.asset) {
      return Response.json({ success: false, error: "Missing asset" }, { status: 400 });
    }
    const success = await marketEngine.setAsset(body.asset);
    return Response.json({ success, asset: body.asset });
  }

  return Response.json({ error: "Not found" }, { status: 404 });
}

console.log(`Server running at http://localhost:${PORT}`);
console.log(`Polymarket Strategy Tester v4.0`);
console.log(`Mode: SIMULATED 5-minute BTC markets (real Polymarket 5m markets discontinued)`);
console.log(`Features: Binance signals, Bot strategies, Real-time BTC price`);

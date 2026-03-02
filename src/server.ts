import { serve } from "bun";
import index from "./index.html";
import { TradingEngine, strategies, getDefaultBotConfigs, type StrategyType } from "./trading";
import { createSession, endSession, addTrade, settleTrade, addMarketHistory, getSessions, getSessionTrades, getSessionStats, getActiveSession, getMarketHistory, db } from "./database";
import type { Market, BotConfig, TradeRequest, TradeResponse, MarketPrice, Position } from "./types";

const engine = new TradingEngine();
let botConfigs = getDefaultBotConfigs();
let botIntervals: Map<string, number> = new Map();
let currentBitcoinMarket: Market | null = null;
let marketStartTime = 0;
let priceHistory: number[] = [];
let tradeEvents: Array<{ type: string; bot?: string; outcome?: string; amount?: number; pnl?: number; time: number }> = [];
let marketHistory: Array<{ id: string; result: 'UP' | 'DOWN'; startPrice: number; endPrice: number; startTime: number; endTime: number }> = [];
let activeSessionId: string | null = null;
let botStartTimes: Map<string, number> = new Map();

const MARKET_DURATION = 5 * 60 * 1000;
const PRICE_UPDATE_INTERVAL = 2000;
const BTC_API = "https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd";

const POLYMARKET_GAMMA_API = "https://gamma-api.polymarket.com";
const POLYMARKET_CLOB_API = "https://clob.polymarket.com";

import { RealTimeDataClient, Message } from "@polymarket/real-time-data-client";

interface PolymarketMarket {
  id: string;
  question: string;
  description: string;
  volumeNum: string;
  volume?: string;
  liquidity: string;
  outcomes: string[];
  endDateTimestamp: string;
  state: string;
  groupItemId?: string;
  conditionId?: string;
  tokenId?: string;
  outcomePrices?: string;
}

let activePolymarketMarkets: PolymarketMarket[] = [];
let liveBtcPrice = 0;
let lastPriceUpdate = 0;

function initRealTimeDataClient() {
  try {
    const rtClient = new RealTimeDataClient({
      onMessage: (message: Message) => {
        if (message.topic === "crypto_prices" && message.type === "update") {
          const payload = message.payload as any;
          if (payload.symbol === "BTCUSDT") {
            liveBtcPrice = payload.value;
            lastPriceUpdate = Date.now();
          }
        }
      },
      onConnect: (client: RealTimeDataClient) => {
        console.log("[RTDS] Connected to Polymarket real-time data");
        client.subscribe({
          subscriptions: [
            {
              topic: "crypto_prices",
              type: "update",
              filters: `{"symbol":"BTCUSDT"}`,
            },
          ],
        });
      },
    });
    rtClient.connect();
    console.log("[RTDS] Real-time data client initialized");
  } catch (error) {
    console.error("[RTDS] Failed to initialize:", error);
  }
}

async function fetchPolymarketBitcoinMarkets(): Promise<PolymarketMarket[]> {
  try {
    const now = Date.now();
    const response = await fetch(
      `${POLYMARKET_GAMMA_API}/markets?limit=50&active=true&closed=false&order=volume`
    );
    const data = await response.json();
    
    if (!Array.isArray(data) || data.length === 0) {
      console.log('[Polymarket] No markets returned from API');
      return [];
    }
    
    const activeMarkets = data.filter((m: PolymarketMarket) => {
      const endTime = parseInt(m.endDateTimestamp || m.endDate) * 1000;
      const isActive = endTime > now + 60 * 60 * 1000;
      return isActive;
    }).slice(0, 5);
    
    console.log(`[Polymarket] Found ${activeMarkets.length} active markets, using first: "${activeMarkets[0]?.question?.substring(0, 40)}..."`);
    return activeMarkets;
  } catch (error) {
    console.error('[Polymarket] Failed to fetch markets:', error);
    return [];
  }
}

async function fetchPolymarketPrices(markets: PolymarketMarket[]): Promise<Map<string, { yes: number; no: number }>> {
  const prices = new Map<string, { yes: number; no: number }>();
  
  if (markets.length === 0) return prices;
  
  for (const market of markets) {
    try {
      let yesPrice = 0.5;
      let noPrice = 0.5;
      
      if (market.outcomePrices) {
        if (typeof market.outcomePrices === 'string') {
          const parsed = JSON.parse(market.outcomePrices);
          yesPrice = parseFloat(parsed[0]) || 0.5;
          noPrice = parseFloat(parsed[1]) || 0.5;
        } else if (Array.isArray(market.outcomePrices)) {
          yesPrice = parseFloat(market.outcomePrices[0]) || 0.5;
          noPrice = parseFloat(market.outcomePrices[1]) || 0.5;
        }
      }
      
      prices.set(market.id, { yes: yesPrice, no: noPrice });
    } catch (e) {
      console.error(`[Polymarket] Failed to parse price for ${market.id}:`, e);
    }
  }
  
  console.log(`[Polymarket] Got prices for ${prices.size} markets`);
  return prices;
}

async function fetchBitcoinPrice(): Promise<number> {
  if (liveBtcPrice > 0 && Date.now() - lastPriceUpdate < 60000) {
    return liveBtcPrice;
  }
  
  try {
    const response = await fetch(BTC_API);
    const data = await response.json();
    return data.bitcoin.usd;
  } catch (error) {
    console.error("Failed to fetch BTC price:", error);
    return 67000 + Math.random() * 2000;
  }
}

function generateMarketId(): string {
  return `btc-5min-${Date.now()}`;
}

function calculateYesPrice(btcPrice: number, baseline: number, priceHistory: number[], elapsed: number, totalDuration: number): number {
  const change = (btcPrice - baseline) / baseline;
  
  const recentPrices = priceHistory.slice(-10);
  const volatility = recentPrices.length > 1 
    ? recentPrices.reduce((sum, p, i) => {
        if (i === 0) return sum;
        return sum + Math.abs(p - recentPrices[i - 1]) / recentPrices[i - 1];
      }, 0) / (recentPrices.length - 1)
    : 0.01;
  
  const momentum = recentPrices.length >= 5 
    ? (recentPrices[recentPrices.length - 1] - recentPrices[recentPrices.length - 5]) / recentPrices[recentPrices.length - 5]
    : 0;
  
  let baseProbability = 0.5;
  baseProbability += change * 5;
  baseProbability += momentum * 3;
  baseProbability += volatility * 2;
  
  const timeProgress = elapsed / totalDuration;
  const timeDecay = Math.sin(timeProgress * Math.PI) * 0.1;
  baseProbability += timeDecay;
  
  const marketNoise = (Math.random() - 0.5) * 0.05;
  baseProbability += marketNoise;
  
  const clamped = Math.max(0.02, Math.min(0.98, baseProbability));
  
  const logisticFactor = 1 / (1 + Math.exp(-(clamped - 0.5) * 8));
  return Math.max(0.02, Math.min(0.98, logisticFactor));
}

let useRealPolymarketData = true;
let polymarketPricesCache: Map<string, { yes: number; no: number }> = new Map();

async function createNewMarket(): Promise<Market> {
  const btcPrice = await fetchBitcoinPrice();
  marketStartTime = Date.now();
  priceHistory = [];
  
  let yesPrice: number = 0.5;
  let marketQuestion = `Will BTC go UP in the next period?`;
  let description = `Starting price: $${btcPrice.toLocaleString()}`;
  let volumeNum = 0;
  let liquidity = 0;
  let polymarketId: string | undefined;
  
  if (useRealPolymarketData) {
    const markets = await fetchPolymarketBitcoinMarkets();
    if (markets.length > 0) {
      activePolymarketMarkets = markets;
      const pm = markets[0];
      
      polymarketId = pm.id;
      marketQuestion = pm.question;
      
      const vol = parseFloat((pm as any).volume || pm.volumeNum || '0');
      const liq = parseFloat(pm.liquidity || '0');
      description = `Vol: $${vol.toLocaleString()} | Liq: $${liq.toLocaleString()}`;
      volumeNum = vol;
      liquidity = liq;
      
      const prices = fetchPolymarketPrices(markets);
      polymarketPricesCache = prices;
      
      const pmPrice = prices.get(pm.id);
      if (pmPrice) {
        yesPrice = pmPrice.yes;
        console.log(`[Polymarket] Using real price: ${yesPrice.toFixed(2)} for "${pm.question}"`);
      } else {
        yesPrice = calculateYesPrice(btcPrice, btcPrice, priceHistory, 0, MARKET_DURATION);
      }
    } else {
      yesPrice = calculateYesPrice(btcPrice, btcPrice, priceHistory, 0, MARKET_DURATION);
    }
  } else {
    yesPrice = calculateYesPrice(btcPrice, btcPrice, priceHistory, 0, MARKET_DURATION);
  }
  
  const newMarket: Market = {
    id: polymarketId || generateMarketId(),
    question: marketQuestion,
    description: description + ` | Real Polymarket`,
    volumeNum: volumeNum,
    liquidity: liquidity,
    outcomes: ["YES", "NO"],
    endDate: new Date(marketStartTime + MARKET_DURATION).toISOString(),
    state: "active",
    outcomePrices: { 
      yes: yesPrice.toFixed(2), 
      no: (1 - yesPrice).toFixed(2) 
    },
    groupItemId: polymarketId ? "polymarket-real" : "bitcoin-5min",
  };  };

  priceHistory.push(yesPrice);
  
  currentBitcoinMarket = newMarket;
  engine.updateMarketPrice(newMarket.id, {
    marketId: newMarket.id,
    yesPrice,
    noPrice: 1 - yesPrice,
    timestamp: Date.now(),
  });

  return newMarket;
}

async function updateMarketPrices(): Promise<void> {
  if (!currentBitcoinMarket) {
    await createNewMarket();
    return;
  }

  const elapsed = Date.now() - marketStartTime;
  
  if (elapsed >= MARKET_DURATION) {
    const lastPrice = priceHistory[priceHistory.length - 1];
    const firstPrice = priceHistory[0];
    const wentUp = lastPrice > firstPrice;
    const winningOutcome: 'YES' | 'NO' = wentUp ? 'YES' : 'NO';
    
    const settled = engine.settleAllPositions(winningOutcome);
    
    if (currentBitcoinMarket) {
      const historyEntry = {
        id: currentBitcoinMarket.id,
        result: wentUp ? 'UP' as const : 'DOWN' as const,
        startPrice: firstPrice,
        endPrice: lastPrice,
        startTime: marketStartTime,
        endTime: Date.now(),
      };
      marketHistory.unshift(historyEntry);
      if (marketHistory.length > 10) marketHistory.pop();
      
      addMarketHistory(
        currentBitcoinMarket.id,
        wentUp ? 'UP' : 'DOWN',
        firstPrice,
        lastPrice,
        marketStartTime,
        Date.now()
      );
      
      for (const pos of settled) {
        settleTrade(pos.id, pos.pnl || 0, wentUp ? 'YES' : 'NO');
      }
    }
    
    tradeEvents.push({
      type: 'market_settled',
      outcome: winningOutcome,
      amount: settled.length,
      time: Date.now(),
    });
    
    await createNewMarket();
    return;
  }

  const btcPrice = await fetchBitcoinPrice();
  
  let yesPrice: number;
  let noPrice: number;
  
  if (useRealPolymarketData && activePolymarketMarkets.length > 0) {
    const prices = fetchPolymarketPrices(activePolymarketMarkets);
    polymarketPricesCache = prices;
    
    const currentPmMarket = activePolymarketMarkets[0];
    const pmPrice = prices.get(currentPmMarket.id);
    
    if (pmPrice) {
      yesPrice = pmPrice.yes;
      noPrice = pmPrice.no;
      console.log(`[Polymarket] Real-time price: YES=${yesPrice.toFixed(2)} NO=${noPrice.toFixed(2)}`);
    } else {
      yesPrice = calculateYesPrice(btcPrice, btcPrice, priceHistory.map(p => p * 67000), elapsed, MARKET_DURATION);
      noPrice = 1 - yesPrice;
    }
  } else {
    yesPrice = calculateYesPrice(btcPrice, btcPrice, priceHistory.map(p => p * 67000), elapsed, MARKET_DURATION);
    noPrice = 1 - yesPrice;
  }
  
  priceHistory.push(yesPrice);
  if (priceHistory.length > 50) priceHistory.shift();

  const updatedMarket: Market = {
    ...currentBitcoinMarket,
    outcomePrices: {
      yes: yesPrice.toFixed(2),
      no: noPrice.toFixed(2),
    },
  };

  currentBitcoinMarket = updatedMarket;
  engine.updateMarketPrice(updatedMarket.id, {
    marketId: updatedMarket.id,
    yesPrice,
    noPrice,
    timestamp: Date.now(),
  });
}

setInterval(updateMarketPrices, PRICE_UPDATE_INTERVAL);
initRealTimeDataClient();
createNewMarket();

function getKellyBetSize(balance: number, odds: number, winRate: number, fraction = 0.25): number {
  const b = (1 / odds) - 1;
  const q = 1 - winRate;
  const kelly = (b * winRate - q) / b;
  
  if (kelly <= 0) return 0;
  
  const betSize = balance * kelly * fraction;
  return Math.max(0.1, Math.min(betSize, balance * 0.1));
}

function executeBot(bot: BotConfig): void {
  if (!currentBitcoinMarket) return;
  
  const strategy = strategies[bot.type as StrategyType];
  if (!strategy) return;
  
  const result = strategy.execute(engine, currentBitcoinMarket.id, bot.betSize);
  if (!result) return;
  
  let betSize = bot.betSize;
  
  if (bot.useKelly && bot.stats) {
    const winRate = bot.stats.winRate || 0.5;
    const odds = result.outcome === 'YES' 
      ? parseFloat(currentBitcoinMarket.outcomePrices?.yes || '0.5')
      : parseFloat(currentBitcoinMarket.outcomePrices?.no || '0.5');
    betSize = getKellyBetSize(engine.getBalance(), odds, winRate);
    betSize = Math.min(betSize, bot.maxBet || 10);
  }
  
  if (betSize < 0.1) betSize = 0.1;
  
  const position = engine.placeTrade(
    currentBitcoinMarket.id,
    result.outcome,
    betSize,
    bot.id
  );
  
  if (position) {
    if (activeSessionId) {
      addTrade(activeSessionId, position.id, result.outcome, betSize, position.odds, currentBitcoinMarket.id);
    }
    
    tradeEvents.unshift({
      type: 'trade',
      bot: bot.name,
      outcome: result.outcome,
      amount: betSize,
      time: Date.now(),
    });
    if (tradeEvents.length > 50) tradeEvents.pop();
  }
}

const server = serve({
  routes: {
    "/*": index,

    "/api/market": {
      async GET() {
        const btcPrice = await fetchBitcoinPrice();
        const elapsed = Date.now() - marketStartTime;
        const remaining = Math.max(0, MARKET_DURATION - elapsed);
        
        return Response.json({
          market: currentBitcoinMarket,
          btcPrice,
          priceHistory: priceHistory.slice(-30),
          timeRemaining: remaining,
          marketDuration: MARKET_DURATION,
          startedAt: marketStartTime,
        });
      },
    },

    "/api/market/refresh": {
      async POST() {
        const openPositions = engine.getOpenPositions();
        for (const pos of openPositions) {
          engine.closePosition(pos.id);
        }
        
        tradeEvents.unshift({ type: 'market_refresh', time: Date.now() });
        
        const newMarket = await createNewMarket();
        return Response.json({ success: true, market: newMarket });
      },
    },

    "/api/markets": {
      async GET() {
        return Response.json({
          markets: currentBitcoinMarket ? [currentBitcoinMarket] : [],
          balance: engine.getBalance(),
        });
      },
    },

    "/api/market/history": {
      async GET() {
        return Response.json(marketHistory);
      },
    },

    "/api/portfolio": {
      async GET() {
        const portfolio = engine.getPortfolio();
        const currentPrice = engine.getCurrentPrice();
        
        const openPositions = portfolio.positions
          .filter(p => p.status === 'open')
          .map(p => {
            const currentOdds = p.outcome === 'YES' ? currentPrice?.yesPrice : currentPrice?.noPrice;
            const currentValue = currentOdds ? p.amount * (currentOdds / p.odds) : p.amount;
            const unrealizedPnl = currentValue - p.amount;
            
            return { ...p, currentOdds, currentValue, unrealizedPnl };
          });

        return Response.json({
          ...portfolio,
          openPositions,
          closedPositions: portfolio.positions.filter(p => p.status === 'closed' || p.status === 'settled'),
        });
      },
    },

    "/api/trade": {
      async POST(req) {
        const body: TradeRequest = await req.json();
        
        if (!body.marketId || !body.outcome || !body.amount) {
          return Response.json({ success: false, error: "Missing required fields" } as TradeResponse, { status: 400 });
        }

        const position = engine.placeTrade(body.marketId, body.outcome, body.amount);
        
        if (!position) {
          return Response.json({ success: false, error: "Failed to place trade" } as TradeResponse, { status: 400 });
        }

        if (activeSessionId) {
          addTrade(activeSessionId, position.id, body.outcome, body.amount, position.odds, body.marketId);
        }

        tradeEvents.unshift({
          type: 'manual_trade',
          outcome: body.outcome,
          amount: body.amount,
          time: Date.now(),
        });

        return Response.json({ success: true, position, balance: engine.getBalance() } as TradeResponse & { balance: number });
      },
    },

    "/api/positions/:id/close": {
      async POST(req) {
        const id = req.params.id;
        const position = engine.closePosition(id);
        
        if (!position) {
          return Response.json({ error: "Position not found" }, { status: 404 });
        }

        tradeEvents.unshift({
          type: 'position_closed',
          outcome: position.outcome,
          pnl: position.pnl,
          time: Date.now(),
        });

        return Response.json({ success: true, position, balance: engine.getBalance() });
      },
    },

    "/api/bots": {
      async GET() {
        const botsWithStats = botConfigs.map(bot => {
          const stats = engine.getBotStats(bot.id);
          const runTime = botStartTimes.get(bot.id) ? Date.now() - botStartTimes.get(bot.id)! : 0;
          return {
            ...bot,
            stats: {
              ...stats,
              winRate: stats.trades > 0 ? stats.wins / stats.trades : 0,
            },
            runTime,
          };
        });

        return Response.json(botsWithStats);
      },
    },

    "/api/bots/:id/toggle": {
      async POST(req) {
        const id = req.params.id;
        const bot = botConfigs.find(b => b.id === id);
        
        if (!bot) {
          return Response.json({ error: "Bot not found" }, { status: 404 });
        }

        bot.enabled = !bot.enabled;

        if (bot.enabled) {
          botStartTimes.set(id, Date.now());
          
          if (!activeSessionId) {
            activeSessionId = createSession(bot.id, bot.name, bot.type, engine.getBalance());
          }
          
          if (bot.interval > 500) {
            const intervalId = setInterval(() => {
              if (bot.enabled && currentBitcoinMarket) {
                executeBot(bot);
              }
            }, bot.interval) as unknown as number;
            
            botIntervals.set(id, intervalId);
          }
          
          tradeEvents.unshift({ type: 'bot_started', bot: bot.name, time: Date.now() });
        } else {
          const intervalId = botIntervals.get(id);
          if (intervalId) {
            clearInterval(intervalId);
            botIntervals.delete(id);
          }
          botStartTimes.delete(id);
          
          tradeEvents.unshift({ type: 'bot_stopped', bot: bot.name, time: Date.now() });
          
          const stillRunning = botConfigs.some(b => b.enabled);
          if (!stillRunning && activeSessionId) {
            const stats = getSessionStats(activeSessionId);
            endSession(activeSessionId, engine.getBalance(), stats.totalTrades, stats.winningTrades, stats.totalPnl);
            activeSessionId = null;
          }
        }

        return Response.json({ success: true, bot });
      },
    },

    "/api/bots/:id/config": {
      async POST(req) {
        const id = req.params.id;
        const updates: Partial<BotConfig> = await req.json();
        
        const bot = botConfigs.find(b => b.id === id);
        if (!bot) {
          return Response.json({ error: "Bot not found" }, { status: 404 });
        }

        const wasEnabled = bot.enabled;
        if (wasEnabled) {
          const intervalId = botIntervals.get(id);
          if (intervalId) {
            clearInterval(intervalId);
            botIntervals.delete(id);
          }
        }

        Object.assign(bot, updates);

        if (wasEnabled && bot.enabled) {
          const intervalId = setInterval(() => {
            if (bot.enabled && currentBitcoinMarket) {
              executeBot(bot);
            }
          }, bot.interval) as unknown as number;
          
          botIntervals.set(id, intervalId);
        }

        return Response.json({ success: true, bot });
      },
    },

    "/api/sessions": {
      async GET() {
        const sessions = getSessions(20);
        return Response.json(sessions);
      },
    },

    "/api/sessions/:id": {
      async GET(req) {
        const id = req.params.id;
        const trades = getSessionTrades(id);
        const stats = getSessionStats(id);
        return Response.json({ trades, stats });
      },
    },

    "/api/events": {
      async GET() {
        return Response.json(tradeEvents.slice(0, 30));
      },
    },

    "/api/reset": {
      async POST() {
        botIntervals.forEach(intervalId => clearInterval(intervalId));
        botIntervals.clear();
        botStartTimes.clear();
        
        if (activeSessionId) {
          const stats = getSessionStats(activeSessionId);
          endSession(activeSessionId, engine.getBalance(), stats.totalTrades, stats.winningTrades, stats.totalPnl);
          activeSessionId = null;
        }
        
        for (const bot of botConfigs) {
          bot.enabled = false;
        }
        
        engine.reset();
        tradeEvents = [];
        marketHistory = [];
        
        const wasActive = currentBitcoinMarket?.state === 'active';
        
        if (wasActive && currentBitcoinMarket) {
          engine.updateMarketPrice(currentBitcoinMarket.id, {
            marketId: currentBitcoinMarket.id,
            yesPrice: parseFloat(currentBitcoinMarket.outcomePrices?.yes || '0.5'),
            noPrice: parseFloat(currentBitcoinMarket.outcomePrices?.no || '0.5'),
            timestamp: Date.now(),
          });
        } else {
          await createNewMarket();
        }
        
        return Response.json({ success: true, balance: engine.getBalance() });
      },
    },

    "/api/mode": {
      async GET() {
        return Response.json({
          useRealPolymarketData,
          activeMarkets: activePolymarketMarkets.length,
          currentMarket: currentBitcoinMarket ? {
            question: currentBitcoinMarket.question,
            id: currentBitcoinMarket.id
          } : null
        });
      },
      async POST(req) {
        const body = await req.json();
        if (body.useReal !== undefined) {
          useRealPolymarketData = body.useReal;
          if (useRealPolymarketData) {
            await createNewMarket();
          }
        }
        return Response.json({ 
          useRealPolymarketData,
          message: useRealPolymarketData ? 'Now using real Polymarket data' : 'Now using simulated data'
        });
      },
    },

    "/api/btc-price": {
      async GET() {
        const price = await fetchBitcoinPrice();
        return Response.json({ price, timestamp: Date.now() });
      },
    },
  },

  development: process.env.NODE_ENV !== "production" && {
    hmr: true,
    console: true,
  },
});

console.log(`🚀 Server running at ${server.url}`);

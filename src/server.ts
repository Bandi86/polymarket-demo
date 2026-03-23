// Bun Server - Serves React app and API routes

import { serve } from 'bun'
import { marketEngine } from './lib/market-engine'
import { priceService } from './lib/price'
import { botManager } from './lib/bot-manager'
import { dbService } from './lib/database'
import { binanceKlineProvider } from './lib/providers/binance-kline-provider'
import { polymarketProvider } from './lib/providers/polymarket-provider'
import { riskManager } from './lib/risk-manager'
import { analyticsService } from './lib/analytics'

const PORT = 3000

// Initialize database
dbService.connect().catch((e) => console.error('[Server] DB init error:', e))

// Sync BTC price with polymarket provider for simulation
priceService.subscribeToUpdates((update) => {
  polymarketProvider.setBtcPrice(update.price)
})

// Subscribe to bot logs and broadcast to SSE
botManager.onLog((log) => {
  broadcastUpdate({
    type: 'bot_log',
    data: log,
  })
})

// Subscribe to market price updates for faster SSE broadcasts
marketEngine.onPriceUpdate((price) => {
  broadcastUpdate({
    type: 'market',
    data: {
      yesPrice: price.yes,
      noPrice: price.no,
      btcPrice: priceService.getPrice(),
      timeRemaining: marketEngine.getTimeRemaining(),
      timestamp: price.timestamp,
    },
  })
})

// Subscribe to position settlement events and emit logs
marketEngine.onSettlement((data) => {
  const { position, won, pnl, marketResult } = data;
  
  // Get bot name if available
  const bot = botManager.getBots().find(b => b.id === position.botId);
  const botName = bot?.name || position.botId || 'manual';
  
  // Emit SETTLED log for notifications
  botManager.addLog(
    position.botId || 'manual',
    'SETTLED',
    `${won ? 'WON' : 'LOST'} ${position.outcome} position | PnL: $${pnl.toFixed(2)} | Market: ${marketResult}`,
    {
      outcome: position.outcome,
      amount: position.amount,
      stake: position.stake,
      odds: position.odds,
      pnl: pnl,
      won: won,
      marketResult: marketResult,
      entryPrice: position.odds,
      exitPrice: position.exitPrice,
    }
  );
})

// Store connected SSE clients
const sseClients = new Set<ReadableStreamDefaultController>()

// Broadcast updates to all SSE clients
function broadcastUpdate(data: unknown) {
  const message = `data: ${JSON.stringify(data)}\n\n`
  sseClients.forEach((client) => {
    try {
      client.enqueue(new TextEncoder().encode(message))
    } catch {
      // Client disconnected
      sseClients.delete(client)
    }
  })
}

// Health heartbeat removed as onPriceUpdate handles real-time sync.
// We can keep a minimal heartbeat if needed for connection detection,
// but the client-side useTradingData handles disconnects already.

// CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

async function parseBody(req: Request): Promise<unknown> {
  try {
    return await req.json()
  } catch {
    return null
  }
}

serve({
  port: PORT,

  async fetch(req: Request): Promise<Response> {
    const url = new URL(req.url)
    const path = url.pathname
    const method = req.method

    if (method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders })
    }

    // SSE endpoint for real-time updates
    if (path === '/api/sse') {
      let heartbeatInterval: Timer | null = null;
      const stream = new ReadableStream({
        start(controller) {
          console.log(`[Server] SSE client connected. Total clients: ${sseClients.size + 1}`);
          sseClients.add(controller)

          // Send initial data
          const market = marketEngine.getCurrentMarket()
          const data = {
            type: 'connected',
            data: {
              yesPrice: parseFloat(market?.outcomePrices?.yes || '0.5'),
              noPrice: parseFloat(market?.outcomePrices?.no || '0.5'),
              btcPrice: priceService.getPrice(),
              timeRemaining: marketEngine.getTimeRemaining(),
              timestamp: Date.now(),
              // Include primary market for frontend initialization fallback
              market: market,
              // Include competition state
              competition: botManager.getCompetitionState(),
            },
          }
          
          // Prime the stream for Chrome & send retry instruction
          controller.enqueue(new TextEncoder().encode(`retry: 1000\n\n`))
          controller.enqueue(new TextEncoder().encode(`: priming\n\n`))
          
          controller.enqueue(
            new TextEncoder().encode(`data: ${JSON.stringify(data)}\n\n`),
          )

          // Heartbeat to keep connection alive
          heartbeatInterval = setInterval(() => {
            try {
              controller.enqueue(new TextEncoder().encode(`: heartbeat\n\n`))
            } catch {
              if (heartbeatInterval) clearInterval(heartbeatInterval)
              sseClients.delete(controller)
            }
          }, 15000)
        },
        cancel(controller) {
          console.log(`[Server] SSE client disconnected.`);
          sseClients.delete(controller)
          if (heartbeatInterval) clearInterval(heartbeatInterval)
        },
      })

      return new Response(stream, {
        headers: {
          'Content-Type': 'text/event-stream; charset=utf-8',
          'Cache-Control': 'no-cache, no-transform, no-store, must-revalidate',
          'Connection': 'keep-alive',
          'X-Accel-Buffering': 'no',
          ...corsHeaders,
        },
      })
    }

    if (path.startsWith('/api/')) {
      const response = await handleApiRoute(req, path, method)
      Object.entries(corsHeaders).forEach(([k, v]) =>
        response.headers.set(k, v),
      )
      // Prevent all API caching
      response.headers.set('Cache-Control', 'no-store, must-revalidate')
      return response
    }

    // Serve built assets from dist
    if (path !== '/' && !path.startsWith('/api/')) {
      try {
        const assetPath = './dist' + path
        const file = Bun.file(assetPath)
        if (await file.exists()) {
          return new Response(file)
        }
      } catch {
        // Continue to serve index.html
      }
    }

    // Serve the HTML
    try {
      const htmlFile = Bun.file('./dist/index.html')
      if (await htmlFile.exists()) {
        return new Response(htmlFile, {
          headers: { 'Content-Type': 'text/html' },
        })
      }
    } catch {
      // File doesn't exist
    }

    return new Response('Not found - run bun run build first', { status: 404 })
  },

  development: { hmr: true, console: true },
})

async function handleApiRoute(
  req: Request,
  path: string,
  method: string,
): Promise<Response> {
  const url = new URL(req.url)

  // GET /api/debug/engine
  if (path === '/api/debug/engine' && method === 'GET') {
    return Response.json({
      currentMarket: marketEngine.getCurrentMarket(),
      config: (marketEngine as any).config,
      settledMarketIds: Array.from((marketEngine as any).settledMarketIds || []),
      lastUpdate: (marketEngine as any).lastUpdate
    })
  }

  // GET /api/market - Current market state
  if (path === '/api/market' && method === 'GET') {
    const market = marketEngine.getCurrentMarket()
    const timeRemaining = marketEngine.getTimeRemaining()
    const totalDuration = market ? market.endTime - market.startTime : 0

    return Response.json({
      market,
      btcPrice: priceService.getPrice(),
      priceHistory: [],
      yesPriceHistory: market?.yesPriceHistory || [],
      btcPriceHistory: [],
      timeRemaining,
      marketDuration: totalDuration,
      startedAt: market?.startTime || Date.now(),
    })
  }

  // GET /api/markets/available - List of tradeable markets
  if (path === '/api/markets/available' && method === 'GET') {
    const markets = marketEngine.getAvailableMarkets()
    return Response.json(markets)
  }

  // POST /api/market/switch - Switch to a different market
  if (path === '/api/market/switch' && method === 'POST') {
    const body = (await parseBody(req)) as { marketId?: string }
    if (!body?.marketId) {
      return Response.json(
        { success: false, error: 'Missing marketId' },
        { status: 400 },
      )
    }
    const success = await marketEngine.switchMarket(body.marketId)
    return Response.json({ success })
  }

  // POST /api/market/refresh - Force new market
  if (path === '/api/market/refresh' && method === 'POST') {
    marketEngine.forceNewMarket()
    return Response.json({ success: true })
  }

  // GET /api/market/history - Completed markets
  if (path === '/api/market/history' && method === 'GET') {
    return Response.json(marketEngine.getMarketHistory())
  }

  // POST /api/trade - Place a trade
  if (path === '/api/trade' && method === 'POST') {
    const body = (await parseBody(req)) as {
      outcome?: string
      amount?: number
      marketId?: string
    }

    if (!body?.outcome || !body?.amount) {
      return Response.json(
        { success: false, error: 'Missing outcome or amount' },
        { status: 400 },
      )
    }

    if (body.amount < 0.01) {
      return Response.json(
        { success: false, error: 'Minimum bet is $0.01' },
        { status: 400 },
      )
    }

    const position = marketEngine.placeTrade(
      body.outcome as 'YES' | 'NO',
      body.amount,
    )

    if (!position) {
      return Response.json(
        { success: false, error: 'Failed to place trade' },
        { status: 400 },
      )
    }

    return Response.json({ success: true, position })
  }

  // GET /api/portfolio - Get portfolio
  if (path === '/api/portfolio' && method === 'GET') {
    return Response.json(marketEngine.getPortfolio())
  }

  // GET /api/positions - Get all positions
  if (path === '/api/positions' && method === 'GET') {
    return Response.json({
      open: marketEngine.getOpenPositions(),
      settled: marketEngine.getClosedPositions(),
    })
  }

  // POST /api/positions/:id/close - Close a position
  const closeMatch = path.match(/^\/api\/positions\/([^/]+)\/close$/)
  if (closeMatch && method === 'POST') {
    const positionId = closeMatch[1]
    const position = marketEngine.closePosition(positionId)
    if (!position) {
      return Response.json(
        { success: false, error: 'Position not found or already closed' },
        { status: 404 },
      )
    }
    return Response.json({ success: true, position })
  }

  // GET /api/bots - Get all bots
  if (path === '/api/bots' && method === 'GET') {
    return Response.json(botManager.getBots())
  }

  // POST /api/bots/:id/toggle - Toggle bot
  const toggleMatch = path.match(/^\/api\/bots\/([^/]+)\/toggle$/)
  if (toggleMatch && method === 'POST') {
    const botId = toggleMatch[1]
    const bot = botManager.toggleBot(botId)
    if (!bot) {
      return Response.json({ error: 'Bot not found' }, { status: 404 })
    }
    return Response.json(bot)
  }

  // POST /api/bots/:id/config - Update bot config
  const configMatch = path.match(/^\/api\/bots\/([^/]+)\/config$/)
  if (configMatch && method === 'POST') {
    const body = (await parseBody(req)) as Record<string, unknown>
    const bot = botManager.updateBotConfig(configMatch[1], body)
    if (!bot) {
      return Response.json({ error: 'Bot not found' }, { status: 404 })
    }
    return Response.json(bot)
  }

  // POST /api/bots/stop-all
  if (path === '/api/bots/stop-all' && method === 'POST') {
    botManager.stopAllBots()
    return Response.json({ success: true })
  }

  // POST /api/bots/reset-all
  if (path === '/api/bots/reset-all' && method === 'POST') {
    botManager.resetAllBots()
    return Response.json({ success: true })
  }

  // POST /api/bots/:id/reset - Reset single bot
  const resetBotMatch = path.match(/^\/api\/bots\/([^/]+)\/reset$/)
  if (resetBotMatch && method === 'POST') {
    const botId = resetBotMatch[1]
    const bot = botManager.getBot(botId)
    if (!bot) {
      return Response.json({ error: 'Bot not found' }, { status: 404 })
    }
    // Reset portfolio
    marketEngine.initBotPortfolio(botId)
    const portfolio = marketEngine.getBotPortfolio(botId)
    portfolio.balance = 10
    portfolio.initialBalance = 10
    // Reset stats via bot config update
    botManager.updateBotConfig(botId, {
      stats: {
        trades: 0, wins: 0, losses: 0, pnl: 0, winRate: 0,
        avgWin: 0, avgLoss: 0, profitFactor: 0,
        maxConsecutiveWins: 0, maxConsecutiveLosses: 0
      }
    })
    return Response.json({ success: true, bot: botManager.getBot(botId) })
  }

  // POST /api/bots/run-all
  if (path === '/api/bots/run-all' && method === 'POST') {
    const body = (await parseBody(req)) as {
      betSize?: number
      interval?: number
    }
    botManager.runAllBots(body)
    return Response.json({ success: true })
  }

  // GET /api/competition/status
  if (path === '/api/competition/status' && method === 'GET') {
    return Response.json(botManager.getCompetitionState())
  }

  // POST /api/competition/start
  if (path === '/api/competition/start' && method === 'POST') {
    const body = (await parseBody(req)) as {
      minTrades?: number
      startBalance?: number
      duration?: number | null
    }
    const competition = botManager.startCompetition(body)
    return Response.json({ success: true, competition })
  }

  // POST /api/competition/stop
  if (path === '/api/competition/stop' && method === 'POST') {
    const competition = botManager.stopCompetition()
    // Broadcast competition state change
    broadcastUpdate({ type: 'competition', data: competition })
    return Response.json({ success: true, competition })
  }

  // POST /api/competition/clear
  if (path === '/api/competition/clear' && method === 'POST') {
    const competition = botManager.clearCompetition()
    // Broadcast competition state change
    broadcastUpdate({ type: 'competition', data: competition })
    return Response.json({ success: true, competition })
  }

  // POST /api/competition/quick-run - Start a quick run with specified duration
  if (path === '/api/competition/quick-run' && method === 'POST') {
    const body = await parseBody(req) as { durationMinutes?: number } | null
    const durationMinutes = body?.durationMinutes || 60
    const durationMs = durationMinutes * 60 * 1000

    // Reset everything first
    botManager.resetAllBots()
    riskManager.resetAll()
    marketEngine.reset()

    // Wait for market to be ready (max 10 seconds)
    let retries = 0
    while (!marketEngine.getCurrentMarket() && retries < 50) {
      await new Promise(r => setTimeout(r, 200))
      retries++
    }

    if (!marketEngine.getCurrentMarket()) {
      return Response.json({
        success: false,
        error: 'Failed to get market data. Please try again.'
      })
    }

    // Start competition
    const competition = botManager.startCompetition({
      minTrades: 0,
      startBalance: 10,
      duration: durationMs,
    })

    // Schedule auto-stop after duration
    setTimeout(async () => {
      console.log(`[Server] ${durationMinutes}min run complete, stopping...`)
      botManager.stopCompetition()

      // Save data to file
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
      const filename = `/tmp/polymarket-${durationMinutes}m-run-${timestamp}.json`

      const data = {
        timestamp: new Date().toISOString(),
        duration: durationMinutes,
        competition: botManager.getCompetitionState(),
        bots: botManager.getBots().map(b => ({
          id: b.id,
          name: b.name,
          strategy: b.strategy,
          balance: b.portfolio?.balance,
          pnl: b.portfolio?.totalPnL,
          trades: b.portfolio?.totalTrades,
          winRate: b.portfolio?.winRate,
          stats: b.stats,
        })),
      }

      try {
        await Bun.write(filename, JSON.stringify(data, null, 2))
        console.log(`[Server] Data saved to ${filename}`)
      } catch (e) {
        console.error('[Server] Failed to save data:', e)
      }
    }, durationMs)

    return Response.json({ success: true, competition })
  }

  // POST /api/competition/one-hour-run - Start 1-hour run with auto-save (legacy)
  if (path === '/api/competition/one-hour-run' && method === 'POST') {
    // Reset everything first
    botManager.resetAllBots()
    riskManager.resetAll()
    marketEngine.reset()

    // Wait for market to be ready (max 10 seconds)
    let retries = 0
    while (!marketEngine.getCurrentMarket() && retries < 50) {
      await new Promise(r => setTimeout(r, 200))
      retries++
    }

    if (!marketEngine.getCurrentMarket()) {
      return Response.json({
        success: false,
        error: 'Failed to get market data. Please try again.'
      })
    }

    // Start competition for 1 hour
    const ONE_HOUR_MS = 60 * 60 * 1000
    const competition = botManager.startCompetition({
      minTrades: 0, // No minimum trades requirement
      startBalance: 10,
      duration: ONE_HOUR_MS,
    })

    // Note: startCompetition already enables and starts all bots

    // Schedule auto-stop and save after 1 hour
    setTimeout(async () => {
      console.log('[Server] 1-hour run complete, stopping and saving data...')
      botManager.stopCompetition()

      // Save all data to file
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
      const filename = `/tmp/polymarket-1hr-run-${timestamp}.json`

      const data = {
        timestamp: new Date().toISOString(),
        competition: botManager.getCompetitionState(),
        bots: botManager.getBots().map(b => ({
          id: b.id,
          name: b.name,
          strategy: b.strategy,
          balance: b.portfolio?.balance,
          stats: b.stats,
          portfolio: b.portfolio,
        })),
        logs: botManager.getLogs(500),
      }

      try {
        await Bun.write(filename, JSON.stringify(data, null, 2))
        console.log(`[Server] Data saved to ${filename}`)
      } catch (e) {
        console.error('[Server] Failed to save data:', e)
      }
    }, ONE_HOUR_MS)

    return Response.json({
      success: true,
      competition,
      message: '1-hour run started. All bots enabled. Data will be auto-saved to /tmp/polymarket-1hr-run-*.json'
    })
  }

  // GET /api/competition/export - Export all competition data
  if (path === '/api/competition/export' && method === 'GET') {
    const data = {
      exportedAt: new Date().toISOString(),
      competition: botManager.getCompetitionState(),
      bots: botManager.getBots().map(b => ({
        id: b.id,
        name: b.name,
        strategy: b.strategy,
        enabled: b.enabled,
        balance: b.portfolio?.balance,
        stats: b.stats,
        portfolio: b.portfolio,
      })),
      logs: botManager.getLogs(500),
      market: marketEngine.getCurrentMarket(),
    }

    return Response.json(data)
  }

  // GET /api/sessions
  if (path === '/api/sessions' && method === 'GET') {
    return Response.json(botManager.getSessions())
  }

  // GET /api/strategy/strategies
  if (path === '/api/strategy/strategies' && method === 'GET') {
    return Response.json(botManager.getStrategies())
  }

  // GET /api/strategy/analyze — Use Polymarket odds
  if (path === '/api/strategy/analyze' && method === 'GET') {
    const market = marketEngine.getCurrentMarket()
    const yesPrice = parseFloat(market?.outcomePrices?.yes || '0.5')
    const noPrice = parseFloat(market?.outcomePrices?.no || '0.5')
    const yesPriceHistory = market?.yesPriceHistory || []
    const priceHistory = yesPriceHistory.map((p) => p.price)

    // Calculate volatility
    let volatility = 0
    if (priceHistory.length >= 5) {
      const changes: number[] = []
      for (let i = 1; i < priceHistory.length; i++) {
        changes.push(Math.abs(priceHistory[i] - priceHistory[i - 1]))
      }
      volatility = changes.reduce((a, b) => a + b, 0) / changes.length
    }

    // Calculate momentum
    let momentum = 0
    if (priceHistory.length >= 3) {
      const recent = priceHistory.slice(-3)
      const older = priceHistory.slice(-6, -3)
      if (older.length > 0) {
        momentum =
          recent.reduce((a, b) => a + b, 0) / recent.length -
          older.reduce((a, b) => a + b, 0) / older.length
      }
    }

    // Fair value signal
    const fairValue = 0.5 // Neutral baseline
    const edge = fairValue - yesPrice
    const fairValueAction =
      edge > 0.05 ? 'BUY_YES' : edge < -0.05 ? 'BUY_NO' : 'HOLD'

    // Anomaly
    const sum = yesPrice + noPrice
    const anomalyAction = sum < 0.98 ? 'BUY_BOTH' : 'HOLD'

    // Momentum signal
    const momentumAction =
      momentum > 0.005 ? 'BUY_YES' : momentum < -0.005 ? 'BUY_NO' : 'HOLD'

    return Response.json({
      fairValue: { action: fairValueAction, fairValue, edge },
      anomaly: { action: anomalyAction, sum, confidence: Math.abs(1 - sum) },
      momentum: {
        action: momentumAction,
        momentum,
        confidence: Math.abs(momentum) * 50,
      },
      volatility,
      marketPrice: { yesPrice, noPrice },
    })
  }

  // POST /api/mode
  if (path === '/api/mode' && method === 'POST') {
    const body = (await parseBody(req)) as {
      mode?: string
      startingBalance?: number
    }
    marketEngine.setMode(
      body.mode as 'real' | 'simulated',
      body.startingBalance,
    )
    return Response.json({ success: true, mode: body.mode })
  }

  // GET /api/mode
  if (path === '/api/mode' && method === 'GET') {
    return Response.json({ mode: marketEngine.getMode() })
  }

  // POST /api/reset
  if (path === '/api/reset' && method === 'POST') {
    marketEngine.reset()
    botManager.resetAllBots()
    return Response.json({ success: true })
  }

  // GET /api/health
  if (path === '/api/health' && method === 'GET') {
    return Response.json({
      status: 'ok',
      timestamp: Date.now(),
      btcPrice: priceService.getPrice(),
      marketActive: !!marketEngine.getCurrentMarket(),
    })
  }

  // GET /api/events
  if (path === '/api/events' && method === 'GET') {
    return Response.json([])
  }

  // GET /api/signal - Get Binance signal data
  if (path === '/api/signal' && method === 'GET') {
    const lastSignal = binanceKlineProvider.getLastSignal()
    const signalHistory = binanceKlineProvider.getSignalHistory(20)
    const stats = binanceKlineProvider.getStats()
    const currentKline = binanceKlineProvider.getCurrentKline()
    const previousKline = binanceKlineProvider.getPreviousKline()

    return Response.json({
      currentKline,
      previousKline,
      lastSignal,
      signalHistory,
      stats,
      threshold: binanceKlineProvider.getThreshold(),
    })
  }

  // POST /api/signal/threshold - Set signal threshold
  if (path === '/api/signal/threshold' && method === 'POST') {
    const body = (await parseBody(req)) as { threshold?: number }
    if (body?.threshold !== undefined && body.threshold > 0) {
      binanceKlineProvider.setThreshold(body.threshold)
      return Response.json({ success: true, threshold: body.threshold })
    }
    return Response.json(
      { success: false, error: 'Invalid threshold' },
      { status: 400 },
    )
  }

  // GET /api/signal/klines - Get kline history
  if (path === '/api/signal/klines' && method === 'GET') {
    const limit = parseInt(url.searchParams.get('limit') || '100')
    const klines = binanceKlineProvider.getKlineHistory(limit)
    return Response.json(klines)
  }

  // GET /api/dashboard - Combined dashboard data
  if (path === '/api/dashboard' && method === 'GET') {
    const market = marketEngine.getCurrentMarket()
    const timeRemaining = marketEngine.getTimeRemaining()
    const portfolio = marketEngine.getPortfolio()
    const lastSignal = binanceKlineProvider.getLastSignal()
    const signalStats = binanceKlineProvider.getStats()
    const bots = botManager.getBots()
    const activeBots = bots.filter((b) => b.enabled)

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
    })
  }

  // GET /api/markets/signals - Get signals for all active crypto markets
  if (path === '/api/markets/signals' && method === 'GET') {
    const markets = marketEngine.getAvailableMarkets()
    const lastSignal = binanceKlineProvider.getLastSignal()
    const btcPrice = priceService.getPrice()
    const signalStats = binanceKlineProvider.getStats()

    // Calculate signal for each market
    const marketSignals = markets.map((market) => {
      const yesPrice = parseFloat(market.outcomePrices?.yes || '0.5')
      const noPrice = parseFloat(market.outcomePrices?.no || '0.5')
      const timeRemaining = market.endTime - Date.now()

      // Determine if market is in scalp window (last 3-12 seconds)
      const inScalpWindow = timeRemaining <= 12000 && timeRemaining >= 3000

      // Get signal recommendation based on Binance data
      let recommendation = 'HOLD'
      let confidence = 0
      let reason = ''

      if (lastSignal && lastSignal.type !== 'NEUTRAL') {
        const signalAge = Date.now() - lastSignal.timestamp
        if (signalAge < 8000) {
          recommendation = lastSignal.predictedOutcome || 'HOLD'
          confidence = lastSignal.confidence
          reason = `Binance ${lastSignal.type}: ${lastSignal.changePercent >= 0 ? '+' : ''}${lastSignal.changePercent.toFixed(4)}%`
        }
      }

      // Calculate ROI for each outcome
      const yesRoi = yesPrice > 0 ? (1 / yesPrice - 1) * 100 : 0
      const noRoi = noPrice > 0 ? (1 / noPrice - 1) * 100 : 0

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
        is5Min: market.is5Min,
      }
    })

    return Response.json({
      markets: marketSignals,
      btcPrice,
      lastSignal,
      signalStats,
      timestamp: Date.now(),
    })
  }

  // POST /api/simulation/toggle - Toggle simulation mode
  if (path === '/api/simulation/toggle' && method === 'POST') {
    const body = (await parseBody(req)) as { enabled?: boolean }
    const enabled = body?.enabled ?? true
    polymarketProvider.setSimulationMode(enabled)
    return Response.json({ success: true, simulationEnabled: enabled })
  }

  // GET /api/simulation/status - Get simulation status
  if (path === '/api/simulation/status' && method === 'GET') {
    return Response.json({ simulationEnabled: true }) // Always true for now
  }

  // GET /api/bots/logs - Get bot activity logs
  if (path === '/api/bots/logs' && method === 'GET') {
    const limit = parseInt(url.searchParams.get('limit') || '50')
    return Response.json(botManager.getLogs(limit))
  }

  // POST /api/market/timeframe - Switch timeframe
  if (path === '/api/market/timeframe' && method === 'POST') {
    const body = (await parseBody(req)) as { timeframe?: string }
    if (!body?.timeframe) {
      return Response.json(
        { success: false, error: 'Missing timeframe' },
        { status: 400 },
      )
    }
    const success = await marketEngine.setTimeframe(body.timeframe)
    return Response.json({
      success,
      timeframe: body.timeframe,
      availableTimeframes: polymarketProvider.getAvailableTimeframes(),
    })
  }

  // GET /api/market/timeframe - Get current timeframe
  if (path === '/api/market/timeframe' && method === 'GET') {
    return Response.json({
      timeframe: marketEngine.getTimeframe(),
      availableTimeframes: polymarketProvider.getAvailableTimeframes(),
    })
  }

  // GET /api/risk/settings - Get risk settings
  if (path === '/api/risk/settings' && method === 'GET') {
    return Response.json(riskManager.getSettings())
  }

  // POST /api/risk/settings - Update risk settings
  if (path === '/api/risk/settings' && method === 'POST') {
    const body = (await parseBody(req)) as Record<string, unknown>
    riskManager.updateSettings(body)
    return Response.json({ success: true, settings: riskManager.getSettings() })
  }

  // GET /api/risk/warnings - Get risk warnings
  if (path === '/api/risk/warnings' && method === 'GET') {
    const limit = parseInt(url.searchParams.get('limit') || '50')
    return Response.json(riskManager.getWarnings(limit))
  }

  // GET /api/risk/status/:botId - Get bot risk status
  const riskStatusMatch = path.match(/^\/api\/risk\/status\/([^/]+)$/)
  if (riskStatusMatch && method === 'GET') {
    const botId = riskStatusMatch[1]
    return Response.json(riskManager.getBotRiskStatus(botId))
  }

  // POST /api/risk/resume/:botId - Resume a paused bot
  const riskResumeMatch = path.match(/^\/api\/risk\/resume\/([^/]+)$/)
  if (riskResumeMatch && method === 'POST') {
    const botId = riskResumeMatch[1]
    riskManager.resumeBot(botId)
    return Response.json({ success: true })
  }

  // POST /api/risk/reset-all - Reset all risk states
  if (path === '/api/risk/reset-all' && method === 'POST') {
    riskManager.resetAll()
    return Response.json({ success: true })
  }

  // POST /api/market/asset - Switch asset
  if (path === '/api/market/asset' && method === 'POST') {
    const body = (await parseBody(req)) as { asset?: string }
    if (!body?.asset) {
      return Response.json(
        { success: false, error: 'Missing asset' },
        { status: 400 },
      )
    }
    const success = await marketEngine.setAsset(body.asset)
    return Response.json({ success, asset: body.asset })
  }

  // GET /api/analytics/rankings - Strategy performance rankings
  if (path === '/api/analytics/rankings' && method === 'GET') {
    return Response.json(analyticsService.getStrategyPerformanceRanking())
  }

  // GET /api/analytics/distribution - Trade distribution
  if (path === '/api/analytics/distribution' && method === 'GET') {
    const positions = marketEngine.getOpenPositions().concat(marketEngine.getClosedPositions())
    return Response.json(analyticsService.calculateTradeDistribution(positions))
  }

  // GET /api/analytics/time-performance - Performance by hour
  if (path === '/api/analytics/time-performance' && method === 'GET') {
    const positions = marketEngine.getOpenPositions().concat(marketEngine.getClosedPositions())
    return Response.json(analyticsService.calculateTimeBasedPerformance(positions))
  }

  // GET /api/analytics/correlation - Strategy correlation matrix
  if (path === '/api/analytics/correlation' && method === 'GET') {
    return Response.json(analyticsService.calculateStrategyCorrelationMatrix())
  }

  // GET /api/analytics/recommendation - Market-based strategy recommendation
  if (path === '/api/analytics/recommendation' && method === 'GET') {
    const market = marketEngine.getCurrentMarket()
    const priceHistory = market?.yesPriceHistory?.map(p => p.price) || []

    const analysis = analyticsService.analyzeMarketPhase(priceHistory.length > 0 ? priceHistory : [0.5])

    // Find alternative strategies based on phase
    const alternatives: string[] = []
    if (analysis.phase === 'volatile') {
      alternatives.push('momentum', 'binance_signal')
    } else if (analysis.phase === 'trending_up' || analysis.phase === 'trending_down') {
      alternatives.push('trend', 'smart_trend')
    } else {
      alternatives.push('mean_reversion', 'fair_value')
    }

    return Response.json({
      phase: analysis.phase,
      confidence: analysis.confidence,
      recommendedStrategy: analysis.recommendedStrategy,
      alternativeStrategies: alternatives.filter(s => s !== analysis.recommendedStrategy).slice(0, 2),
      reason: analysis.reason,
      metrics: analysis.metrics,
    })
  }

  // GET /api/settings - Get all settings
  if (path === '/api/settings' && method === 'GET') {
    return Response.json({
      mode: marketEngine.getMode(),
      timeframe: marketEngine.getTimeframe(),
      risk: riskManager.getSettings(),
      defaultStartBalance: 10,
    })
  }

  // POST /api/settings - Update settings
  if (path === '/api/settings' && method === 'POST') {
    const body = (await parseBody(req)) as {
      mode?: 'real' | 'simulated'
      timeframe?: string
      risk?: Record<string, unknown>
      defaultStartBalance?: number
    }

    if (body.mode) {
      marketEngine.setMode(body.mode)
    }
    if (body.timeframe) {
      await marketEngine.setTimeframe(body.timeframe)
    }
    if (body.risk) {
      riskManager.updateSettings(body.risk)
    }

    return Response.json({
      success: true,
      settings: {
        mode: marketEngine.getMode(),
        timeframe: marketEngine.getTimeframe(),
        risk: riskManager.getSettings(),
        defaultStartBalance: 10,
      },
    })
  }

  // POST /api/balance/set-all - Set balance for all bots
  if (path === '/api/balance/set-all' && method === 'POST') {
    const body = (await parseBody(req)) as { balance: number }
    const balance = body.balance || 10

    const bots = botManager.getBots()
    for (const bot of bots) {
      const portfolio = marketEngine.getBotPortfolio(bot.id)
      if (portfolio) {
        portfolio.balance = balance
        portfolio.initialBalance = balance
      }
    }

    return Response.json({ success: true, balance, botsUpdated: bots.length })
  }

  // POST /api/balance/set/:id - Set balance for a specific bot
  const setBalanceMatch = path.match(/^\/api\/balance\/set\/([^/]+)$/)
  if (setBalanceMatch && method === 'POST') {
    const botId = setBalanceMatch[1]
    const body = (await parseBody(req)) as { balance: number }
    const balance = body.balance || 10

    const portfolio = marketEngine.getBotPortfolio(botId)
    if (!portfolio) {
      return Response.json({ error: 'Bot not found' }, { status: 404 })
    }

    portfolio.balance = balance
    portfolio.initialBalance = balance

    return Response.json({ success: true, botId, balance })
  }

  // GET /api/trading-mode - Get trading mode
  if (path === '/api/trading-mode' && method === 'GET') {
    return Response.json({ mode: marketEngine.getMode() })
  }

  // POST /api/trading-mode - Set trading mode
  if (path === '/api/trading-mode' && method === 'POST') {
    const body = (await parseBody(req)) as { mode?: 'real' | 'simulated' }
    if (!body?.mode) {
      return Response.json(
        { success: false, error: 'Missing mode' },
        { status: 400 },
      )
    }
    marketEngine.setMode(body.mode)
    return Response.json({ success: true, mode: body.mode })
  }

  // GET /api/account - Get account info (balance, mode, risk settings)
  if (path === '/api/account' && method === 'GET') {
    const bots = botManager.getBots()
    const totalBalance = bots.reduce((sum, b) => sum + (b.portfolio?.balance || 0), 0)
    
    return Response.json({
      mode: marketEngine.getMode() === 'real' ? 'live' : 'demo',
      totalBalance,
      botCount: bots.length,
      riskSettings: riskManager.getSettings(),
      connectionStatus: polymarketProvider.getConfig().apiKey ? 'configured' : 'not_configured',
    })
  }

  // POST /api/account/sync - Sync live account balance from Polymarket
  if (path === '/api/account/sync' && method === 'POST') {
    try {
      // In real mode, we would fetch the actual balance from Polymarket API
      // For now, return the current balance
      const bots = botManager.getBots()
      const totalBalance = bots.reduce((sum, b) => sum + (b.portfolio?.balance || 0), 0)
      
      return Response.json({
        success: true,
        balance: totalBalance,
        mode: marketEngine.getMode(),
        lastSync: Date.now(),
      })
    } catch (error) {
      return Response.json({ success: false, error: 'Failed to sync balance' })
    }
  }

  // POST /api/account/mode - Switch between demo and live mode
  if (path === '/api/account/mode' && method === 'POST') {
    const body = (await parseBody(req)) as { mode: 'demo' | 'live', balance?: number }
    
    if (!body?.mode) {
      return Response.json({ success: false, error: 'Missing mode' }, { status: 400 })
    }

    const newMode = body.mode === 'live' ? 'real' : 'simulated'
    
    // Switch mode
    marketEngine.setMode(newMode)
    
    // Set balance for demo mode
    if (body.mode === 'demo' && body.balance) {
      const bots = botManager.getBots()
      for (const bot of bots) {
        const portfolio = marketEngine.getBotPortfolio(bot.id)
        if (portfolio) {
          portfolio.balance = body.balance
          portfolio.initialBalance = body.balance
        }
      }
    }

    return Response.json({
      success: true,
      mode: body.mode,
      balance: body.balance || 0,
    })
  }

  // POST /api/polymarket/test-connection - Test Polymarket API connection
  if (path === '/api/polymarket/test-connection' && method === 'POST') {
    try {
      const markets = await polymarketProvider.fetchActiveMarkets()
      if (markets && markets.length > 0) {
        return Response.json({ success: true, marketsFound: markets.length })
      }
      return Response.json({ success: true, marketsFound: 0, message: 'Connected but no active markets found' })
    } catch (error) {
      return Response.json({ success: false, error: 'Failed to connect to Polymarket API' })
    }
  }

  // POST /api/backtest - Run strategies against simulated historical data
  if (path === '/api/backtest' && method === 'POST') {
    const body = (await parseBody(req)) as {
      strategies?: string[]
      startBalance?: number
      betSize?: number
      numMarkets?: number
      slippageEnabled?: boolean
    }

    const { runBacktest } = await import('./lib/backtest-engine')

    const results = runBacktest({
      strategies: body?.strategies || [
        'momentum_chaser',
        'mean_reversion_sniper',
        'sum_to_one_arb',
        'whale_follower',
        'ta_signal_engine',
        'market_maker',
      ],
      startBalance: body?.startBalance ?? 10,
      betSize: body?.betSize ?? 1,
      feeRate: 0.02,
      slippageEnabled: body?.slippageEnabled ?? true,
      baseSpread: 0.01,
      maxSlippage: 0.01,
      numMarkets: body?.numMarkets ?? 50,
    })

    return Response.json({ success: true, results })
  }

  return Response.json({ error: 'Not found' }, { status: 404 })
}

console.log(`Server running at http://localhost:${PORT}`)
console.log(`Polymarket Strategy Tester v4.0`)
console.log(
  `Mode: SIMULATED 5-minute BTC markets (real Polymarket 5m markets discontinued)`,
)
console.log(`Features: Binance signals, Bot strategies, Real-time BTC price`)

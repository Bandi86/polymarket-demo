import { NextRequest } from 'next/server';

import {
  broadcastToSSE,
  getBotManager,
  getMarketEngine,
  getPriceService,
  initializeServices,
  isInitialized,
  setSSEBroadcast,
} from '@/lib/global';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Store connected SSE clients
const sseClients = new Set<ReadableStreamDefaultController>();

// Broadcast updates to all SSE clients
function broadcastUpdate(type: string, data: unknown) {
  const message = `data: ${JSON.stringify({ type, data })}\n\n`;
  sseClients.forEach((client) => {
    try {
      client.enqueue(new TextEncoder().encode(message));
    } catch {
      // Client disconnected
      sseClients.delete(client);
    }
  });
}

// Set up the broadcast function in the global module
setSSEBroadcast(broadcastUpdate);

export async function GET(request: NextRequest) {
  // Initialize services on first request
  if (!isInitialized()) {
    try {
      await initializeServices();
    } catch (error) {
      console.error('[SSE] Failed to initialize services:', error);
      return new Response(JSON.stringify({ error: 'Service initialization failed' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  }

  let heartbeatInterval: NodeJS.Timeout | null = null;

  const stream = new ReadableStream({
    start(controller) {
      console.log(`[SSE] Client connected. Total clients: ${sseClients.size + 1}`);
      sseClients.add(controller);

      // Send initial data
      const marketEngine = getMarketEngine();
      const priceService = getPriceService();
      const botManager = getBotManager();

      const market = marketEngine.getCurrentMarket();
      const marketDuration = market ? market.endTime - market.startTime : 0;
      const data = {
        type: 'connected',
        data: {
          yesPrice: parseFloat(market?.outcomePrices?.yes || '0.5'),
          noPrice: parseFloat(market?.outcomePrices?.no || '0.5'),
          btcPrice: priceService.getPrice(),
          timeRemaining: marketEngine.getTimeRemaining(),
          marketDuration: marketDuration,
          timestamp: Date.now(),
          // Include primary market for frontend initialization fallback
          market: market,
          // Include competition state
          competition: botManager.getCompetitionState(),
          // Include bots data for stats
          bots: botManager.getBots(),
        },
      };

      // Prime the stream for Chrome & send retry instruction
      controller.enqueue(new TextEncoder().encode('retry: 1000\n\n'));
      controller.enqueue(new TextEncoder().encode(': priming\n\n'));

      controller.enqueue(
        new TextEncoder().encode(`data: ${JSON.stringify(data)}\n\n`),
      );

      // Heartbeat to keep connection alive (every 30 seconds)
      heartbeatInterval = setInterval(() => {
        try {
          controller.enqueue(new TextEncoder().encode(': heartbeat\n\n'));
        } catch {
          if (heartbeatInterval) clearInterval(heartbeatInterval);
          sseClients.delete(controller);
        }
      }, 30000);
    },
    cancel(controller) {
      console.log(`[SSE] Client disconnected. Remaining clients: ${sseClients.size - 1}`);
      sseClients.delete(controller);
      if (heartbeatInterval) clearInterval(heartbeatInterval);
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform, no-store, must-revalidate',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
      'Access-Control-Allow-Origin': '*',
    },
  });
}
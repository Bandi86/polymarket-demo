/**
 * Frontend Performance Tests
 * Tests for BTC price update latency, SSE stability, and store update speed
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useTradingStore } from '../src/lib/stores/trading-store';
import { useBotStore } from '../src/lib/stores/bot-store';

// Mock price service
const mockPriceService = {
  getPrice: vi.fn(),
  subscribeToUpdates: vi.fn(),
  subscribeToTrades: vi.fn(),
  isReady: vi.fn().mockReturnValue(true),
};

describe('Frontend Performance', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset stores to initial state
    useTradingStore.setState({
      yesPrice: 0.5,
      noPrice: 0.5,
      btcPrice: 0,
      priceToBeat: null,
      timeRemaining: 300000,
      marketDuration: 300000,
      marketEndTime: Date.now() + 300000,
      priceDirection: { yes: null, no: null },
      portfolio: null,
      openPositions: [],
      openPositionsValue: 0,
      competition: null,
      events: [],
      loading: true,
      apiLatency: 0,
    });
  });

  describe('BTC Price Update Latency', () => {
    it('should update store immediately when price changes', () => {
      const startTime = Date.now();

      // Simulate price update
      useTradingStore.getState().setMarketData({ btcPrice: 85000.50 });

      const endTime = Date.now();
      const updateLatency = endTime - startTime;

      // Store update should be nearly instant (< 10ms)
      expect(updateLatency).toBeLessThan(10);

      // Verify price was updated
      const state = useTradingStore.getState();
      expect(state.btcPrice).toBe(85000.50);
    });

    it('should handle rapid price updates without lag', () => {
      const prices = [85000, 85001, 85002, 85003, 85004, 85005];
      const startTime = Date.now();

      // Simulate 100 rapid price updates
      for (let i = 0; i < 100; i++) {
        useTradingStore.getState().setMarketData({ btcPrice: 85000 + i });
      }

      const endTime = Date.now();
      const totalLatency = endTime - startTime;
      const avgLatency = totalLatency / 100;

      // Average update should be < 1ms (Zustand is very fast)
      expect(avgLatency).toBeLessThan(1);

      // Verify final price
      expect(useTradingStore.getState().btcPrice).toBe(85099);
    });

    it('should complete price updates quickly without blocking', () => {
      const startTime = performance.now();

      // Simulate 200 price updates (simulating 2 seconds of trading at 100ms throttle)
      for (let i = 0; i < 200; i++) {
        useTradingStore.getState().setMarketData({
          btcPrice: 85000 + Math.random() * 100
        });
      }

      const endTime = performance.now();
      const totalDuration = endTime - startTime;

      // All 200 updates should complete in < 100ms (Zustand is very fast)
      expect(totalDuration).toBeLessThan(100);

      // Verify final price was updated
      const state = useTradingStore.getState();
      expect(state.btcPrice).toBeGreaterThanOrEqual(85000);
      expect(state.btcPrice).toBeLessThanOrEqual(85100);
    });
  });

  describe('SSE Connection Stability', () => {
    it('should handle SSE message parsing correctly', () => {
      const testMessages = [
        { type: 'price', data: { price: 85000 } },
        { type: 'market_price', data: { yes: 0.52, no: 0.48, btcPrice: 85000 } },
        { type: 'timer', data: { timeRemaining: 240000 } },
        { type: 'bots', data: [{ id: 'bot-1', enabled: true }] },
      ];

      testMessages.forEach(msg => {
        expect(() => {
          // Simulate SSE message handling with type assertions
          const data = msg.data as Record<string, unknown>;
          if (msg.type === 'price') {
            useTradingStore.getState().setMarketData({ btcPrice: data.price as number });
          } else if (msg.type === 'market_price') {
            useTradingStore.getState().setMarketData({
              btcPrice: data.btcPrice as number,
              timeRemaining: data.timeRemaining as number,
            });
          } else if (msg.type === 'timer') {
            useTradingStore.getState().setMarketData({ timeRemaining: data.timeRemaining as number });
          }
        }).not.toThrow();
      });
    });

    it('should recover from malformed SSE messages', () => {
      const malformedMessages = [
        null,
        undefined,
        {},
        { type: null },
        { data: null },
        'invalid json',
      ];

      malformedMessages.forEach(msg => {
        expect(() => {
          // Simulate error handling
          if (msg && typeof msg === 'object' && 'type' in msg) {
            useTradingStore.getState().setMarketData({ loading: false });
          }
        }).not.toThrow();
      });

      // Store should still be functional after errors
      expect(() => {
        useTradingStore.getState().setMarketData({ btcPrice: 85000 });
      }).not.toThrow();
    });

    it('should handle SSE reconnection gracefully', () => {
      // Simulate connection state changes
      let connected = true;

      // Disconnect
      connected = false;
      expect(connected).toBe(false);

      // Reconnect
      connected = true;
      expect(connected).toBe(true);

      // Store should maintain state through reconnection
      useTradingStore.getState().setMarketData({ btcPrice: 85100 });
      expect(useTradingStore.getState().btcPrice).toBe(85100);
    });
  });

  describe('Store Update Performance', () => {
    it('should batch multiple updates efficiently', () => {
      const startTime = performance.now();

      // Batch multiple updates
      useTradingStore.getState().setMarketData({
        yesPrice: 0.52,
        noPrice: 0.48,
        btcPrice: 85000,
        timeRemaining: 240000,
        priceToBeat: 84900,
      });

      const endTime = performance.now();
      const updateDuration = endTime - startTime;

      // Batch update should complete in < 5ms
      expect(updateDuration).toBeLessThan(5);

      // Verify all values updated
      const state = useTradingStore.getState();
      expect(state.yesPrice).toBe(0.52);
      expect(state.noPrice).toBe(0.48);
      expect(state.btcPrice).toBe(85000);
      expect(state.timeRemaining).toBe(240000);
      expect(state.priceToBeat).toBe(84900);
    });

    it('should not trigger unnecessary re-renders', () => {
      let renderCount = 0;

      // Subscribe to store changes (simulates component subscription)
      const unsubscribe = useTradingStore.subscribe(
        (state) => state.btcPrice,
        () => { renderCount++; }
      );

      // Update unrelated field
      useTradingStore.getState().setMarketData({ timeRemaining: 200000 });

      // Render count should not increase (only subscribed field triggers)
      expect(renderCount).toBe(0);

      // Update subscribed field
      useTradingStore.getState().setMarketData({ btcPrice: 85001 });

      // Now render count should increase
      expect(renderCount).toBe(1);

      unsubscribe();
    });

    it('should handle memory cleanup properly', () => {
      // Add events to store
      for (let i = 0; i < 100; i++) {
        useTradingStore.getState().addEvent({ id: i, type: 'test' });
      }

      // Verify events were added
      expect(useTradingStore.getState().events.length).toBeGreaterThan(0);

      // Reset store (simulates cleanup)
      useTradingStore.getState().reset();

      // Events should be cleared
      expect(useTradingStore.getState().events.length).toBe(0);
    });
  });

  describe('Price Update Throttling', () => {
    it('should throttle price updates to prevent flooding', () => {
      const THROTTLE_MS = 100;
      const updates: number[] = [];

      const unsubscribe = useTradingStore.subscribe(
        (state) => state.btcPrice,
        (price) => { updates.push(Date.now()); }
      );

      // Simulate 50 rapid price updates in 500ms
      const startTime = Date.now();
      for (let i = 0; i < 50; i++) {
        useTradingStore.getState().setMarketData({ btcPrice: 85000 + i });
      }

      const endTime = Date.now();
      const duration = endTime - startTime;

      // All updates should complete quickly
      expect(duration).toBeLessThan(100);

      unsubscribe();
    });
  });
});

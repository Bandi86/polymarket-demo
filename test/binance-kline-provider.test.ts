import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { BinanceKlineProvider } from '../src/lib/providers/binance-kline-provider';

// Mock WebSocket
class MockWebSocket {
  onopen: (() => void) | null = null;
  onmessage: ((event: any) => void) | null = null;
  onerror: ((error: any) => void) | null = null;
  onclose: (() => void) | null = null;
  
  constructor(public url: string) {
    // Auto-trigger onopen in the next tick
    setTimeout(() => {
      if (this.onopen) this.onopen();
    }, 0);
  }

  close() {
    if (this.onclose) this.onclose();
  }
}

describe('BinanceKlineProvider', () => {
  let provider: BinanceKlineProvider;

  beforeEach(() => {
    // vi.stubGlobal('WebSocket', MockWebSocket);
    (global as any).WebSocket = MockWebSocket;
    
    // Create new provider for each test with custom config
    provider = new BinanceKlineProvider({
      symbol: 'btcusdt',
      interval: '1s',
      threshold: 0.01,
      enableSignals: true
    });
  });

  afterEach(() => {
    provider.destroy();
    vi.restoreAllMocks();
  });

  it('should process kline messages and update currentKline', () => {
    // Get the mocked WS instance
    const ws = (provider as any).ws as MockWebSocket;
    
    // Simulate incoming message
    const mockMessage = {
      k: {
        t: 1000000,
        T: 1000999,
        o: "50000",
        h: "50100",
        l: "49900",
        c: "50050",
        v: "1.5",
        x: false // Not closed
      }
    };
    
    if (ws.onmessage) {
      ws.onmessage({ data: JSON.stringify(mockMessage) });
    }

    const currentKline = provider.getCurrentKline();
    expect(currentKline).toBeDefined();
    expect(currentKline?.open).toBe(50000);
    expect(currentKline?.close).toBe(50050);
    expect(currentKline?.high).toBe(50100);
    expect(currentKline?.low).toBe(49900);
    expect(currentKline?.volume).toBe(1.5);
    expect(currentKline?.isClosed).toBe(false);
  });

  it('should generate UP signal when price increases beyond threshold', () => {
    const ws = (provider as any).ws as MockWebSocket;
    
    // 1. Send first closed kline to establish previous state
    const msg1 = {
      k: { t: 1000, T: 1999, o: "50000", h: "50000", l: "50000", c: "50000", v: "1", x: true }
    };
    if (ws.onmessage) ws.onmessage({ data: JSON.stringify(msg1) });

    // 2. Send second closed kline with price jump > 0.01%
    // 0.01% of 50000 is 5. So a jump to 50010 is 0.02% (which is > 0.01%)
    const msg2 = {
      k: { t: 2000, T: 2999, o: "50000", h: "50010", l: "50000", c: "50010", v: "1", x: true }
    };
    if (ws.onmessage) ws.onmessage({ data: JSON.stringify(msg2) });

    const lastSignal = provider.getLastSignal();
    expect(lastSignal).toBeDefined();
    expect(lastSignal?.type).toBe("UP");
    expect(lastSignal?.predictedOutcome).toBe("YES");
    expect(lastSignal?.changePercent).toBeCloseTo(0.02);
    
    const stats = provider.getStats();
    expect(stats.upSignals).toBe(1);
    expect(stats.downSignals).toBe(0);
    expect(stats.totalSignals).toBe(1);
  });

  it('should generate DOWN signal when price decreases beyond threshold', () => {
    const ws = (provider as any).ws as MockWebSocket;
    
    const msg1 = {
      k: { t: 1000, T: 1999, o: "50000", h: "50000", l: "50000", c: "50000", v: "1", x: true }
    };
    if (ws.onmessage) ws.onmessage({ data: JSON.stringify(msg1) });

    // Drop to 49990 is -0.02% (magnitude > 0.01%)
    const msg2 = {
      k: { t: 2000, T: 2999, o: "50000", h: "50000", l: "49990", c: "49990", v: "1", x: true }
    };
    if (ws.onmessage) ws.onmessage({ data: JSON.stringify(msg2) });

    const lastSignal = provider.getLastSignal();
    expect(lastSignal).toBeDefined();
    expect(lastSignal?.type).toBe("DOWN");
    expect(lastSignal?.predictedOutcome).toBe("NO");
    expect(lastSignal?.changePercent).toBeCloseTo(-0.02);
  });

  it('should remain NEUTRAL when price change is below threshold', () => {
    const ws = (provider as any).ws as MockWebSocket;
    
    const msg1 = {
      k: { t: 1000, T: 1999, o: "50000", h: "50000", l: "50000", c: "50000", v: "1", x: true }
    };
    if (ws.onmessage) ws.onmessage({ data: JSON.stringify(msg1) });

    // Drop to 49999 is -0.002% (magnitude < 0.01%)
    const msg2 = {
      k: { t: 2000, T: 2999, o: "50000", h: "50000", l: "49999", c: "49999", v: "1", x: true }
    };
    if (ws.onmessage) ws.onmessage({ data: JSON.stringify(msg2) });

    // Signals are only stored in lastSignal if they are enabled, AND in history if they are NOT NEUTRAL.
    // Let's check lastSignal directly
    const lastSignal = provider.getLastSignal();
    expect(lastSignal).toBeDefined();
    expect(lastSignal?.type).toBe("NEUTRAL");
    expect(lastSignal?.predictedOutcome).toBeNull();
    
    // Shouldn't be added to signal history
    expect(provider.getSignalHistory().length).toBe(0);
  });
});

'use client'

import { useState, useEffect, useRef } from 'react';
import { TrendingUp, TrendingDown } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PriceData {
  symbol: string;
  price: number;
  change24h: number;
}

interface PriceTickerProps {
  className?: string;
}

// Simulated multi-asset prices (in production, would fetch from API)
const fetchCryptoPrices = async (): Promise<PriceData[]> => {
  try {
    const response = await fetch('https://api.binance.com/api/v3/ticker/24hr?symbols=["BTCUSDT","ETHUSDT","SOLUSDT","XRPUSDT"]');
    if (!response.ok) throw new Error('Failed to fetch');
    const data = await response.json();
    return data.map((item: { symbol: string; lastPrice: string; priceChangePercent: string }) => ({
      symbol: item.symbol.replace('USDT', ''),
      price: parseFloat(item.lastPrice),
      change24h: parseFloat(item.priceChangePercent),
    }));
  } catch {
    // Fallback mock data
    return [
      { symbol: 'BTC', price: 84000 + Math.random() * 1000, change24h: (Math.random() - 0.5) * 5 },
      { symbol: 'ETH', price: 3200 + Math.random() * 100, change24h: (Math.random() - 0.5) * 5 },
      { symbol: 'SOL', price: 140 + Math.random() * 10, change24h: (Math.random() - 0.5) * 5 },
      { symbol: 'XRP', price: 2.4 + Math.random() * 0.2, change24h: (Math.random() - 0.5) * 5 },
    ];
  }
};

function formatPrice(price: number, symbol: string): string {
  if (symbol === 'XRP') return `$${price.toFixed(3)}`;
  if (symbol === 'SOL') return `$${price.toFixed(2)}`;
  if (price >= 1000) return `$${(price / 1000).toFixed(1)}K`;
  return `$${price.toFixed(2)}`;
}

export function PriceTicker({ className }: PriceTickerProps) {
  const [prices, setPrices] = useState<PriceData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const updatePrices = async () => {
      const data = await fetchCryptoPrices();
      setPrices(data);
      setIsLoading(false);
    };

    updatePrices();
    const interval = setInterval(updatePrices, 10000); // Update every 10s

    return () => clearInterval(interval);
  }, []);

  if (isLoading) {
    return (
      <div className={cn('flex items-center gap-4 text-xs text-muted-foreground', className)}>
        <span>Loading prices...</span>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={cn(
        'flex items-center gap-4 overflow-hidden',
        'animate-marquee',
        className
      )}
    >
      {prices.map((item) => (
        <div
          key={item.symbol}
          className="flex items-center gap-1.5 px-2 py-1 rounded bg-surface-elevated whitespace-nowrap"
        >
          <span className="font-semibold text-xs">{item.symbol}</span>
          <span className="font-mono text-xs">{formatPrice(item.price, item.symbol)}</span>
          <span
            className={cn(
              'flex items-center text-[10px] font-medium',
              item.change24h >= 0 ? 'text-success' : 'text-danger'
            )}
          >
            {item.change24h >= 0 ? (
              <TrendingUp className="w-2.5 h-2.5 mr-0.5" />
            ) : (
              <TrendingDown className="w-2.5 h-2.5 mr-0.5" />
            )}
            {item.change24h >= 0 ? '+' : ''}{item.change24h.toFixed(2)}%
          </span>
        </div>
      ))}
    </div>
  );
}
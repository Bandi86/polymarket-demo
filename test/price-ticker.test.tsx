/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { PriceTicker } from '../src/components/ui/PriceTicker';

// Mock fetch for price data
const mockFetch = vi.fn();
global.fetch = mockFetch as unknown as typeof fetch;

describe('PriceTicker', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should show loading state initially', () => {
    mockFetch.mockImplementation(() => new Promise(() => {})); // Never resolves
    render(<PriceTicker />);
    expect(screen.getByText('Loading prices...')).toBeInTheDocument();
  });

  it('should display prices after fetching', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve([
        { symbol: 'BTCUSDT', lastPrice: '85000.00', priceChangePercent: '2.5' },
        { symbol: 'ETHUSDT', lastPrice: '3200.00', priceChangePercent: '-1.2' },
      ]),
    } as unknown as Response);

    render(<PriceTicker />);

    await waitFor(() => {
      expect(screen.getByText('BTC')).toBeInTheDocument();
      expect(screen.getByText('ETH')).toBeInTheDocument();
    }, { timeout: 3000 });
  });

  it('should handle fetch errors gracefully', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network error'));

    render(<PriceTicker />);

    // Should show fallback mock data
    await waitFor(() => {
      expect(screen.getByText('BTC')).toBeInTheDocument();
    }, { timeout: 3000 });
  });

  it('should show positive change indicator', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve([
        { symbol: 'BTCUSDT', lastPrice: '85000.00', priceChangePercent: '2.5' },
      ]),
    } as unknown as Response);

    render(<PriceTicker />);

    await waitFor(() => {
      expect(screen.getByText('+2.50%')).toBeInTheDocument();
    }, { timeout: 3000 });
  });

  it('should show negative change indicator', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve([
        { symbol: 'ETHUSDT', lastPrice: '3200.00', priceChangePercent: '-1.5' },
      ]),
    } as unknown as Response);

    render(<PriceTicker />);

    await waitFor(() => {
      expect(screen.getByText('-1.50%')).toBeInTheDocument();
    }, { timeout: 3000 });
  });

  it('should accept custom className', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve([
        { symbol: 'BTCUSDT', lastPrice: '85000.00', priceChangePercent: '0' },
      ]),
    } as unknown as Response);

    const { container } = render(<PriceTicker className="custom-class" />);

    await waitFor(() => {
      expect(screen.getByText('BTC')).toBeInTheDocument();
    }, { timeout: 3000 });

    expect(container.firstChild).toHaveClass('custom-class');
  });
});
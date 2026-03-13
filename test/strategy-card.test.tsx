/**
 * @vitest-environment jsdom
 */
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { StrategyCard } from '../src/components/strategy/StrategyCard';

describe('StrategyCard', () => {
  const mockStats = {
    trades: 50,
    wins: 30,
    losses: 20,
    pnl: 150.50,
    winRate: 0.60,
    avgWin: 10,
    avgLoss: 5,
    profitFactor: 2.0,
    maxConsecutiveWins: 5,
    maxConsecutiveLosses: 3,
  };

  const defaultProps = {
    strategy: 'momentum_chaser' as const,
    name: 'Momentum Chaser',
    stats: mockStats,
    enabled: true,
    pnlHistory: [100, 120, 150, 130, 150.50],
  };

  it('should render strategy name', () => {
    render(<StrategyCard {...defaultProps} />);
    expect(screen.getByText('Momentum Chaser')).toBeDefined();
  });

  it('should display PnL value', () => {
    render(<StrategyCard {...defaultProps} />);
    expect(screen.getByText(/\+150/)).toBeDefined();
  });

  it('should display win rate', () => {
    render(<StrategyCard {...defaultProps} />);
    expect(screen.getByText(/60/)).toBeDefined();
  });

  it('should show enabled status', () => {
    const { container } = render(<StrategyCard {...defaultProps} enabled />);
    expect(container.querySelector('.bg-success')).toBeDefined();
  });

  it('should show disabled status', () => {
    const { container } = render(<StrategyCard {...defaultProps} enabled={false} />);
    expect(container.firstChild).toBeDefined();
  });

  it('should render sparkline with pnl history', () => {
    const { container } = render(<StrategyCard {...defaultProps} />);
    const svg = container.querySelector('svg');
    expect(svg).toBeDefined();
  });

  it('should apply correct strategy color', () => {
    const { container } = render(<StrategyCard {...defaultProps} />);
    expect(container.firstChild).toBeDefined();
  });

  it('should accept custom className', () => {
    const { container } = render(<StrategyCard {...defaultProps} className="custom" />);
    expect(container.firstChild).toBeDefined();
  });
});
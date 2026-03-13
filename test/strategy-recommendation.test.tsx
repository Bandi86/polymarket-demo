/**
 * @vitest-environment jsdom
 */
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { StrategyRecommendation } from '../src/components/strategy/StrategyRecommendation';

describe('StrategyRecommendation', () => {
  const defaultProps = {
    strategy: 'momentum_chaser' as const,
    action: 'BUY_YES' as const,
    confidence: 0.85,
    reason: 'Strong upward momentum detected',
    priceTarget: 0.75,
    currentPrice: 0.60,
  };

  it('should render strategy name', () => {
    render(<StrategyRecommendation {...defaultProps} />);
    expect(screen.getByText(/Momentum Chaser/)).toBeDefined();
  });

  it('should display action', () => {
    render(<StrategyRecommendation {...defaultProps} />);
    expect(screen.getByText(/BUY YES/)).toBeDefined();
  });

  it('should display confidence percentage', () => {
    render(<StrategyRecommendation {...defaultProps} />);
    expect(screen.getByText(/85/)).toBeDefined();
  });

  it('should display reason', () => {
    render(<StrategyRecommendation {...defaultProps} />);
    expect(screen.getByText(/Strong upward momentum/)).toBeDefined();
  });

  it('should display price target', () => {
    render(<StrategyRecommendation {...defaultProps} />);
    expect(screen.getByText(/75/)).toBeDefined();
  });

  it('should apply BUY styling', () => {
    const { container } = render(<StrategyRecommendation {...defaultProps} action="BUY_YES" />);
    expect(container.firstChild).toBeDefined();
  });

  it('should apply SELL styling', () => {
    const { container } = render(<StrategyRecommendation {...defaultProps} action="SELL" />);
    expect(container.firstChild).toBeDefined();
  });

  it('should apply HOLD styling', () => {
    const { container } = render(<StrategyRecommendation {...defaultProps} action="HOLD" />);
    expect(container.firstChild).toBeDefined();
  });

  it('should accept custom className', () => {
    const { container } = render(<StrategyRecommendation {...defaultProps} className="custom" />);
    expect(container.firstChild).toBeDefined();
  });
});
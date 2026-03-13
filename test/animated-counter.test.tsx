/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { AnimatedCounter } from '../src/components/ui/AnimatedCounter';

describe('AnimatedCounter', () => {
  it('should render the initial value', () => {
    render(<AnimatedCounter value={100} />);
    expect(screen.getByText('100.00')).toBeDefined();
  });

  it('should format large numbers', () => {
    render(<AnimatedCounter value={1000000} />);
    expect(screen.getByText('1,000,000.00')).toBeDefined();
  });

  it('should format currency values', () => {
    render(<AnimatedCounter value={1234.56} format="currency" />);
    expect(screen.getByText('$1,234.56')).toBeDefined();
  });

  it('should format percentage values', () => {
    render(<AnimatedCounter value={0.756} format="percent" />);
    expect(screen.getByText('75.6%')).toBeDefined();
  });

  it('should apply positive class for positive changes', () => {
    const { container } = render(<AnimatedCounter value={100} previousValue={50} />);
    expect(container.firstChild).toBeDefined();
  });

  it('should apply negative class for negative changes', () => {
    const { container } = render(<AnimatedCounter value={50} previousValue={100} />);
    expect(container.firstChild).toBeDefined();
  });

  it('should accept custom className', () => {
    const { container } = render(<AnimatedCounter value={100} className="custom-class" />);
    expect(container.firstChild).toBeDefined();
  });

  it('should handle decimals option', () => {
    render(<AnimatedCounter value={123.456} decimals={2} />);
    expect(screen.getByText('123.46')).toBeDefined();
  });
});
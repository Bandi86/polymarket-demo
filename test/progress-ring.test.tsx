/**
 * @vitest-environment jsdom
 */
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ProgressRing } from '../src/components/ui/ProgressRing';

describe('ProgressRing', () => {
  it('should render an SVG with correct dimensions', () => {
    const { container } = render(<ProgressRing value={50} />);
    const svg = container.querySelector('svg');
    expect(svg).toBeDefined();
  });

  it('should show 0% progress correctly', () => {
    const { container } = render(<ProgressRing value={0} size={60} strokeWidth={4} />);
    const circle = container.querySelector('circle:nth-child(2)');
    expect(circle).toBeDefined();
  });

  it('should show 100% progress correctly', () => {
    const { container } = render(<ProgressRing value={100} size={60} strokeWidth={4} />);
    const circle = container.querySelector('circle:nth-child(2)');
    expect(circle).toBeDefined();
  });

  it('should display the value as text', () => {
    render(<ProgressRing value={75} showValue />);
    expect(screen.getByText('75%')).toBeDefined();
  });

  it('should apply success color for high values', () => {
    const { container } = render(<ProgressRing value={80} />);
    const circle = container.querySelector('circle:nth-child(2)');
    expect(circle?.getAttribute('stroke')).toBeTruthy();
  });

  it('should apply danger color for low values', () => {
    const { container } = render(<ProgressRing value={20} />);
    const circle = container.querySelector('circle:nth-child(2)');
    expect(circle?.getAttribute('stroke')).toBeTruthy();
  });

  it('should accept custom size and strokeWidth', () => {
    const { container } = render(<ProgressRing value={50} size={100} strokeWidth={8} />);
    const svg = container.querySelector('svg');
    expect(svg?.getAttribute('width')).toBe('100');
    expect(svg?.getAttribute('height')).toBe('100');
  });

  it('should accept custom className', () => {
    const { container } = render(<ProgressRing value={50} className="custom-class" />);
    expect(container.firstChild).toBeDefined();
  });
});
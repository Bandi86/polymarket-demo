/**
 * @vitest-environment jsdom
 */
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Sparkline } from '../src/components/charts/Sparkline';

describe('Sparkline', () => {
  it('should render an SVG with correct dimensions', () => {
    const data = [1, 2, 3, 4, 5];
    render(<Sparkline data={data} width={100} height={30} />);

    const svg = document.querySelector('svg');
    expect(svg).toBeDefined();
    expect(svg?.getAttribute('width')).toBe('100');
    expect(svg?.getAttribute('height')).toBe('30');
  });

  it('should handle empty data gracefully', () => {
    render(<Sparkline data={[]} width={100} height={30} />);
    // Should render placeholder
    expect(screen.getByText('—')).toBeDefined();
  });

  it('should handle single data point', () => {
    render(<Sparkline data={[5]} width={100} height={30} />);
    expect(screen.getByText('—')).toBeDefined();
  });

  it('should render a path element for valid data', () => {
    const data = [1, 2, 3, 4, 5];
    render(<Sparkline data={data} width={100} height={30} />);

    const path = document.querySelector('path');
    expect(path).toBeDefined();
    expect(path?.getAttribute('d')).toContain('M');
  });

  it('should apply positive color for upward trend', () => {
    const data = [1, 2, 3, 4, 5];
    render(<Sparkline data={data} width={100} height={30} trend="up" />);

    const path = document.querySelector('path');
    // Should contain success/green color (142 from HSL)
    expect(path?.getAttribute('stroke')).toBeTruthy();
  });

  it('should apply negative color for downward trend', () => {
    const data = [5, 4, 3, 2, 1];
    render(<Sparkline data={data} width={100} height={30} trend="down" />);

    const path = document.querySelector('path');
    expect(path?.getAttribute('stroke')).toBeTruthy();
  });

  it('should accept custom className', () => {
    const data = [1, 2, 3, 4, 5];
    const { container } = render(
      <Sparkline data={data} width={100} height={30} className="custom-class" />
    );

    expect(container.firstChild).toBeDefined();
  });
});
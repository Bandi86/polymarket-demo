/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { renderHook } from '@testing-library/react';
import { ThemeToggle, useTheme } from '../src/components/ui/ThemeToggle';

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => { store[key] = value; },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { store = {}; },
    get length() { return Object.keys(store).length; },
    key: (i: number) => Object.keys(store)[i] || null,
  };
})();

// Set globals directly
(globalThis as any).localStorage = localStorageMock;
(globalThis as any).matchMedia = () => ({
  matches: false,
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
});

describe('ThemeToggle', () => {
  beforeEach(() => {
    localStorageMock.clear();
    vi.clearAllMocks();
  });

  afterEach(() => {
    document.documentElement.classList.remove('dark');
  });

  it('should render theme toggle button', () => {
    render(<ThemeToggle />);
    expect(screen.getByRole('button')).toBeInTheDocument();
  });

  it('should cycle through themes on click', () => {
    render(<ThemeToggle />);
    const button = screen.getByRole('button');

    // Default: dark
    expect(button).toHaveAttribute('title', 'Theme: dark');

    fireEvent.click(button);
    expect(button).toHaveAttribute('title', 'Theme: light');

    fireEvent.click(button);
    expect(button).toHaveAttribute('title', 'Theme: system');

    fireEvent.click(button);
    expect(button).toHaveAttribute('title', 'Theme: dark');
  });

  it('should accept custom className', () => {
    const { container } = render(<ThemeToggle className="custom-class" />);
    expect(container.firstChild).toHaveClass('custom-class');
  });

  it('should accept size prop', () => {
    const { container } = render(<ThemeToggle size="sm" />);
    expect(container.firstChild).toBeInTheDocument();
  });
});

describe('useTheme', () => {
  beforeEach(() => {
    localStorageMock.clear();
  });

  afterEach(() => {
    document.documentElement.classList.remove('dark');
  });

  it('should return default dark theme', () => {
    const { result } = renderHook(() => useTheme());
    expect(result.current.theme).toBe('dark');
  });

  it('should read theme from localStorage', () => {
    localStorageMock.setItem('theme', 'light');
    const { result } = renderHook(() => useTheme());
    expect(result.current.theme).toBe('light');
  });

  it('should toggle theme', () => {
    const { result } = renderHook(() => useTheme());

    expect(result.current.theme).toBe('dark');

    act(() => {
      result.current.toggleTheme();
    });

    expect(result.current.theme).toBe('light');
  });

  it('should set specific theme', () => {
    const { result } = renderHook(() => useTheme());

    act(() => {
      result.current.setTheme('system');
    });

    expect(result.current.theme).toBe('system');
  });
});
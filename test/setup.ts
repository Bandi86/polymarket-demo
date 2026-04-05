import '@testing-library/jest-dom/vitest';
import { vi, afterEach } from 'vitest';

// Mock matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// Mock ResizeObserver
global.ResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));

// Cleanup after each test to prevent resource leaks
afterEach(() => {
  vi.clearAllMocks();
  vi.resetAllMocks();
});

// Cleanup all timers and intervals after tests
afterEach(() => {
  vi.clearAllTimers();
});
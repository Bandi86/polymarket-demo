import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}', 'test/**/*.test.{ts,tsx}'],
    // Clear mocks and timers between tests to prevent leaks
    clearMocks: true,
    mockReset: true,
    testTimeout: 10000,
    hookTimeout: 5000,
    environmentOptions: {
      jsdom: {
        html: '<!DOCTYPE html><html><body></body></html>',
        url: 'http://localhost',
        pretendToBeVisual: true,
      },
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});

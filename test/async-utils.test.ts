import { describe, it, expect, vi } from 'vitest';
import { withRetry, PromiseAllSettled, withConcurrency, withTimeout } from '../src/lib/utils/async-utils';

describe('withRetry', () => {
  it('should return result on first success', async () => {
    const fn = vi.fn().mockResolvedValue('success');
    const result = await withRetry(fn);
    expect(result).toBe('success');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('should retry on failure and succeed', async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce(new Error('fail 1'))
      .mockRejectedValueOnce(new Error('fail 2'))
      .mockResolvedValue('success');

    // Use short delay for fast test
    const result = await withRetry(fn, 3, 10);
    expect(result).toBe('success');
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('should throw after max retries', async () => {
    const error = new Error('always fails');
    const fn = vi.fn().mockRejectedValue(error);

    await expect(withRetry(fn, 2, 10)).rejects.toThrow('always fails');
    expect(fn).toHaveBeenCalledTimes(3); // Initial + 2 retries
  });

  it('should work with default parameters', async () => {
    const fn = vi.fn().mockResolvedValue(42);
    const result = await withRetry(fn);
    expect(result).toBe(42);
  });

  it('should handle non-Error rejections', async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce('string error')
      .mockResolvedValue('success');

    const result = await withRetry(fn, 2, 10);
    expect(result).toBe('success');
  });
});

describe('PromiseAllSettled', () => {
  it('should return all successful results', async () => {
    const promises = [
      () => Promise.resolve(1),
      () => Promise.resolve(2),
      () => Promise.resolve(3),
    ];

    const results = await PromiseAllSettled(promises);
    expect(results).toEqual([1, 2, 3]);
  });

  it('should filter out rejected promises', async () => {
    const promises = [
      () => Promise.resolve(1),
      () => Promise.reject(new Error('fail')),
      () => Promise.resolve(3),
    ];

    const results = await PromiseAllSettled(promises);
    expect(results).toEqual([1, 3]);
  });

  it('should return empty array when all fail', async () => {
    const promises = [
      () => Promise.reject(new Error('fail 1')),
      () => Promise.reject(new Error('fail 2')),
    ];

    const results = await PromiseAllSettled(promises);
    expect(results).toEqual([]);
  });

  it('should handle empty input', async () => {
    const results = await PromiseAllSettled([]);
    expect(results).toEqual([]);
  });

  it('should work with different types', async () => {
    const promises = [
      () => Promise.resolve('string'),
      () => Promise.resolve(42),
      () => Promise.resolve({ key: 'value' }),
    ];

    const results = await PromiseAllSettled(promises);
    expect(results).toEqual(['string', 42, { key: 'value' }]);
  });
});

describe('withConcurrency', () => {
  it('should process all items', async () => {
    const items = [1, 2, 3, 4, 5];
    const fn = vi.fn().mockImplementation((item: number) =>
      Promise.resolve(item * 2)
    );

    const results = await withConcurrency(items, fn, 2);
    expect(results).toEqual(expect.arrayContaining([2, 4, 6, 8, 10]));
    expect(fn).toHaveBeenCalledTimes(5);
  });

  it('should handle empty input', async () => {
    const fn = vi.fn();
    const results = await withConcurrency([], fn, 5);
    expect(results).toEqual([]);
    expect(fn).not.toHaveBeenCalled();
  });

  it('should use default concurrency of 5', async () => {
    const items = Array(10).fill(0);
    const fn = vi.fn().mockResolvedValue('done');

    await withConcurrency(items, fn);
    expect(fn).toHaveBeenCalledTimes(10);
  });

  it('should process items even with concurrency of 1', async () => {
    const items = [1, 2, 3];
    const fn = vi.fn().mockImplementation((item: number) =>
      Promise.resolve(item * 2)
    );

    const results = await withConcurrency(items, fn, 1);
    expect(results).toEqual([2, 4, 6]);
  });
});

describe('withTimeout', () => {
  it('should return result if completes before timeout', async () => {
    const fn = vi.fn().mockResolvedValue('success');
    const result = await withTimeout(fn, 1000);
    expect(result).toBe('success');
  });

  it('should throw on timeout', async () => {
    const fn = vi.fn().mockImplementation(() =>
      new Promise(resolve => setTimeout(resolve, 500))
    );

    await expect(withTimeout(fn, 50)).rejects.toThrow('timed out after 50ms');
  });

  it('should propagate error from function', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('custom error'));

    await expect(withTimeout(fn, 1000)).rejects.toThrow('custom error');
  });

  it('should work with long timeout', async () => {
    const fn = vi.fn().mockResolvedValue('result');
    const result = await withTimeout(fn, 10000);
    expect(result).toBe('result');
  });
});

describe('Integration Tests', () => {
  it('should combine retry with success', async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce(new Error('fail'))
      .mockResolvedValue('success');

    const result = await withRetry(fn, 2, 10);
    expect(result).toBe('success');
  });

  it('should use PromiseAllSettled with concurrent operations', async () => {
    const operations = [
      () => Promise.resolve(1),
      () => Promise.reject(new Error('fail')),
      () => Promise.resolve(3),
      () => Promise.reject(new Error('fail 2')),
      () => Promise.resolve(5),
    ];

    const results = await PromiseAllSettled(operations);
    expect(results).toEqual([1, 3, 5]);
  });

  it('should handle timeout with retry', async () => {
    const fn = vi.fn()
      .mockImplementation(() => new Promise(resolve => setTimeout(resolve, 100)));

    // This should timeout since function takes 100ms but timeout is 10ms
    await expect(withTimeout(() => fn(), 10)).rejects.toThrow('timed out');
  });
});
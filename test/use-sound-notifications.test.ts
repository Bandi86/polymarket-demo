/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useSoundNotifications } from '../src/hooks/useSoundNotifications';

// Mock Audio constructor
const mockAudioPlay = vi.fn(() => Promise.resolve());
vi.stubGlobal('Audio', vi.fn(() => ({
  play: mockAudioPlay,
  volume: 0.5,
})));

describe('useSoundNotifications', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should be enabled by default', () => {
    const { result } = renderHook(() => useSoundNotifications());
    expect(result.current.enabled).toBe(true);
  });

  it('should respect initial config', () => {
    const { result } = renderHook(() => useSoundNotifications({ enabled: false, volume: 0.3 }));
    expect(result.current.enabled).toBe(false);
    expect(result.current.volume).toBe(0.3);
  });

  it('should toggle enabled state', () => {
    const { result } = renderHook(() => useSoundNotifications());

    expect(result.current.enabled).toBe(true);

    act(() => {
      result.current.toggleEnabled();
    });

    expect(result.current.enabled).toBe(false);
  });

  it('should set volume with clamping', () => {
    const { result } = renderHook(() => useSoundNotifications());

    act(() => {
      result.current.setVolume(0.8);
    });
    expect(result.current.volume).toBe(0.8);

    // Test upper clamp
    act(() => {
      result.current.setVolume(1.5);
    });
    expect(result.current.volume).toBe(1);

    // Test lower clamp
    act(() => {
      result.current.setVolume(-0.5);
    });
    expect(result.current.volume).toBe(0);
  });

  it('should not play sound when disabled', () => {
    const { result } = renderHook(() => useSoundNotifications({ enabled: false, volume: 0.5 }));

    act(() => {
      result.current.playSound('trade');
    });

    expect(mockAudioPlay).not.toHaveBeenCalled();
  });

  it('should play sound when enabled', () => {
    const { result } = renderHook(() => useSoundNotifications({ enabled: true, volume: 0.5 }));

    act(() => {
      result.current.playSound('trade');
    });

    expect(mockAudioPlay).toHaveBeenCalled();
  });

  it('should provide convenience methods', () => {
    const { result } = renderHook(() => useSoundNotifications());

    expect(typeof result.current.playTrade).toBe('function');
    expect(typeof result.current.playWin).toBe('function');
    expect(typeof result.current.playLoss).toBe('function');
    expect(typeof result.current.playError).toBe('function');
    expect(typeof result.current.playNotification).toBe('function');
  });
});
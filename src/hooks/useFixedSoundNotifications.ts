/**
 * Fixed Sound System - Robust audio with fallback
 */
import { useCallback, useRef, useEffect, useState } from 'react';

type SoundType = 'trade' | 'win' | 'win-big' | 'loss' | 'error' | 'notification';

interface SoundConfig {
  enabled: boolean;
  volume: number;
}

// Synthesized sounds using Web Audio API - no external files needed
class SynthSoundManager {
  private audioContext: AudioContext | null = null;
  private enabled = true;
  private volume = 0.5;
  private initialized = false;

  init(): void {
    if (this.initialized) return;

    try {
      this.audioContext = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      this.initialized = true;
    } catch (e) {
      console.warn('[Sound] Web Audio API not available:', e);
    }
  }

  setEnabled(value: boolean): void {
    this.enabled = value;
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  setVolume(value: number): void {
    this.volume = Math.max(0, Math.min(1, value));
  }

  getVolume(): number {
    return this.volume;
  }

  private getContext(): AudioContext | null {
    if (!this.audioContext) {
      this.init();
    }
    return this.audioContext;
  }

  playTone(frequency: number, duration: number, type: OscillatorType = 'sine'): void {
    if (!this.enabled) return;

    const ctx = this.getContext();
    if (!ctx) return;

    // Resume context if suspended (browser autoplay policy)
    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }

    try {
      const oscillator = ctx.createOscillator();
      const gainNode = ctx.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(ctx.destination);

      oscillator.frequency.value = frequency;
      oscillator.type = type;

      // Envelope for smoother sound
      const now = ctx.currentTime;
      gainNode.gain.setValueAtTime(0, now);
      gainNode.gain.linearRampToValueAtTime(this.volume * 0.3, now + 0.01);
      gainNode.gain.exponentialRampToValueAtTime(0.001, now + duration);

      oscillator.start(now);
      oscillator.stop(now + duration);
    } catch (e) {
      console.warn('[Sound] Error playing tone:', e);
    }
  }

  playTrade(): void {
    // Quick double beep for trade
    this.playTone(660, 0.08);
    setTimeout(() => this.playTone(880, 0.08), 100);
  }

  playWin(): void {
    // Ascending happy tone
    this.playTone(523, 0.1);
    setTimeout(() => this.playTone(659, 0.1), 100);
    setTimeout(() => this.playTone(784, 0.15), 200);
  }

  playWinBig(): void {
    // Celebration - longer ascending
    this.playTone(523, 0.12);
    setTimeout(() => this.playTone(659, 0.12), 120);
    setTimeout(() => this.playTone(784, 0.12), 240);
    setTimeout(() => this.playTone(1047, 0.2), 360);
  }

  playLoss(): void {
    // Descending sad tone
    this.playTone(440, 0.15);
    setTimeout(() => this.playTone(330, 0.2), 150);
  }

  playError(): void {
    // Low warning buzz
    this.playTone(150, 0.3, 'square');
  }

  playNotification(): void {
    // Soft notification ping
    this.playTone(880, 0.08);
  }

  playStreakGood(): void {
    // Fire/succession sound
    this.playTone(784, 0.1);
    setTimeout(() => this.playTone(880, 0.1), 100);
    setTimeout(() => this.playTone(1047, 0.15), 200);
  }

  playStreakBad(): void {
    // Warning for bad streak
    this.playTone(330, 0.15);
    setTimeout(() => this.playTone(262, 0.2), 150);
  }

  playSessionEnd(positive: boolean): void {
    if (positive) {
      this.playWinBig();
    } else {
      this.playLoss();
    }
  }
}

// Singleton instance
const soundManager = new SynthSoundManager();

export function useFixedSoundNotifications(initialConfig?: SoundConfig) {
  const hasInteractedRef = useRef(false);
  const [enabled, setEnabledState] = useState(initialConfig?.enabled ?? true);
  const [volume, setVolumeState] = useState(initialConfig?.volume ?? 0.5);

  // Initialize on first user interaction
  useEffect(() => {
    const handleInteraction = () => {
      soundManager.init();
      hasInteractedRef.current = true;
    };

    document.addEventListener('click', handleInteraction, { once: true });
    document.addEventListener('keydown', handleInteraction, { once: true });

    return () => {
      document.removeEventListener('click', handleInteraction);
      document.removeEventListener('keydown', handleInteraction);
    };
  }, []);

  const playSound = useCallback((type: SoundType) => {
    if (!hasInteractedRef.current) {
      soundManager.init(); // Try anyway
    }

    switch (type) {
      case 'trade':
        soundManager.playTrade();
        break;
      case 'win':
        soundManager.playWin();
        break;
      case 'win-big':
        soundManager.playWinBig();
        break;
      case 'loss':
        soundManager.playLoss();
        break;
      case 'error':
        soundManager.playError();
        break;
      case 'notification':
        soundManager.playNotification();
        break;
    }
  }, []);

  const playTrade = useCallback(() => playSound('trade'), [playSound]);
  const playWin = useCallback(() => playSound('win'), [playSound]);
  const playWinBig = useCallback(() => playSound('win-big'), [playSound]);
  const playLoss = useCallback(() => playSound('loss'), [playSound]);
  const playError = useCallback(() => playSound('error'), [playSound]);
  const playNotification = useCallback(() => playSound('notification'), [playSound]);

  const toggleEnabled = useCallback(() => {
    const newEnabled = !enabled;
    setEnabledState(newEnabled);
    soundManager.setEnabled(newEnabled);
  }, [enabled]);

  const setVolume = useCallback((newVolume: number) => {
    const v = Math.max(0, Math.min(1, newVolume));
    setVolumeState(v);
    soundManager.setVolume(v);
  }, []);

  return {
    enabled,
    volume,
    playSound,
    playTrade,
    playWin,
    playWinBig,
    playLoss,
    playError,
    playNotification,
    toggleEnabled,
    setVolume,
  };
}

// Export for direct use without hook
export const fixedSoundManager = soundManager;
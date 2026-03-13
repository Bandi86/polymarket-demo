import { useState, useCallback, useRef } from 'react';

type SoundType = 'trade' | 'win' | 'loss' | 'error' | 'notification';

interface SoundConfig {
  enabled: boolean;
  volume: number;
}

// Sound URLs (using data URIs for simple sounds)
const SOUNDS: Record<SoundType, string> = {
  trade: 'data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdH2Onp2Xkol9bGVmbHF7hI2UkI2CeG1oaHF6gYSOi4x/gXZramVsdXyBhYqJiX94cG1qbHh8goSGhYN8d3FwcHR6fYGDg4KBfHl0c3V4en2AgYGBgH17enl6e3x9f4CAgH9+fXx7e3t8fX5/f39/fn19fHx8fH19fn9/f39+fn19fHx8fX1+fn5+fn5+fX19fX19fX1+fn5+fn5+fn5+fn5+fn5+',
  win: 'data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdH2Onp2XkYqAbGVmbHF7hI2UkI2CeG1oaXF6gYSOi4t/gXZramVsdXyBhYqJiX94cG1qbHh8goSGhYN8d3FwcHR6fYGDg4KBfHl0c3V4en2AgYGBgH17enl6e3x9f4CAgH9+fXx7e3t8fX5/f39/fn19fHx8fH19fn9/f39+fn19fHx8fX1+fn5+fn5+fX19fX19fX1+fn5+fn5+fn5+fn5+fn5+',
  loss: 'data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAABhYqFbF1fdH2Onp2Xkol9bGVmbHF7hI2UkI2CeG1oaHF6gYSOi4x/gXZramVsdXyBhYqJiX94cG1qbHh8goSGhYN8d3FwcHR6fYGDg4KBfHl0c3V4en2AgYGBgH17enl6e3x9f4CAgH9+fXx7e3t8fX5/f39/fn19fHx8fH19fn9/f39+fn19fHx8fX1+fn5+fn5+fX19fX19fX1+fn5+fn5+fn5+fn5+fn5+',
  error: 'data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAAA=',
  notification: 'data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdH2Onp2Xkol9bGVmbHF7hI2UkI2CeG1oaHF6gYSOi4x/gXZramVsdXyBhYqJiX94cG1qbHh8goSGhYN8d3FwcHR6fYGDg4KBfHl0c3V4en2AgYGBgH17enl6e3x9f4CAgH9+fXx7e3t8fX5/f39/fn19fHx8fH19fn9/f39+fn19fHx8fX1+fn5+fn5+fX19fX19fX1+fn5+fn5+fn5+fn5+fn5+',
};

export function useSoundNotifications(initialConfig?: SoundConfig) {
  const [config, setConfig] = useState<SoundConfig>({
    enabled: initialConfig?.enabled ?? true,
    volume: initialConfig?.volume ?? 0.5,
  });
  const audioContextRef = useRef<AudioContext | null>(null);

  const getAudioContext = useCallback(() => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    }
    return audioContextRef.current;
  }, []);

  const playSound = useCallback((type: SoundType) => {
    if (!config.enabled) return;

    try {
      const audio = new Audio(SOUNDS[type]);
      audio.volume = config.volume;
      audio.play().catch(() => {
        // Ignore autoplay errors
      });
    } catch {
      // Fallback: use Web Audio API for simple beep
      try {
        const ctx = getAudioContext();
        const oscillator = ctx.createOscillator();
        const gainNode = ctx.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(ctx.destination);

        oscillator.frequency.value = type === 'win' ? 880 : type === 'loss' ? 220 : 440;
        oscillator.type = 'sine';
        gainNode.gain.value = config.volume * 0.3;

        oscillator.start();
        oscillator.stop(ctx.currentTime + 0.1);
      } catch {
        // Silent fail
      }
    }
  }, [config.enabled, config.volume, getAudioContext]);

  const playTrade = useCallback(() => playSound('trade'), [playSound]);
  const playWin = useCallback(() => playSound('win'), [playSound]);
  const playLoss = useCallback(() => playSound('loss'), [playSound]);
  const playError = useCallback(() => playSound('error'), [playSound]);
  const playNotification = useCallback(() => playSound('notification'), [playSound]);

  const toggleEnabled = useCallback(() => {
    setConfig(prev => ({ ...prev, enabled: !prev.enabled }));
  }, []);

  const setVolume = useCallback((volume: number) => {
    setConfig(prev => ({ ...prev, volume: Math.max(0, Math.min(1, volume)) }));
  }, []);

  return {
    enabled: config.enabled,
    volume: config.volume,
    playSound,
    playTrade,
    playWin,
    playLoss,
    playError,
    playNotification,
    toggleEnabled,
    setVolume,
  };
}
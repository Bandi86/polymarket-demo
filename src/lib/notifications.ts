/**
 * Enhanced Notification System
 * Centralized notification management with queue, history, and preferences
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { toast as sonnerToast } from 'sonner';
import type { ReactNode } from 'react';

// === Types ===

export type NotificationType = 'trade' | 'settlement' | 'session_complete' | 'error' | 'warning' | 'info';

export type NotificationPriority = 'low' | 'normal' | 'high' | 'urgent';

export interface Notification {
  id: string;
  type: NotificationType;
  priority: NotificationPriority;
  title: string;
  message?: string;
  data?: Record<string, unknown>;
  timestamp: number;
  duration?: number;
  sound?: boolean;
  read: boolean;
}

export interface NotificationPreferences {
  enabled: boolean;
  tradeEnabled: boolean;
  settlementEnabled: boolean;
  sessionCompleteEnabled: boolean;
  errorEnabled: boolean;
  soundEnabled: boolean;
  volume: number;
  maxVisible: number; // Max notifications visible at once
  showHistory: boolean; // Show notification history panel
}

// === Default Preferences ===

const DEFAULT_PREFERENCES: NotificationPreferences = {
  enabled: true,
  tradeEnabled: true,
  settlementEnabled: true,
  sessionCompleteEnabled: true,
  errorEnabled: true,
  soundEnabled: true,
  volume: 0.5,
  maxVisible: 3,
  showHistory: true,
};

// === Notification Store (in-memory for now) ===

interface NotificationState {
  notifications: Notification[];
  unreadCount: number;
  preferences: NotificationPreferences;
  // Streak tracking per bot
  botStreaks: Map<string, { consecutive: number; wins: number; losses: number }>;
}

class NotificationStoreClass {
  private state: NotificationState = {
    notifications: [],
    unreadCount: 0,
    preferences: { ...DEFAULT_PREFERENCES },
    botStreaks: new Map(),
  };

  private listeners: Set<() => void> = new Set();
  private readonly MAX_HISTORY = 100;

  getBotStreak(botName: string): { consecutive: number; wins: number; losses: number } | null {
    return this.state.botStreaks.get(botName) || null;
  }

  updateBotStreak(botName: string, won: boolean): { consecutive: number; wins: number; losses: number } {
    const current = this.state.botStreaks.get(botName) || { consecutive: 0, wins: 0, losses: 0 };

    if (won) {
      current.wins++;
      current.consecutive = current.consecutive >= 0 ? current.consecutive + 1 : 1;
    } else {
      current.losses++;
      current.consecutive = current.consecutive <= 0 ? current.consecutive - 1 : -1;
    }

    this.state.botStreaks.set(botName, current);
    this.notify();
    return current;
  }

  getState(): NotificationState {
    return { ...this.state };
  }

  getPreferences(): NotificationPreferences {
    return { ...this.state.preferences };
  }

  subscribe(callback: () => void): () => void {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  setPreferences(prefs: Partial<NotificationPreferences>): void {
    this.state.preferences = { ...this.state.preferences, ...prefs };
    this.notify();
  }

  add(notification: Omit<Notification, 'id' | 'timestamp' | 'read'>): Notification {
    const newNotification: Notification = {
      ...notification,
      id: `notif-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
      read: false,
    };

    // Add to beginning (newest first)
    this.state.notifications.unshift(newNotification);
    this.state.unreadCount++;

    // Trim history
    if (this.state.notifications.length > this.MAX_HISTORY) {
      this.state.notifications = this.state.notifications.slice(0, this.MAX_HISTORY);
    }

    this.notify();
    return newNotification;
  }

  markAsRead(id: string): void {
    const notif = this.state.notifications.find(n => n.id === id);
    if (notif && !notif.read) {
      notif.read = true;
      this.state.unreadCount = Math.max(0, this.state.unreadCount - 1);
      this.notify();
    }
  }

  markAllAsRead(): void {
    this.state.notifications.forEach(n => {
      if (!n.read) {
        n.read = true;
      }
    });
    this.state.unreadCount = 0;
    this.notify();
  }

  clear(id?: string): void {
    if (id) {
      const notif = this.state.notifications.find(n => n.id === id);
      if (notif && !notif.read) {
        this.state.unreadCount--;
      }
      this.state.notifications = this.state.notifications.filter(n => n.id !== id);
    } else {
      // Clear all read
      this.state.notifications = this.state.notifications.filter(n => !n.read);
    }
    this.notify();
  }

  clearAll(): void {
    this.state.notifications = [];
    this.state.unreadCount = 0;
    this.notify();
  }

  getUnread(): Notification[] {
    return this.state.notifications.filter(n => !n.read);
  }

  getRecent(limit: number = 10): Notification[] {
    return this.state.notifications.slice(0, limit);
  }

  private notify(): void {
    this.listeners.forEach(listener => listener());
  }
}

// Singleton instance
export const notificationStore = new NotificationStoreClass();

// === Sound Manager ===

class SoundManagerClass {
  private audioContext: AudioContext | null = null;
  private enabled = true;
  private volume = 0.5;
  private audioBuffers: Map<string, AudioBuffer> = new Map();
  private audioLoaded = false;

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  setVolume(volume: number): void {
    this.volume = Math.max(0, Math.min(1, volume));
  }

  // Load audio file from public folder
  async loadSound(name: string, url: string): Promise<void> {
    if (!this.audioContext) {
      this.audioContext = new (window.AudioContext || (window as typeof window & { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    }

    try {
      const response = await fetch(url);
      const arrayBuffer = await response.arrayBuffer();
      const audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);
      this.audioBuffers.set(name, audioBuffer);
      this.audioLoaded = true;
    } catch (error) {
      console.warn(`[SoundManager] Failed to load sound "${name}":`, error);
    }
  }

  // Play a loaded sound by name
  playSound(name: string): void {
    if (!this.enabled || !this.audioContext) return;

    const buffer = this.audioBuffers.get(name);
    if (!buffer) {
      // Fallback to synthesized tone
      this.playSynthesizedTone(440, 0.1);
      return;
    }

    const source = this.audioContext.createBufferSource();
    source.buffer = buffer;
    source.connect(this.audioContext.destination);
    source.start(0);
  }

  // Synthesized tone fallback
  private playSynthesizedTone(frequency: number, duration: number): void {
    if (!this.audioContext) return;

    const ctx = this.audioContext;
    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);

    oscillator.frequency.value = frequency;
    oscillator.type = 'sine';
    gainNode.gain.value = this.volume * 0.3;

    oscillator.start();
    oscillator.stop(ctx.currentTime + duration);
  }

  // Play sound based on event context
  play(type: NotificationType, context?: { won?: boolean; pnl?: number; streak?: number }): void {
    if (!this.enabled) return;

    // Try to use loaded sounds first
    if (this.audioLoaded) {
      switch (type) {
        case 'trade':
          this.playSound('trade');
          break;
        case 'settlement':
          if (context?.won === true) {
            if (context.pnl && context.pnl >= 5) {
              this.playSound('win-big');
            } else {
              this.playSound('win');
            }
          } else if (context?.won === false) {
            this.playSound('loss');
          } else {
            this.playSound('settlement');
          }
          break;
        case 'session_complete':
          if (context?.pnl && context.pnl >= 0) {
            this.playSound('celebration');
          } else {
            this.playSound('session-end');
          }
          break;
        case 'error':
          this.playSound('error');
          break;
        case 'trade':
        case 'warning':
        case 'info':
          // Check for streak context on trade notifications
          if (context?.streak) {
            if (context.streak >= 5) {
              this.playSound('streak-good');
            } else if (context.streak <= -3) {
              this.playSound('streak-bad');
            }
          }
          this.playSynthesizedTone(440, 0.1);
          break;
      }
      return;
    }

    // Fallback to synthesized tones
    this.playSynthesized(type, context);
  }

  // Legacy synthesized tones (fallback if sounds not loaded)
  private playSynthesized(type: NotificationType, context?: { won?: boolean; pnl?: number; streak?: number }): void {
    if (!this.audioContext) {
      this.audioContext = new (window.AudioContext || (window as typeof window & { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    }

    const ctx = this.audioContext;
    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);

    let frequency = 440;
    let duration = 0.1;
    let pattern: 'single' | 'double' | 'ascending' | 'descending' = 'single';

    // Context-aware frequencies
    if (type === 'settlement') {
      if (context?.won) {
        frequency = (context.pnl ?? 0) >= 5 ? 880 : 659; // Higher for big wins
        pattern = 'ascending' as 'single' | 'double' | 'ascending' | 'descending';
        duration = 0.3;
      } else {
        frequency = 196; // Lower for losses
        pattern = 'descending' as 'single' | 'double' | 'ascending' | 'descending';
        duration = 0.25;
      }
    } else if (type === 'session_complete') {
      frequency = (context?.pnl ?? 0) >= 0 ? 523 : 261;
      pattern = (context?.pnl ?? 0) >= 0 ? 'ascending' : 'descending';
      duration = 0.4;
    } else if (type === 'trade' && context?.streak) {
      if (context.streak >= 5) {
        frequency = 880;
        pattern = 'ascending' as 'single' | 'double' | 'ascending' | 'descending';
        duration = 0.4;
      } else if (context.streak <= -3) {
        frequency = 130;
        pattern = 'descending' as 'single' | 'double' | 'ascending' | 'descending';
        duration = 0.3;
      }
    } else if (type === 'error') {
      frequency = 130;
      duration = 0.3;
      pattern = 'descending' as 'single' | 'double' | 'ascending' | 'descending';
    } else if (type === 'warning') {
      frequency = 330;
      duration = 0.15;
    } else if (type === 'info') {
      frequency = 440;
      duration = 0.08;
    }

    oscillator.frequency.value = frequency;
    oscillator.type = 'sine';
    gainNode.gain.value = this.volume * 0.3;

    // Play pattern
    const now = ctx.currentTime;
    if (pattern === 'ascending') {
      oscillator.frequency.setValueAtTime(frequency, now);
      oscillator.frequency.linearRampToValueAtTime(frequency * 2, now + duration);
    } else if (pattern === 'descending') {
      oscillator.frequency.setValueAtTime(frequency, now);
      oscillator.frequency.linearRampToValueAtTime(frequency / 2, now + duration);
    } else if (pattern === 'double') {
      oscillator.start(now);
      oscillator.stop(now + 0.1);
      const osc2 = ctx.createOscillator();
      osc2.connect(gainNode);
      osc2.frequency.value = frequency;
      osc2.start(now + 0.12);
      osc2.stop(now + 0.22);
      return;
    }

    oscillator.start();
    oscillator.stop(now + duration);
  }
}

const soundManager = new SoundManagerClass();

// Preload sounds on client side
if (typeof window !== 'undefined') {
  // Load custom sounds if available (will fail gracefully if not found)
  soundManager.loadSound('trade', '/sounds/trade.mp3').catch(() => {});
  soundManager.loadSound('win', '/sounds/win.mp3').catch(() => {});
  soundManager.loadSound('win-big', '/sounds/win-big.mp3').catch(() => {});
  soundManager.loadSound('loss', '/sounds/loss.mp3').catch(() => {});
  soundManager.loadSound('settlement', '/sounds/settlement.mp3').catch(() => {});
  soundManager.loadSound('celebration', '/sounds/celebration.mp3').catch(() => {});
  soundManager.loadSound('session-end', '/sounds/session-end.mp3').catch(() => {});
  soundManager.loadSound('streak-good', '/sounds/streak-good.mp3').catch(() => {});
  soundManager.loadSound('streak-bad', '/sounds/streak-bad.mp3').catch(() => {});
  soundManager.loadSound('error', '/sounds/error.mp3').catch(() => {});
}

// === Main Hook ===

export function useNotifications() {
  const [state, setState] = useState<NotificationState>(notificationStore.getState());

  useEffect(() => {
    const unsubscribe = notificationStore.subscribe(() => {
      setState(notificationStore.getState());
    });
    return unsubscribe;
  }, []);

  // Sync preferences to sound manager
  useEffect(() => {
    soundManager.setEnabled(state.preferences.soundEnabled);
    soundManager.setVolume(state.preferences.volume);
  }, [state.preferences.soundEnabled, state.preferences.volume]);

  const showNotification = useCallback((notification: Omit<Notification, 'id' | 'timestamp' | 'read'>) => {
    // Check if notifications are enabled
    if (!state.preferences.enabled) return;

    // Check type-specific preferences
    const typeEnabledMap: Record<NotificationType, keyof NotificationPreferences> = {
      trade: 'tradeEnabled',
      settlement: 'settlementEnabled',
      session_complete: 'sessionCompleteEnabled',
      error: 'errorEnabled',
      warning: 'tradeEnabled',
      info: 'tradeEnabled',
    };

    const prefKey = typeEnabledMap[notification.type];
    if (prefKey && !state.preferences[prefKey]) return;

    // Add to store
    const notif = notificationStore.add(notification);

    // Play sound if enabled
    if (notification.sound !== false && state.preferences.soundEnabled) {
      // Extract context for adaptive sounds
      let context: { won?: boolean; pnl?: number; streak?: number } | undefined;

      if (notification.type === 'settlement') {
        const won = notification.data?.won as boolean | undefined;
        const pnl = notification.data?.pnl as number | undefined;
        const botName = notification.data?.botName as string | undefined;

        if (won !== undefined && botName) {
          // Update streak tracking
          const streak = notificationStore.updateBotStreak(botName, won);
          context = { won, pnl, streak: streak.consecutive };
        } else if (won !== undefined) {
          context = { won, pnl };
        }
      } else if (notification.type === 'trade') {
        const botName = notification.data?.botName as string | undefined;
        if (botName) {
          const streak = notificationStore.getBotStreak(botName);
          if (streak) {
            context = { streak: streak.consecutive };
          }
        }
      }

      soundManager.play(notification.type, context);
    }

    // Show toast
    return notif;
  }, [state.preferences]);

  const showTrade = useCallback((data: { botName: string; outcome: 'YES' | 'NO'; amount: number; price: number; balance?: number; strategy?: string }) => {
    return showNotification({
      type: 'trade',
      priority: 'normal',
      title: `${data.botName} placed a trade`,
      message: `${data.outcome} $${data.amount.toFixed(2)} @ ${(data.price * 100).toFixed(1)}¢`,
      data: data as Record<string, unknown>,
      duration: 4000,
      sound: true,
    });
  }, [showNotification]);

  const showSettlement = useCallback((data: { botName: string; won: boolean; pnl: number; outcome: string; trades?: number; winRate?: number; strategy?: string }) => {
    return showNotification({
      type: 'settlement',
      priority: data.won ? 'high' : 'normal',
      title: `${data.botName} position settled`,
      message: `${data.won ? '✓ WON' : '✗ LOST'} ${data.outcome} | PnL: ${data.pnl >= 0 ? '+' : ''}$${data.pnl.toFixed(2)}`,
      data: data as Record<string, unknown>,
      duration: 5000,
      sound: true,
    });
  }, [showNotification]);

  const showSessionComplete = useCallback((data: { totalPnl: number; totalTrades: number; totalWins: number; totalLosses: number; winRate: number; duration: number; bestBot?: { name: string; pnl: number }; worstBot?: { name: string; pnl: number } }) => {
    return showNotification({
      type: 'session_complete',
      priority: 'urgent',
      title: data.totalPnl >= 0 ? '🎉 Session Profit!' : 'Session Ended',
      message: `Total PnL: ${data.totalPnl >= 0 ? '+' : ''}$${data.totalPnl.toFixed(2)} | ${(data.winRate * 100).toFixed(0)}% win rate`,
      data: data as Record<string, unknown>,
      duration: 15000,
      sound: true,
    });
  }, [showNotification]);

  const showError = useCallback((title: string, message?: string) => {
    return showNotification({
      type: 'error',
      priority: 'urgent',
      title,
      message,
      duration: 6000,
      sound: true,
    });
  }, [showNotification]);

  const showWarning = useCallback((title: string, message?: string) => {
    return showNotification({
      type: 'warning',
      priority: 'high',
      title,
      message,
      duration: 5000,
      sound: false,
    });
  }, [showNotification]);

  const showInfo = useCallback((title: string, message?: string) => {
    return showNotification({
      type: 'info',
      priority: 'low',
      title,
      message,
      duration: 3000,
      sound: false,
    });
  }, [showNotification]);

  const markAsRead = useCallback((id: string) => {
    notificationStore.markAsRead(id);
  }, []);

  const markAllAsRead = useCallback(() => {
    notificationStore.markAllAsRead();
  }, []);

  const clearNotification = useCallback((id?: string) => {
    notificationStore.clear(id);
  }, []);

  const clearAll = useCallback(() => {
    notificationStore.clearAll();
  }, []);

  const setPreferences = useCallback((prefs: Partial<NotificationPreferences>) => {
    notificationStore.setPreferences(prefs);
  }, []);

  const getBotStreak = useCallback((botName: string) => {
    return notificationStore.getBotStreak(botName);
  }, []);

  return {
    // State
    notifications: state.notifications,
    unread: state.notifications.filter(n => !n.read),
    unreadCount: state.unreadCount,
    preferences: state.preferences,

    // Actions
    showNotification,
    showTrade,
    showSettlement,
    showSessionComplete,
    showError,
    showWarning,
    showInfo,
    markAsRead,
    markAllAsRead,
    clearNotification,
    clearAll,
    setPreferences,
    getBotStreak,
  };
}

// === Legacy Compatibility ===
// Re-export toast functions for backward compatibility

export const toast = {
  success: (title: string, description?: string) =>
    sonnerToast.success(title, { description }),
  error: (title: string, description?: string) =>
    sonnerToast.error(title, { description }),
  warning: (title: string, description?: string) =>
    sonnerToast.warning(title, { description }),
  info: (title: string, description?: string) =>
    sonnerToast.info(title, { description }),
  message: (title: string, description?: string) =>
    sonnerToast(title, { description }),
  promise: <T,>(promise: Promise<T>, messages: { loading: string; success: string; error: string }) =>
    sonnerToast.promise(promise, messages),
};

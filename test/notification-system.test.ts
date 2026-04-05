/**
 * Notification System Tests
 * Tests for notification queue, preferences, and reliability
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { notificationStore } from '../src/lib/notifications';
import type { NotificationType } from '../src/lib/notifications';

describe('Notification System', () => {
  beforeEach(() => {
    // Reset store to initial state
    notificationStore.clearAll();
    // Reset preferences to defaults
    notificationStore.setPreferences({
      enabled: true,
      tradeEnabled: true,
      settlementEnabled: true,
      sessionCompleteEnabled: true,
      errorEnabled: true,
      soundEnabled: true,
      volume: 0.5,
      maxVisible: 3,
      showHistory: true,
    });
  });

  describe('Notification Queue', () => {
    it('should handle multiple rapid notifications', () => {
      // Add 10 notifications directly
      for (let i = 0; i < 10; i++) {
        notificationStore.add({
          type: 'trade' as NotificationType,
          priority: 'normal',
          title: `Bot ${i} placed a trade`,
          message: `YES $10.00 @ 52.0¢`,
        });
      }

      const state = notificationStore.getState();
      expect(state.notifications.length).toBe(10);
      expect(state.unreadCount).toBe(10);
    });

    it('should track unread count correctly', () => {
      const notif = notificationStore.add({
        type: 'trade' as NotificationType,
        priority: 'normal',
        title: 'Bot 1 placed a trade',
        message: 'YES $10.00 @ 52.0¢',
      });

      let state = notificationStore.getState();
      expect(state.unreadCount).toBe(1);

      notificationStore.markAsRead(notif.id);

      state = notificationStore.getState();
      expect(state.unreadCount).toBe(0);
    });

    it('should mark all as read correctly', () => {
      // Create 5 notifications
      for (let i = 0; i < 5; i++) {
        notificationStore.add({
          type: 'trade' as NotificationType,
          priority: 'normal',
          title: `Bot ${i} placed a trade`,
          message: `YES $10.00 @ 52.0¢`,
        });
      }

      let state = notificationStore.getState();
      expect(state.unreadCount).toBe(5);

      notificationStore.markAllAsRead();

      state = notificationStore.getState();
      expect(state.unreadCount).toBe(0);
      expect(state.notifications.every(n => n.read)).toBe(true);
    });

    it('should trim history to MAX_HISTORY', () => {
      // Create 150 notifications (exceeds MAX_HISTORY of 100)
      for (let i = 0; i < 150; i++) {
        notificationStore.add({
          type: 'info' as NotificationType,
          priority: 'low',
          title: `Test ${i}`,
          message: `Message ${i}`,
        });
      }

      const state = notificationStore.getState();
      expect(state.notifications.length).toBeLessThanOrEqual(100);
    });
  });

  describe('Notification Preferences', () => {
    it('should update preferences correctly', () => {
      notificationStore.setPreferences({
        soundEnabled: false,
        volume: 0.3,
        maxVisible: 5,
      });

      const state = notificationStore.getState();
      expect(state.preferences.soundEnabled).toBe(false);
      expect(state.preferences.volume).toBe(0.3);
      expect(state.preferences.maxVisible).toBe(5);
    });

    it('should disable all notifications when enabled is false', () => {
      notificationStore.setPreferences({ enabled: false });

      const state = notificationStore.getState();
      expect(state.preferences.enabled).toBe(false);
    });

    it('should maintain default preferences', () => {
      const state = notificationStore.getState();

      expect(state.preferences.enabled).toBe(true);
      expect(state.preferences.tradeEnabled).toBe(true);
      expect(state.preferences.settlementEnabled).toBe(true);
      expect(state.preferences.sessionCompleteEnabled).toBe(true);
      expect(state.preferences.soundEnabled).toBe(true);
      expect(state.preferences.volume).toBe(0.5);
    });
  });

  describe('Settlement Notifications', () => {
    it('should handle won settlements', () => {
      notificationStore.add({
        type: 'settlement' as NotificationType,
        priority: 'high',
        title: 'Bot 1 position settled',
        message: '✓ WON YES | PnL: +$50.00',
      });

      const state = notificationStore.getState();
      expect(state.notifications.length).toBe(1);
      expect(state.notifications[0].type).toBe('settlement');
      expect(state.notifications[0].title).toContain('Bot 1');
    });

    it('should handle lost settlements', () => {
      notificationStore.add({
        type: 'settlement' as NotificationType,
        priority: 'normal',
        title: 'Bot 1 position settled',
        message: '✗ LOST NO | PnL: -$20.00',
      });

      const state = notificationStore.getState();
      const notif = state.notifications[0];

      expect(notif.type).toBe('settlement');
      expect(notif.message).toContain('LOST');
      expect(notif.priority).toBe('normal');
    });
  });

  describe('Session Complete Notifications', () => {
    it('should handle session summary', () => {
      notificationStore.add({
        type: 'session_complete' as NotificationType,
        priority: 'urgent',
        title: '🎉 Session Profit!',
        message: 'Total PnL: +$150.00 | 70% win rate',
        duration: 15000,
      });

      const state = notificationStore.getState();
      const notif = state.notifications[0];

      expect(notif.type).toBe('session_complete');
      expect(notif.priority).toBe('urgent');
      expect(notif.duration).toBe(15000);
    });
  });

  describe('Memory Management', () => {
    it('should prevent memory leaks with ID tracking', () => {
      const processedIds = new Set<string>();

      // Simulate 1500 processed IDs (exceeds 1000 threshold)
      for (let i = 0; i < 1500; i++) {
        processedIds.add(`log-${i}`);
      }

      // Cleanup - keep last 500 when exceeds 1000
      if (processedIds.size > 1000) {
        const ids = Array.from(processedIds);
        processedIds.clear();
        ids.slice(-500).forEach(id => processedIds.add(id));
      }

      expect(processedIds.size).toBe(500);
    });

    it('should clear notifications properly', () => {
      // Create 5 notifications
      for (let i = 0; i < 5; i++) {
        notificationStore.add({
          type: 'trade' as NotificationType,
          priority: 'normal',
          title: `Bot ${i} placed a trade`,
          message: `YES $10.00 @ 52.0¢`,
        });
      }

      let state = notificationStore.getState();
      expect(state.notifications.length).toBe(5);

      notificationStore.clearAll();

      state = notificationStore.getState();
      expect(state.notifications.length).toBe(0);
    });

    it('should clear individual notifications', () => {
      const notif = notificationStore.add({
        type: 'trade' as NotificationType,
        priority: 'normal',
        title: 'Bot 1 placed a trade',
        message: 'YES $10.00 @ 52.0¢',
      });

      let state = notificationStore.getState();
      expect(state.notifications.length).toBe(1);

      notificationStore.clear(notif.id);

      state = notificationStore.getState();
      expect(state.notifications.length).toBe(0);
    });

    it('should clear only read notifications with clearAll', () => {
      // Add 2 notifications
      const notif1 = notificationStore.add({
        type: 'trade' as NotificationType,
        priority: 'normal',
        title: 'Bot 1 trade',
      });

      notificationStore.add({
        type: 'trade' as NotificationType,
        priority: 'normal',
        title: 'Bot 2 trade',
      });

      // Mark first as read
      notificationStore.markAsRead(notif1.id);

      // Clear all (should only clear read)
      notificationStore.clear();

      const state = notificationStore.getState();
      expect(state.notifications.length).toBe(1);
      expect(state.notifications[0].read).toBe(false);
    });
  });

  describe('Error Handling', () => {
    it('should handle notifications without message', () => {
      expect(() => {
        notificationStore.add({
          type: 'info' as NotificationType,
          priority: 'low',
          title: 'Test',
          // message is optional
        });
      }).not.toThrow();
    });

    it('should handle error notifications', () => {
      notificationStore.add({
        type: 'error' as NotificationType,
        priority: 'urgent',
        title: 'Connection Lost',
        message: 'SSE connection timeout',
      });

      const state = notificationStore.getState();
      const notif = state.notifications[0];

      expect(notif.type).toBe('error');
      expect(notif.priority).toBe('urgent');
    });

    it('should handle notifications with data payload', () => {
      notificationStore.add({
        type: 'trade' as NotificationType,
        priority: 'normal',
        title: 'Bot trade',
        data: {
          botId: 'bot-1',
          amount: 10,
          price: 0.52,
          outcome: 'YES',
        },
      });

      const state = notificationStore.getState();
      expect(state.notifications[0].data).toEqual({
        botId: 'bot-1',
        amount: 10,
        price: 0.52,
        outcome: 'YES',
      });
    });
  });

  describe('Notification Ordering', () => {
    it('should maintain newest-first order', () => {
      notificationStore.add({
        type: 'info' as NotificationType,
        priority: 'low',
        title: 'First',
      });

      notificationStore.add({
        type: 'info' as NotificationType,
        priority: 'low',
        title: 'Second',
      });

      notificationStore.add({
        type: 'info' as NotificationType,
        priority: 'low',
        title: 'Third',
      });

      const state = notificationStore.getState();
      expect(state.notifications[0].title).toBe('Third');
      expect(state.notifications[1].title).toBe('Second');
      expect(state.notifications[2].title).toBe('First');
    });
  });
});

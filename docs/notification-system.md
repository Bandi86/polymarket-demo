# Enhanced Notification System

## Overview

A centralized notification management system with queue, history, preferences, and sound notifications.

## Features

### 1. Notification Types
- **Trade** - Bot opened a position
- **Settlement** - Bot position closed (won/lost)
- **Session Complete** - Competition/session ended with summary
- **Error** - System errors
- **Warning** - Important warnings
- **Info** - General information

### 2. Notification Center
- Bell icon in header with unread count badge
- Collapsible panel with full notification history
- Mark as read / mark all as read functionality
- Clear individual or all notifications
- Settings panel for preferences

### 3. Preferences
Users can customize:
- Enable/disable all notifications
- Enable/disable specific types (Trade, Settlement, Session Complete)
- Enable/disable sound effects
- Max visible notifications
- Show notification history

### 4. Sound Notifications
- Different frequencies for different notification types
- Configurable volume
- Can be toggled on/off

## Architecture

### Core Files

| File | Purpose |
|------|---------|
| `src/lib/notifications.ts` | Central notification store, hook, sound manager |
| `src/components/NotificationCenter.tsx` | UI component with panel, settings, items |
| `src/components/App.tsx` | Integration with bot logs, trade events |
| `src/components/dashboard/TopDashboardHeader.tsx` | Bell icon placement |

### Store Structure

```typescript
interface Notification {
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

interface NotificationPreferences {
  enabled: boolean;
  tradeEnabled: boolean;
  settlementEnabled: boolean;
  sessionCompleteEnabled: boolean;
  soundEnabled: boolean;
  volume: number;
  maxVisible: number;
  showHistory: boolean;
}
```

## Usage

### In Components

```typescript
import { useNotifications } from '@/lib/notifications';

function MyComponent() {
  const { showTrade, showSettlement, showError } = useNotifications();
  
  // Show trade notification
  showTrade({
    botName: 'Bot 1',
    outcome: 'YES',
    amount: 10,
    price: 0.52,
    balance: 100,
    strategy: 'momentum'
  });
}
```

### Processing Bot Logs

```typescript
// Track processed log IDs to avoid duplicates
const processedLogIds = useRef<Set<string>>(new Set());

useEffect(() => {
  if (!isBotRunning || botLogs.length === 0) return;
  
  const newLogs = botLogs.filter(log => !processedLogIds.current.has(log.id));
  newLogs.forEach(log => {
    processedLogIds.current.add(log.id);
    
    if (log.type === 'TRADE') {
      showTrade({ ... });
    } else if (log.type === 'SETTLED') {
      showSettlement({ ... });
    }
  });
  
  // Memory cleanup - keep last 500 IDs
  if (processedLogIds.current.size > 1000) {
    const ids = Array.from(processedLogIds.current);
    processedLogIds.current = new Set(ids.slice(-500));
  }
}, [botLogs, isBotRunning]);
```

## Improvements Over Previous System

### Before
- Single log ID tracking (missed rapid notifications)
- No notification history
- No preferences/settings
- Toast-only display
- No sound management
- No unread/read tracking

### After
- Set-based log tracking (handles all rapid notifications)
- Full history (up to 100 notifications)
- Customizable preferences per type
- Dual display (toast + notification center)
- Sound manager with Web Audio API
- Read/unread status with batch operations
- Memory cleanup to prevent leaks

## Testing

Run frontend performance tests:

```bash
bun run test:run test/frontend-performance.test.ts
```

Tests cover:
- Store update latency
- Rapid update handling
- SSE message parsing
- Memory cleanup

## API Endpoints

| Endpoint | Purpose |
|----------|---------|
| `GET /api/debug/sse-health` | SSE connection health metrics |

## Troubleshooting

### Notifications not appearing
1. Check bell icon for unread count
2. Open notification center panel
3. Verify preferences enable the notification type
4. Check browser console for errors

### Sound not playing
1. Check sound toggle in header
2. Verify volume preference in settings
3. Ensure browser allows audio playback

### Too many notifications
1. Open notification center settings
2. Adjust `maxVisible` preference
3. Use "Clear all" to reset

## Future Improvements

- [ ] Push notifications for desktop/mobile
- [ ] Notification grouping (e.g., "5 trades in last minute")
- [ ] Export notification history
- [ ] Search/filter notifications
- [ ] Notification analytics dashboard

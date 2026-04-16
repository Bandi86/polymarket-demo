# Polymarket Live Trading Integration - Design Spec

**Date:** 2026-04-16  
**Topic:** Live Polymarket balance & trading fix

## Goal

Fix the live Polymarket integration so that:
1. Real account balance loads correctly from Polymarket API
2. Positions display correctly
3. Orders can be placed with real money when bots run in live mode

## Architecture

```
Frontend → Next.js API Routes → @polymarket/clob-client → Polymarket CLOB API
```

## Changes

### 1. New Dependency
```bash
bun add @polymarket/clob-client
```

### 2. New Client Module (`src/lib/providers/clob-client.ts`)
- Initialize ClobClient with private key from .env
- Use `createOrDeriveApiKey()` to get/derive API credentials
- Methods:
  - `getBalance()` - USDC balance
  - `getPositions()` - open positions
  - `getTrades()` - trade history
  - `placeOrder()` - create and post order

### 3. Environment Variables (already in .env)
```
POLYMARKET_API_KEY=dda94fb3-c3a7-4bcb-0af8-b46e7751f838
POLYMARKET_API_SECRET=TDTPy2618WotYw14pd_vF1e03qRl7G3ylYNZAKAR63w=
POLYMARKET_API_PASSPHRASE=5579f442d9746ead368345e0bd0bf9090212c926c8338bd8ed1df40fb3954b3e
POLYMARKET_PRIVATE_KEY=0xb5d9547d8f7f0401199fbbe33a2e0cf69b8af19530273a1204bd4ff8cd76634c
```

### 4. API Routes Update
- `app/api/account/balance/route.ts` - use new clob-client
- `app/api/orders/positions/route.ts` - use new clob-client
- `app/api/orders/place/route.ts` - use new clob-client

### 5. Bot Manager Integration
- Live mode: use real `placeOrder()` from clob-client
- Demo mode: use existing simulated trading

## Testing Plan

1. **Balance test**: Load balance from real Polymarket account
2. **Positions test**: Display real open positions
3. **Order test**: Place small test order (optional, with small amount)

## Implementation Steps

1. Install @polymarket/clob-client
2. Create clob-client.ts provider
3. Update balance API route
4. Update positions API route
5. Update orders API route
6. Test with real credentials

# 🤖 Bot Fejlesztési & Optimalizálási Terv — 2026-04-09

> **Cél**: A 16 bot részletes elemzése a historikus adatok alapján — melyik jó, melyik rossz, és pontosan hogyan lehetne mindegyiket jövedelmezőbbé tenni.

---

## 📊 Összesített Teljesítmény

| Metrika | Érték |
|---|---|
| **Összes bot** | 16 |
| **Aktív trade-elő bot** | 13 (3 bot 0 trade-del) |
| **Összes trade** | 103 |
| **Összes PnL** | **-$19.98** |
| **Átlagos drawdown** | 29.4% |
| **Nyereséges bot** | 2 / 16 (12.5%) |
| **Break-even/nem trade-elt** | 3 / 16 |
| **Veszteséges bot** | 11 / 16 |

> [!CAUTION]
> A 16 botból **csak 2 nyereséges**, a rendszer összesített PnL-je **-$19.98**. Ez kritikus állapot — a legtöbb stratégia veszteséget termel, nem profitot.

---

## 🏆 Bot Rangsor — Teljesítmény Alapján

### Tier S — 🟢 Nyereséges (2 bot)

| Bot | Stratégia | Trades | Wins | W/L | Win Rate | PnL | Drawdown | Sharpe |
|-----|-----------|--------|------|-----|----------|-----|----------|--------|
| **Binance Velocity** | `binance_velocity` | 9 | 7 | 7/2 | **77.8%** | **+$0.43** | 16.7% | 0.11 |
| **Trend Pullback** | `trend_pullback` | 7 | 5 | 5/2 | **71.4%** | **+$0.30** | 21.0% | 0.06 |

### Tier A — 🟡 Közel break-even (3 bot, moderált veszteség)

| Bot | Stratégia | Trades | Wins | W/L | Win Rate | PnL | Drawdown | Sharpe |
|-----|-----------|--------|------|-----|----------|-----|----------|--------|
| T-10 Sniper | `last_seconds_scalp` | 8 | 6 | 6/2 | 75.0% | -$0.86 | 15.9% | -0.19 |
| Window Delta | `window_delta` | 8 | 5 | 5/3 | 62.5% | -$0.96 | 23.9% | -0.17 |
| Contrarian | `contrarian` | 8 | 5 | 5/3 | 62.5% | -$1.10 | 24.5% | -0.20 |

### Tier B — 🟠 Veszteséges, de javítható (5 bot)

| Bot | Stratégia | Trades | Wins | W/L | Win Rate | PnL | Drawdown | Sharpe |
|-----|-----------|--------|------|-----|----------|-----|----------|--------|
| Binance Signal | `binance_signal` | 8 | 5 | 5/3 | 62.5% | -$1.14 | 24.5% | -0.21 |
| Fair Value | `fair_value` | 9 | 4 | 4/5 | 44.4% | -$1.40 | 38.0% | -0.16 |
| Momentum | `momentum` | 7 | 3 | 3/4 | 42.9% | -$1.51 | 27.4% | -0.22 |
| Volatility Breakout | `volatility_breakout` | 10 | 6 | 6/4 | 60.0% | -$1.76 | 19.6% | -0.31 |
| Smart Trend | `smart_trend` | 6 | 3 | 3/3 | 50.0% | -$1.78 | 29.5% | -0.41 |

### Tier C — 🔴 Kritikus veszteség (3 bot)

| Bot | Stratégia | Trades | Wins | W/L | Win Rate | PnL | Drawdown | Sharpe |
|-----|-----------|--------|------|-----|----------|-----|----------|--------|
| Ultra Low Entry | `ultra_low_entry` | 6 | 1 | 1/5 | 16.7% | -$1.81 | 23.2% | -0.37 |
| Monte Carlo | `monte_carlo` | 8 | 2 | 2/6 | 25.0% | -$3.75 | **51.3%** | -0.44 |
| Arbitrage | `arbitrage` | 9 | 2 | 2/7 | 22.2% | **-$4.64** | **67.4%** | -0.49 |

### Tier D — ⚫ Nem trade-elt (3 bot)

| Bot | Stratégia | Trades | PnL | Probléma |
|-----|-----------|--------|-----|----------|
| Sniper Value | `sniper_value` | 0 | $0.00 | Túl szigorú szűrők — sosem lép be |
| Price Reversion | `price_reversion` | 0 | $0.00 | Túl szűk zóna (10-20¢ / 80-90¢) |
| Odds Swing | `odds_swing` | 0 | $0.00 | Reversal evidence ritkán teljesül |

---

## 🔍 Részletes Elemzés Bot-onként

### 🟢 TIER S — Nyereséges botok

---

#### 1. Binance Velocity 🏆 — Legjobb bot

**PnL: +$0.43 | Win Rate: 77.8% | Sharpe: 0.11**

**Miért működik jól:**
- Velocity + Acceleration kettős szűrő → magas minőségű jelek
- Volatilitás filter (`btcVolatility > 0.003` → skip) → kerüli a kiszámíthatatlan piacot
- Alacsonyabb bázis konfidencia (0.55) → kisebb tétek veszteségnél
- Deceleráció detektálás → nem lép be fading momentum-ban

**Fejlesztési javaslatok:**
1. ✅ **Megtartani a jelenlegi logikát** — jól működik
2. 📈 **Interval csökkentése**: 800ms → 500ms — gyorsabb reakció
3. 📈 **Kelly fraction emelése**: 0.35 → 0.40 — nyereséges bot, nagyobb méret
4. 📈 **MaxBet emelése**: 25% → 30% — trusted strategy, nagyobb pozíciók
5. 🆕 **Kline history depth**: Több historikus kline adat (10 → 20) a trend erősségéhez
6. 🆕 **Volume confirmation**: Binance volume adatok integrálása — magas volume = megbízhatóbb signal

**Fájlok:**
- `src/lib/strategies/strategies/binance-velocity.ts`
- `src/lib/strategies/config.ts` (paraméterek)

---

#### 2. Trend Pullback ✅ — Második legjobb

**PnL: +$0.30 | Win Rate: 71.4% | Sharpe: 0.06**

**Miért működik jól:**
- BTC delta vs Polymarket ár lag → valódi edge
- Pullback bonus (+0.07 confidence ha az ár dip-el de BTC erős)
- Jól kalibrált threshold (0.03% BTC delta minimum)
- Széles zóna (YES ≤ 68¢) → nem túl restriktív

**Fejlesztési javaslatok:**
1. ✅ **Megtartani az alap logikát**
2. 📈 **Interval csökkentése**: 1200ms → 800ms — gyorsabb
3. 📈 **Discount factor erősítése**: `discount * 1.5` → `discount * 2.0` — nagyobb confidence olcsóbb áron
4. 🐛 **Velocity cap javítása**: `priceVelocity <= 0.003` → `0.005` — túl szigorú jelenleg, sok jó setup-ot blokkol
5. 🆕 **Multi-timeframe confirmation**: Binance signal hozzáadás extra megerősítésként
6. 🆕 **Dynamic delta threshold**: Volatilis piacon magasabb küszöb (0.03% → 0.05%), csendes piacon alacsonyabb (0.02%)

**Fájlok:**
- `src/lib/strategies/strategies/trend-pullback.ts`

---

### 🟡 TIER A — Majdnem nyereséges (kis módosításokkal profitba fordíthatók)

---

#### 3. T-10 Sniper — 75% win rate, mégis veszteséges!

**PnL: -$0.86 | Win Rate: 75.0% | Sharpe: -0.19**

> [!WARNING]
> **Klasszikus Risk/Reward probléma**: 75%-os win rate mellett veszteséges → az átlagos veszteség JÓVAL nagyobb, mint az átlagos nyereség.

**Gyökérok:**
- `minDelta: 0.01` (1%) — **túl alacsony!** Sok hamis jelet generál
- A vesztes trade-ek nagyobb összegűek, mert Kelly a stratégia konfidenciája alapján méretez
- 4-30 másodperces ablakban kereskedik → nagyon rövid időn belül kell hogy igazolódjon

**Javítási terv:**
1. 🐛 **KRITIKUS: minDelta emelése**: 0.01 → 0.04 (4×) — drasztikusan kevesebb, de jobb trade
2. 🐛 **Max confidence csökkentése**: 0.85 → 0.70 — kisebb tétek → kisebb veszteségek
3. 📈 **Lottery zone penalty erősítése**: `confidence *= 0.70` → `0.50` (yesPrice < 25¢)
4. 📈 **High price penalty erősítése**: `confidence *= 0.85` → `0.75` (yesPrice > 80¢)
5. 🆕 **Take profit/stop loss aktiválása**: TP: +15% / SL: -20% — cut losses earlier

**Becsült hatás**: Win rate marad ~75%, de PnL +$0.50 — +$1.50 mert a veszteségek kisebbek lesznek.

**Fájl:** `src/lib/strategies/strategies/t10-sniper.ts`

---

#### 4. Window Delta — Történelmileg a legjobb, de most veszteséges

**PnL: -$0.96 | Win Rate: 62.5% | Sharpe: -0.17**

**Gyökérok:**
- `betSize: 1.5` + `maxBet: 0.30` — **túl agresszív méretezés!** (A legnagyobb méretű bot)
- `minDelta: 0.05` — jó küszöb, de a bet size kompenzálja túlságosan
- 62.5% win rate-nél a nagy veszteségek elnyelik a kis nyereségeket

**Javítási terv:**
1. 🐛 **KRITIKUS: betSize csökkentése**: 1.5 → 1.0 — konzervatívabb méret
2. 🐛 **maxBet csökkentése**: 0.30 → 0.20 — max 20% bankroll/trade
3. 📈 **Dinamikus delta küszöb**: Volatilis piacon: 0.08%, csendes piacon: 0.04%
4. 📈 **Konfidencia finomhangolás**: "Erős" jelzésnél (2× delta) max 0.85 (nem 0.92)
5. 🆕 **Binance signal megerősítés**: Csak trade-elni ha Binance signal + delta megegyezik

**Becsült hatás**: Win rate marad, de PnL → +$0.30 — +$0.80 a kisebb veszteségek miatt.

**Fájl:** `src/lib/strategies/strategies/window-delta.ts`

---

#### 5. Contrarian — Misleading név, valójában BTC follower

**PnL: -$1.10 | Win Rate: 62.5% | Sharpe: -0.20**

**Gyökérok:**
- A név "contrarian" de igazából BTC delta follow-er → **duplikálja** a Window Delta logikát
- `minDelta: 0.05` — azonos a Window Delta-val!
- Nincs valódi "contrarian" edge — csak a BTC irányát követi

**Javítási terv (2 opció):**

**Opció A — Átátalakítani igazi contrarian-ná:**
1. 🔄 **Logika megfordítás**: Kereskedés ELLEN a piaci consensussal
2. 🆕 **Overbought/Oversold detection**: Ha YES > 75¢ de BTC delta < 0 → NO (contrarian)
3. 🆕 **Sentiment fade**: Ha a piac "túlreagálta" a BTC mozgást → ellentétes pozíció

**Opció B — Összevonni a Window Delta-val:**
1. 🗑️ **Eltávolítás** mint önálló bot
2. 📈 Window Delta-ba integrálni az extra logikát

> [!IMPORTANT]
> **Javasolt: Opció A** — Igazi contrarian bot hozzáadott értéket képvisel a portfólióban (diverzifikáció).

**Fájl:** `src/lib/strategies/strategies/contrarian.ts`

---

### 🟠 TIER B — Veszteséges, de javítható

---

#### 6. Binance Signal (Oracle Lag) — Duplikáció probléma

**PnL: -$1.14 | Win Rate: 62.5% | Sharpe: -0.21**

**Gyökérok:**
- A "fallback" mód (`deltaPct > 0.02`) → **de facto Window Delta klón** amikor nincs friss signal
- Signal freshness (8s max age) → néha nincs valid signal, és a fallback mindig fut
- `betSize: 0.5` + `useKelly: false` → konzervatív méretezés megment a nagy veszteségtől, de a fallback húzza le

**Javítási terv:**
1. 🐛 **Fallback letiltása**: Ne trade-eljen ha nincs friss Binance signal → eliminálni a duplikált delta-trade-eket
2. 📈 **Signal age csökkentése**: 8000ms → 5000ms — frissebb signal = jobb minőség
3. 📈 **Minimum signal confidence emelése**: 0.45 → 0.55
4. 🆕 **Signal + delta korreláció**: Csak trade ha signal ÉS delta megegyezik (jelenleg a signal alone is elég)
5. 🆕 **Kelly bekapcsolása** (`useKelly: true`) — a bot elég konzervatív, Kelly javítaná a bet sizing-et

**Fájl:** `src/lib/strategies/strategies/oracle-lag.ts`

---

#### 7. Fair Value — Túl alacsony edge threshold

**PnL: -$1.40 | Win Rate: 44.4% | Sharpe: -0.16**

**Gyökérok:**
- `minEdge: 0.02` (2%) — **extrém alacsony!** Minimális edge-gel is trade-el
- `betSize: 1.5` + `maxBet: 0.25` — agresszív méretezés felületes edge-re
- A `calculateFairProb()` túl egyszerű modell (lineáris delta → probability mapping)

**Javítási terv:**
1. 🐛 **KRITIKUS: minEdge emelése**: 0.02 → 0.08 (4×) — sokkal kevesebb, de jobb trade
2. 🐛 **betSize csökkentése**: 1.5 → 0.8 — konzervatívabb
3. 📈 **Max confidence csökkentése**: 0.85 → 0.70 — ne legyen túl magabiztos
4. 🆕 **Binance megerősítés**: Fair value + Binance signal egyezés = magasabb confidence
5. 🆕 **Fair prob modell javítása**: Nem-lineáris mapping (tanh/sigmoid) + volatility weighting

**Fájl:** `src/lib/strategies/strategies/fair-value.ts`

---

#### 8. Momentum — Túl alacsony küszöb + nincs megerősítés

**PnL: -$1.51 | Win Rate: 42.9% | Sharpe: -0.22**

**Gyökérok:**
- `btcPriceChange > 0.0005` — NAGYON alacsony trigger, szinte bármely kis mozgás trade-et generál
- `minDelta: 0.07` a config-ban, de a kód `ctx.btcPriceChange`-et használ elsőnek (0.05% trigger)
- Nincs trend megerősítés — egyetlen pillanat adata alapján dönt
- Az `interval: 3000` (letolt 1000-re a parameter optimizer által) → túl gyors

**Javítási terv:**
1. 🐛 **btcPriceChange minimum emelése**: 0.0005 → 0.002 (4×)
2. 🐛 **minDelta emelése**: 0.07 → 0.10
3. 📈 **Trend megerősítés hozzáadása**: Minimum 3 egymás utáni gyertya azonos irányba
4. 📈 **Max confidence csökkentése**: 0.78 → 0.65
5. 🆕 **Binance velocity cross-check**: Ha velocity ellentmond → no trade
6. 🆕 **Cooldown hozzáadása**: Min 2 perc két trade között

**Fájl:** `src/lib/strategies/strategies/momentum.ts`

---

#### 9. Volatility Breakout — Jó win rate (60%), de rossz R/R

**PnL: -$1.76 | Win Rate: 60.0% | Sharpe: -0.31**

**Gyökérok:**
- 10 trade (legtöbb!) → **over-trading**
- 60% win rate de nagy veszteségek → risk/reward arány probléma
- `minDelta: 0.03` — túl alacsony breakout küszöb
- A "Low Vol Breakout" mód túl spekulatív

**Javítási terv:**
1. 🐛 **minDelta emelése**: 0.03 → 0.05 — kevesebb false breakout
2. 🐛 **Low vol breakout letiltása vagy küszöb emelése**: 0.05 → 0.08
3. 📈 **High vol confidence cap**: 0.85 → 0.75 — kisebb tétek
4. 📈 **Interval emelése**: 1000ms → 2000ms — kevesebb trade
5. 🆕 **Volume confirmation**: Binance volume spike = valódi breakout
6. 🆕 **False breakout detection**: Ha delta visszatér 30 mp-en belül → korai exit

**Fájl:** `src/lib/strategies/strategies/volatility-breakout.ts`

---

#### 10. Smart Trend — Nincs elég adat probléma

**PnL: -$1.78 | Win Rate: 50.0% | Sharpe: -0.41**

**Gyökérok:**
- Minimum 10 price history pont kell → de 5-perces piacon kevés adat gyűlik
- 50% win rate = **nincs edge** — coin flip
- `confidence: 0.72` fix érték → nem adaptív
- Túl merev "short + medium trend + BTC" hármas feltétel

**Javítási terv:**
1. 🐛 **Price history minimum csökkentése**: 10 → 5 — többet trade-eljen
2. 🐛 **Fix confidence** → dinamikus: `0.55 + trendStrength * 0.25`
3. 📈 **Lazább feltételek**: Ne kelljen mind a 3 signal egyszerre (short + medium OR short + BTC)
4. 🆕 **Binance kline trend**: A Polymarket price history helyett a Binance kline-ból számolni (megbízhatóbb)
5. 🆕 **Trend erősség scoring**: ADX-szerű metrika a trend erősségéhez

**Fájl:** `src/lib/strategies/strategies/smart-trend.ts`

---

### 🔴 TIER C — Kritikus veszteség (radikális átalakítás kell)

---

#### 11. Ultra Low Entry — 16.7% win rate, a legrosszabb

**PnL: -$1.81 | Win Rate: 16.7% (1 win / 5 loss) | Sharpe: -0.37**

**Gyökérok:**
- Extreme áron vesz (< 3¢ vagy > 97¢) → a piacnak igaza van az esetek 83%-ában!
- A "Low Entry" zóna (3-10¢) BTC megerősítéssel is havonta egyszer fordul elő
- A "middle zone" ki van kapcsolva (kommentben) → nagyon szűk trade ablak

**Javítási terv:**
1. 🔄 **Teljes redesign** — a jelenlegi logika alapvetően hibás
2. 🐛 **Ultra low zóna eliminálása**: < 3¢ → sosem trade-elni (piac 97% igazat mond)
3. 🐛 **Low entry zóna szűkítése**: 3-10¢ → 5-8¢ + **kötelező BTC + Binance signal megerősítés**
4. 📈 **Csökkentett confidence**: Max 0.40 (jelenleg 0.75 a low entry-ben!)
5. 🆕 **Fallback reactivation**: A middle zone momentum trade-et visszakapcsolni, de magasabb küszöbbel (0.15% delta)
6. 💡 **ALTERNATÍVA**: Lecserélni egy teljesen új stratégiára (lásd "Új Stratégiák" szekció)

**Fájl:** `src/lib/strategies/strategies/ultra-low-entry.ts`

---

#### 12. Monte Carlo — Hamis valószínűségi modell

**PnL: -$3.75 | Win Rate: 25.0% | Max Drawdown: 51.3% | Sharpe: -0.44**

> [!CAUTION]
> **bankroll 37%-a elveszett!** A matematikai modell fundamentálisan hibás.

**Gyökérok:**
- `upProb = 0.55 + deltaPct * 3.5` — **lineáris, naiv modell** ami nem tükrözi a valóságot
- `minEdge: 0.03` (3%) — **extrém alacsony** arbirtázs küszöb
- `minDelta: 0.02` — nagyon alacsony, szinte mindig trade-el
- A "Monte Carlo" név megtévesztő — nincs valódi Monte Carlo szimuláció, csak lineáris mapping

**Javítási terv (2 opció):**

**Opció A — Javítás:**
1. 🐛 **minEdge emelése**: 0.03 → 0.10 — minimális edge 10%
2. 🐛 **minDelta emelése**: 0.02 → 0.06 — erősebb jel kell
3. 🐛 **Probability modell javítása**: Sigmoid/logistic function a lineáris helyett
4. 📈 **Max confidence csökkentése**: 0.75 → 0.60
5. 🆕 **Valódi Monte Carlo szimuláció**: 1000 szimulált path a BTC price history alapján

**Opció B — Lecserélés:**
- Teljesen új stratégiára cserélni (lásd "Új Stratégiák" szekció)

> [!IMPORTANT]
> **Javasolt: Opció B** — A jelenlegi modell annyira hibás, hogy a javítás is megkérdőjelezhető.

**Fájl:** `src/lib/strategies/strategies/monte-carlo.ts`

---

#### 13. Arbitrage — Legrosszabb PnL, legmagasabb drawdown

**PnL: -$4.64 | Win Rate: 22.2% | Max Drawdown: 67.4% | Sharpe: -0.49**

> [!CAUTION]
> **A LEGROSSZABB BOT!** -$4.64 veszteség, 67% drawdown, 22% win rate. AZONNALI intézkedés kell.

**Gyökérok:**
- `fairProb = 0.5 + deltaPct * 4` — **even more aggressive** lineáris mapping mint a Monte Carlo
- `minEdge: 0.03` és `minDelta: 0.02` — szinte mindig trade-el
- Igazából **nem arbitrázs** — nincs két piac közötti különbség kihasználása
- Nagyon hasonló a Monte Carlo-hoz → duplikáció

**Javítási terv:**
1. 🗑️ **AJÁNLÁS: Letiltani/lecserélni** — a jelenlegi logika nem védhető
2. Ha mégis megtartjuk:
   - 🐛 **minEdge**: 0.03 → 0.12
   - 🐛 **minDelta**: 0.02 → 0.08
   - 🐛 **Fair prob modell**: `0.5 + deltaPct * 4` → `0.5 + tanh(deltaPct * 10) * 0.3`
   - 🆕 **Valódi arbitrázs**:  YES+NO ár összeg > 1.0 → fee arbitrázs lehetőség
3. 💡 **LEGJOBB OPCIÓ**: Lecserélni "Spread Arbitrage"-ra amely a YES+NO spread anomáliákat figyeli

**Fájl:** `src/lib/strategies/strategies/arbitrage.ts`

---

### ⚫ TIER D — Nem trade-elt botok (szűrő/zóna probléma)

---

#### 14. Sniper Value — 0 trade (túl szigorú szűrők)

**Probléma**: A v4 fix annyira konzervatívvá tette, hogy SOHA nem lép be:
- `SNIPER_YES_MAX: 0.15` (15¢) + `priceVelocity > 0.003` (pozitív reversal) + `btcDelta > -0.03` → ritka kombináció
- `ULTRA_YES_MAX: 0.05` → automatikusan kiszáll < 5¢ árnál
- 60 másodperc minimum → sok setup kiesik

**Javítási terv:**
1. 🐛 **Zóna szélesítése**: `SNIPER_YES_MAX`: 0.15 → 0.22 (és NO: 0.85 → 0.78)
2. 🐛 **Velocity threshold lazítás**: `> 0.003` → `> 0.001` (reversal jel)
3. 🐛 **Time minimum csökkentés**: 60s → 30s
4. 📈 **Ultra zóna re-engedélyezés**: Nagyon alacsony confidence-szel (0.25) < 5¢ árnál
5. 🆕 **BTC acceleration megerősítés**: Nem csak delta, hanem BTC irányváltás is számít

**Fájl:** `src/lib/strategies/strategies/sniper-value.ts`

---

#### 15. Price Reversion — 0 trade (szűk reversal evidence)

**Probléma**: A v4 annyira konzervatív, hogy a reversal evidence soha nem teljesül:
- `priceVelocity > 0.005` (pozitív reversal) szükséges → nagyon ritkán fordul elő
- `PURE_EXTREME_YES: 0.10` → skip < 10¢
- `BUY_YES_MAX: 0.20` → csak 10-20¢ zónában

**Javítási terv:**
1. 🐛 **Reversal velocity lazítás**: `> 0.005` → `> 0.001`
2. 🐛 **Zóna szélesítése**: `BUY_YES_MAX`: 0.20 → 0.28 (és NO: 0.80 → 0.72)
3. 🐛 **Extreme zóna szűkítése**: `PURE_EXTREME_YES`: 0.10 → 0.06
4. 📈 **Magasabb confidence a BTC megerősítéssel**: +0.05 → +0.12

**Fájl:** `src/lib/strategies/strategies/price-reversion.ts`

---

#### 16. Odds Swing — 0 trade (reversal evidence + stabilization ritkán együtt)

**Probléma**: A v4 túl sok feltételt követel egyszerre:
- `priceVelocity > 0.005` (reversing) ÉS stabilizing ÉS BTC confirm → szinte soha
- `SWING_LOW: 0.20` és `EXTREME_LOW: 0.08` → nagyon szűk ablak
- `minTimeRemaining: 60000` + max confidence: 0.48 → kevés motiváció kis edge-re

**Javítási terv:**
1. 🐛 **Feltételek lazítása**: Reversal VAGY stabilization (nem mindkettő)
2. 🐛 **Velocity küszöb**: 0.005 → 0.002
3. 🐛 **Confidence cap emelése**: 0.48 → 0.58
4. 📈 **Zóna szélesítés**: `SWING_LOW`: 0.20 → 0.25 / `SWING_HIGH`: 0.80 → 0.75
5. 🆕 **Time-based scaling**: Kevesebb idő = magasabb confidence (reversal valószínűbb)

**Fájl:** `src/lib/strategies/strategies/odds-swing.ts`

---

## 🔧 Rendszerszintű Problémák & Javítások

### 1. 🐛 Over-trading & Duplikáció

**Probléma**: Sok stratégia lényegében **ugyanazt csinálja** — BTC delta alapján YES/NO-t vesz:
- **Window Delta** = BTC delta → YES/NO
- **Contrarian** = BTC delta → YES/NO (azonos küszöb: 0.05%)
- **Binance Signal fallback** = BTC delta → YES/NO (0.02% küszöb)
- **Monte Carlo** = BTC delta → probability → YES/NO
- **Arbitrage** = BTC delta → fair value → YES/NO
- **Momentum** = BTC delta → YES/NO
- **Fair Value** = BTC delta → edge → YES/NO

> [!WARNING]
> **7 bot csinál lényegében ugyanazt!** Ez nem diverzifikáció, hanem 7× leverage ugyanarra a signalra.

**Javítás:**
1. Kategorizálni a botokat **valódi edge típus** szerint
2. Stratégiánként max 2 bot azonos típusból
3. A Strategy Coordinator compatible strategies map frissítése

### 2. 🐛 Bet Sizing Inkonzisztencia

| Bot | betSize | maxBet | useKelly | Probléma |
|-----|---------|--------|----------|----------|
| Window Delta | **1.5** | **0.30** | yes | Túl agresszív |
| Fair Value | **1.5** | 0.25 | yes | Túl agresszív |
| Momentum | **1.5** | 0.25 | yes | Túl agresszív |
| Binance Velocity | 1.0 | 0.25 | yes | OK |
| Odds Swing | 0.5 | 0.15 | **no** | Túl konzervatív |

**Javítás:**
- Egységesíteni: `betSize: 1.0`, `maxBet: 0.20` mindenhol
- NYERESÉGES botok: `maxBet: 0.25`
- VESZTESÉGES botok: `maxBet: 0.15`

### 3. 🐛 Parameter Optimizer Problémák

A genetikus algoritmus módosítja runtime-ban a `kellyFraction` és `interval` értékeket, ami instabilitást okoz:
- Arbitrage `betSize` 1.0 → 0.977 (optimized)
- Trend Pullback `kellyFraction`: 0.30 → 0.311 (optimized)
- Contrarian `interval`: 2000 → 4000 (!) (optimized — lassított)

**Javítás:**
- Minimum 50 trade után engedélyezni az optimizer-t (jelenleg 5!)
- Nagyobb változtatás boundary: max ±10% (jelenleg nincs limit)

---

## 🆕 Új Stratégia Javaslatok

A Tier C/D botok helyettesítésére:

### 1. **VWAP Deviation Strategy** (Monte Carlo helyett)
- Binance VWAP (Volume Weighted Average Price) számítása
- Trade ha az ár VWAP felett/alatt van → visszatérés a VWAP-hoz
- Edge: valódi statisztikai visszatérés, nem naiv lineáris mapping

### 2. **Order Flow Imbalance** (Arbitrage helyett)
- Polymarket orderbook adatok felhasználása
- Ha nagy bid/ask egyensúlytalanság → trading a nagyobb oldal irányába
- Edge: piaci mikrostruktúra, nem BTC delta

### 3. **Regime Switch Strategy** (Ultra Low Entry helyett)
- BTC piaci rezsim felismerés (trending/ranging/volatile)
- Trending → momentum stratégia
- Ranging → mean reversion
- Volatile → skipping/konzervatív

---

## 📋 Végrehajtási Sorrend (Priority Matrix)

### 🔴 AZONNAL (ma)

| # | Feladat | Érintett bot | Becsült idő |
|---|---------|-------------|-------------|
| 1 | Arbitrage letiltása vagy lecserélése | Arbitrage | 30 min |
| 2 | Monte Carlo minEdge és minDelta emelése | Monte Carlo | 15 min |
| 3 | Window Delta betSize 1.5 → 1.0, maxBet 0.30 → 0.20 | Window Delta | 5 min |
| 4 | Fair Value minEdge 0.02 → 0.08, betSize 1.5 → 0.8 | Fair Value | 10 min |

### 🟠 HOLNAP (rövid távon)

| # | Feladat | Érintett bot | Becsült idő |
|---|---------|-------------|-------------|
| 5 | T-10 Sniper minDelta 0.01 → 0.04 + confidence cap | T-10 Sniper | 20 min |
| 6 | Momentum btcPriceChange threshold emelés | Momentum | 15 min |
| 7 | Volatility Breakout minDelta emelés + low vol skip | Volatility Breakout | 20 min |
| 8 | Binance Signal fallback letiltása | Binance Signal | 15 min |

### 🟡 EZT A HETET

| # | Feladat | Érintett bot | Becsült idő |
|---|---------|-------------|-------------|
| 9 | Sniper Value zóna szélesítés + velocity lazítás | Sniper Value | 30 min |
| 10 | Price Reversion reversal és zóna javítás | Price Reversion | 30 min |
| 11 | Odds Swing feltétel lazítás | Odds Swing | 30 min |
| 12 | Contrarian igazi contrarian logikává alakítás | Contrarian | 45 min |
| 13 | Smart Trend adaptív confidence + lazább feltételek | Smart Trend | 30 min |

### 🟢 JÖVŐ HÉT

| # | Feladat | Érintett bot | Becsült idő |
|---|---------|-------------|-------------|
| 14 | Ultra Low Entry redesign vagy lecserélés | Ultra Low Entry | 1-2 óra |
| 15 | Monte Carlo lecserélés VWAP stratégiára | Monte Carlo | 2 óra |
| 16 | Arbitrage lecserélés Order Flow stratégiára | Arbitrage | 2 óra |
| 17 | Binance Velocity erősítés (volume, kline depth) | Binance Velocity | 1 óra |
| 18 | Trend Pullback dynamic delta threshold | Trend Pullback | 45 min |

---

## 📈 Várható Eredmények

Ha a fenti javítások végrehajtásra kerülnek:

| Metrika | Jelenlegi | Várható |
|---|---|---|
| Nyereséges botok | 2 / 16 | **8-10 / 16** |
| Összesített PnL | -$19.98 | **+$2 — +$5 / session** |
| Átlagos win rate | ~50% | **60-65%** |
| Átlagos drawdown | 29.4% | **< 20%** |
| "Halott" botok (0 trade) | 3 | **0** |
| Duplikált stratégiák | 7 | **2-3** |

---

## 🎯 Összefoglalás

A 16 botból:
1. **2 bot jó** (Binance Velocity, Trend Pullback) → erősíteni, nagyobb pozícióval
2. **3 bot majdnem jó** (T-10, Window Delta, Contrarian) → kis parameter tuning = profitba fordítható
3. **5 bot javítható** (Binance Signal, Fair Value, Momentum, Vol Breakout, Smart Trend) → küszöb emelés, bet size csökkentés
4. **3 bot kritikus** (Ultra Low, Monte Carlo, Arbitrage) → lecserélni új stratégiákra
5. **3 bot halott** (Sniper Value, Price Reversion, Odds Swing) → szűrők lazítása

A **legfontosabb rendszerszintű probléma**: 7 bot lényegében ugyanazt csinálja (BTC delta follow), nincs valódi diverzifikáció. A megoldás: minden botnak **egyedi edge-t** adni, nem csak más paraméterekkel ugyanazt a logikát futtatni.

---

*Dokumentum generálva: 2026-04-09 | Adatforrás: `data/polymarket.db` + forráskód elemzés*

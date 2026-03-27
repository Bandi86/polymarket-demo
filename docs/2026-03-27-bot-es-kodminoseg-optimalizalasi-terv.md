# Bot és Kódminőség Optimalizálási Terv

## Célkitűzés
Ez a dokumentum egy részletes, pontról pontra haladó tervezetet biztosít a jelenlegi kódbázis minőségének javítására, a botok működésének és teljesítményének optimalizálására, valamint a hosszabb (300 sornál nagyobb) fájlok moduláris refaktorálására.

---

## 1. Kódminőség és Refaktorálási Terv (Max 300 soros szabály)

A kódbázisban jelenleg több olyan fájl is található, amely kritikusan túllépi a 300 soros limitet (pl. `bot-manager.ts` - 2240 sor, `polymarket-provider.ts` - 993 sor, `TopDashboard.tsx` - 863 sor). A cél ezen fájlok logikai feldarabolása az alábbi lépések szerint:

### 1.1 Vizuális komponensek feldarabolása (Frontend)
- **Fájlok darabolása:** Minden nagyobb UI fájlt dedikált almappába helyezünk (`src/components/[KomponensNeve]/`).
- **Kiszedhető elemek:** a headerek, gombok, és modal-ok külön kis komponens fájlokba (`TabHeader.tsx`, `AssetSelector.tsx`, stb.) kerüljenek.
- **Hook-ok kiszervezése:** Az üzleti logika (belső állapotok menedzselése, side-effectek) kerüljön egyedi React hook-okba (pl. `useTopDashboardState.ts`), így maga a `.tsx` fájl csak a megjelenítést (View) kezeli.

### 1.2 Üzleti logika és Szolgáltatások (Backend / Lib)
- **bot-manager.ts (2240 sor) refaktorálása:** Ez a legkritikusabb fájl. A funkciókat osztályokra/modulokra kell bontani (pl. `BotInstigator.ts`, `BotStateTracker.ts`, `BotPositionManager.ts`, `BotEventLogger.ts`).
- **polymarket-provider.ts (993 sor) felosztása:** A hálózati rétegek felosztása. Külön fájl a WebSocket kezeléshez, külön az API REST hívásokhoz, külön az adatok normalizálásához (parsers).
- **Barrel fájlok használata:** `index.ts` fájlok segítségével tegyük tisztává az importokat a felosztás után (pl. `import { BotTracker } from '@/lib/bot-manager'`).

### 1.3 Típusok és interfészek szétválasztása
- Minden fájlból, ahol lokális típusok és interface-ek vannak definiálva, azokat dedikált fájlokba kell áthelyezni fájlonként vagy doménenként (pl. `types/bot.types.ts`, `types/market.types.ts`).

---

## 2. Bot Optimalizálási és Viselkedésjavítási Terv

A botok hatékonyabb futása és logikusabb viselkedése érdekében az alábbi lépéseket kell végrehajtani:

### 2.1 Eseményvezérelt Architektúra Finomhangolása
- A folyamatos "polling" (időközönkénti lekérdezés) helyett sokkal inkáb az eseményvezérelt (event-driven) logikát kell alkalmazni.
- A botok ne folyamatosan számoljanak újra mindent a tick körökben, hanem csak akkor értékeljék ki a stratégiákat, ha az árak vagy az order book érdemben változik (`onPriceChange`, `onOrderFill` események).

### 2.2 Stratégiai motor és a végrehajtás szétválasztása
- A botok döntéshozatali logikájának (Signal Generation) élesebb elválasztása magától a kereskedés végrehajtásától (Execution/Order Routing). 
- Így önállóan módosítható és visszatesztelhető (Backtesting) az "agy" a piac aktuális kockázatkezelési környezetétől függetlenül.

### 2.3 Kockázatkezelési (Risk Management) Integráció
- Dedikált Stop-Loss és Take-Profit modulok szorosabb bekötése a botokhoz, amelyek függetlenül, stabilan monitorozzák a nyitott pozíciókat.
- Dinamikus tőkeallokáció megvalósítása: Ne fix összegekkel kereskedjenek a botok, hanem a kockázat/hozam arány és a rendelkezésre álló egyenleg százalékos allokációjával.

---

## 3. Teljesítmény- és Sebességoptimalizálás (Minőségbiztosítás)

### 3.1 Memóriakezelés és React Optimalizáció
- Összetett frontend kalkulációk és nagy re-rendereket okozó referenciák esetén a `useMemo` és `useCallback` hook-ok szigorúbb alkalmazása (főleg a botok sokasága, vagy múltbeli teljesítmények hosszú listáinál).
- Tisztítás (Cleanup): Komponensek leállásakor (Unmount) és botok manuális leállításakor ügyelni kell az elvarratlan hálózati kérések abortálására és event listener-ek eltávolítására – ezzel megszüntethetők az alattomos memóriaszivárgások (memory leak).

### 3.2 Aszinkron műveletek párhuzamosítása
- `Promise.allSettled()` használata az egymástól független API kérések vagy adatbázis lekérdezések egyidejű indítására.
- Retry logikák megerősítése (pl. Exponential Backoff) az API korlátozások (Rate Limit) stabil kezelése és elkerülése végett.

---

## 4. Bónusz: Hibajavítás és Debugolási Stratégia (Bugfix & Debug)

### 4.1 A jelenlegi ismert és rejtett hibák felderítése
- **Adat ismétlődés/kimaradás:** A hálózati kommunikáció és a Polymarket API esetén felléphetnek instabilitások. Fel kell készíteni a bot motorját a korruptált, "undefined" vagy "null" adatok biztonságos csendes kikerülésére.
- **Renderelési anomáliák a UI-on:** Például a PnL (Profit and Loss) grafikonok, és az időzítők állapotfrissítési problémái. Itt szigorú állapotkezelő (State Manager) ellenőrzést kell végezni a dupla renderelések elkerülése miatt.
- **Botok csendes összeomlása (Silent failure):** Gyakori jelenség hosszú futási idejű (long-running) rendszereknél, ha egy kivétel (Exception) nincs lekezelve. Minden kulcsfontosságú aszinkron funkció körül védelmi vonal (try/catch blokkok alapos hibakezeléssel) kiépítése.

### 4.2 Strukturált Debugolási Folyamat bevezetése
1. **Dedikált Debugger mód és Telemetria:** Átfogó, szintezhető naplózási rendszer (ERROR, INFO, DEBUG, TRACE) aktiválása. Mérni kell, hogy egy iteráció (tick) végrehajtása pontosan mennyi időt vesz igénybe. Ha túllépi az ideális időt (> 50-100ms), ott felesleges blokkoló műveletek (blocking iterators) vannak a kódban.
2. **Környezeti izoláció hibakezeléskor:** Amikor egy kritikus hiba lép fel egy botban, az adott bot ne állítsa le a teljes Managert, hanem kerüljön "Paused/Error" státuszba, megtartva és kilogolva az éppen aktuális állapotát a hiba megtalálásához (Error Stack Trace kimentése).
3. **Regresszió Elkerülése (Unit tesztek):** Minden megtalált és kidebuggolt stratégiai és strukturális hibához utólag tesztesetet írni `vitest` környezetben. Ez garantálja, hogy a kód egyszer már javított részeiben a későbbi refaktorálások során a "bug" nem jelenik meg újra.

// SwingTraderPanel - UI a swing trading bot kezeléséhez
// Mutatja a nyitott swing pozíciókat és lehetővé teszi TP/SL beállítását

import { useState, useEffect, useCallback } from "react";
import { TrendingUp, TrendingDown, Target, Zap, DollarSign, ArrowUpRight } from "lucide-react";
import { formatCurrency } from "../lib/utils";

interface SwingPosition {
  id: string;
  outcome: "YES" | "NO";
  amount: number;
  entryOdds: number;
  currentOdds: number;
  takeProfitOdds: number;
  stopLossOdds: number;
  unrealizedPnl: number;
  unrealizedPnlPct: number;
  progressToTP: number; // 0-100
}

interface SwingBotStats {
  totalTrades: number;
  tpHits: number;
  slHits: number;
  totalPnl: number;
  openPositions: number;
}

interface SwingTraderPanelProps {
  yesPrice: number;
  noPrice: number;
  coinColor: string;
}

export function SwingTraderPanel({ yesPrice, noPrice, coinColor }: SwingTraderPanelProps) {
  const [positions, setPositions] = useState<SwingPosition[]>([]);
  const [stats, setStats] = useState<SwingBotStats | null>(null);
  const [config, setConfig] = useState({
    entryThreshold: 0.15,  // Belép ha ár < 15¢
    takeProfitMultiplier: 2.0,  // Zár ha 2x
    stopLossMultiplier: 0.5,    // Zár ha felére esik
    betSize: 0.5,
  });
  const [isBotEnabled, setIsBotEnabled] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const [posRes, botRes] = await Promise.all([
        fetch("/api/positions"),
        fetch("/api/bots"),
      ]);
      const posData = await posRes.json();
      const botsData = await botRes.json();

      const swingBot = botsData.find((b: { strategy: string; id: string }) => b.strategy === "odds_swing");
      setIsBotEnabled(swingBot?.enabled ?? false);

      // Szűrd a swing bot pozícióit
      const open = posData.open || [];
      const swingPositions: SwingPosition[] = open
        .filter((p: { botId?: string }) => p.botId === "bot-odds-swing" || !p.botId)
        .map((p: {
          id: string;
          outcome: "YES" | "NO";
          amount: number;
          odds: number;
        }) => {
          const current = p.outcome === "YES" ? yesPrice : noPrice;
          const ratio = current / p.odds;
          const unrealizedPnlPct = (ratio - 1) * 100;
          const unrealizedPnl = p.amount * ratio - p.amount;
          const tpOdds = p.odds * config.takeProfitMultiplier;
          const slOdds = p.odds * config.stopLossMultiplier;
          const progressToTP = Math.min(100, Math.max(0,
            ((ratio - config.stopLossMultiplier) / (config.takeProfitMultiplier - config.stopLossMultiplier)) * 100
          ));

          return {
            id: p.id,
            outcome: p.outcome,
            amount: p.amount,
            entryOdds: p.odds,
            currentOdds: current,
            takeProfitOdds: tpOdds,
            stopLossOdds: slOdds,
            unrealizedPnl,
            unrealizedPnlPct,
            progressToTP,
          };
        });

      setPositions(swingPositions);
    } catch (err) {
      console.error("SwingTraderPanel fetch error:", err);
    }
  }, [yesPrice, noPrice, config]);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 1000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const toggleBot = async () => {
    await fetch("/api/bots/bot-odds-swing/toggle", { method: "POST" });
    await fetchData();
  };

  const manualBuy = async (outcome: "YES" | "NO") => {
    const price = outcome === "YES" ? yesPrice : noPrice;
    if (price > config.entryThreshold) {
      alert(`Az ár (${(price * 100).toFixed(1)}¢) magasabb mint a belépési küszöb (${(config.entryThreshold * 100).toFixed(0)}¢)`);
      return;
    }
    await fetch("/api/trade", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ outcome, amount: config.betSize }),
    });
    // Register TP/SL via API
    await fetch("/api/swing/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        outcome,
        entryOdds: price,
        takeProfitMultiplier: config.takeProfitMultiplier,
        stopLossMultiplier: config.stopLossMultiplier,
      }),
    });
    await fetchData();
  };

  const closePosition = async (positionId: string) => {
    await fetch(`/api/positions/${positionId}/close`, { method: "POST" });
    await fetchData();
  };

  const entryAvailable = yesPrice <= config.entryThreshold || noPrice <= config.entryThreshold;

  return (
    <div className="glass-card" style={{ padding: "1.25rem" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <Zap className="w-5 h-5" style={{ color: coinColor }} />
          <span style={{ fontWeight: 700, fontSize: "1.125rem" }}>Odds Swing Trader</span>
        </div>
        <button
          onClick={toggleBot}
          style={{
            padding: "0.375rem 0.875rem",
            borderRadius: 8,
            border: "none",
            background: isBotEnabled ? "rgba(239,68,68,0.15)" : "rgba(34,197,94,0.15)",
            color: isBotEnabled ? "#ef4444" : "#22c55e",
            fontWeight: 600,
            fontSize: "0.75rem",
            cursor: "pointer",
          }}
        >
          {isBotEnabled ? "Bot leállítás" : "Bot indítás"}
        </button>
      </div>

      {/* Aktuális árak és belépési lehetőség */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        gap: "0.75rem",
        marginBottom: "1rem",
      }}>
        <button
          onClick={() => manualBuy("YES")}
          disabled={yesPrice > config.entryThreshold}
          style={{
            padding: "0.875rem",
            borderRadius: 10,
            border: `2px solid ${yesPrice <= config.entryThreshold ? "rgba(34,197,94,0.5)" : "rgba(34,197,94,0.15)"}`,
            background: yesPrice <= config.entryThreshold ? "rgba(34,197,94,0.12)" : "rgba(34,197,94,0.05)",
            cursor: yesPrice <= config.entryThreshold ? "pointer" : "not-allowed",
            opacity: yesPrice > config.entryThreshold ? 0.5 : 1,
            textAlign: "left",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "0.375rem", marginBottom: "0.375rem" }}>
            <TrendingUp className="w-4 h-4" style={{ color: "#22c55e" }} />
            <span style={{ fontSize: "0.75rem", fontWeight: 600, color: "#22c55e" }}>UP / YES</span>
            {yesPrice <= config.entryThreshold && (
              <span style={{ fontSize: "0.625rem", background: "#22c55e", color: "white", padding: "0.1rem 0.375rem", borderRadius: 9999 }}>
                BELÉPÉS!
              </span>
            )}
          </div>
          <div style={{ fontSize: "1.5rem", fontWeight: 700, fontFamily: "monospace", color: "#22c55e" }}>
            {(yesPrice * 100).toFixed(1)}¢
          </div>
          <div style={{ fontSize: "0.7rem", color: "var(--text-muted)", marginTop: "0.25rem" }}>
            Cél: {(yesPrice * config.takeProfitMultiplier * 100).toFixed(1)}¢ ({((config.takeProfitMultiplier - 1) * 100).toFixed(0)}% profit)
          </div>
        </button>

        <button
          onClick={() => manualBuy("NO")}
          disabled={noPrice > config.entryThreshold}
          style={{
            padding: "0.875rem",
            borderRadius: 10,
            border: `2px solid ${noPrice <= config.entryThreshold ? "rgba(239,68,68,0.5)" : "rgba(239,68,68,0.15)"}`,
            background: noPrice <= config.entryThreshold ? "rgba(239,68,68,0.12)" : "rgba(239,68,68,0.05)",
            cursor: noPrice <= config.entryThreshold ? "pointer" : "not-allowed",
            opacity: noPrice > config.entryThreshold ? 0.5 : 1,
            textAlign: "left",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "0.375rem", marginBottom: "0.375rem" }}>
            <TrendingDown className="w-4 h-4" style={{ color: "#ef4444" }} />
            <span style={{ fontSize: "0.75rem", fontWeight: 600, color: "#ef4444" }}>DOWN / NO</span>
            {noPrice <= config.entryThreshold && (
              <span style={{ fontSize: "0.625rem", background: "#ef4444", color: "white", padding: "0.1rem 0.375rem", borderRadius: 9999 }}>
                BELÉPÉS!
              </span>
            )}
          </div>
          <div style={{ fontSize: "1.5rem", fontWeight: 700, fontFamily: "monospace", color: "#ef4444" }}>
            {(noPrice * 100).toFixed(1)}¢
          </div>
          <div style={{ fontSize: "0.7rem", color: "var(--text-muted)", marginTop: "0.25rem" }}>
            Cél: {(noPrice * config.takeProfitMultiplier * 100).toFixed(1)}¢ ({((config.takeProfitMultiplier - 1) * 100).toFixed(0)}% profit)
          </div>
        </button>
      </div>

      {/* Konfigurálás */}
      <div style={{
        padding: "0.875rem",
        background: "rgba(0,0,0,0.2)",
        borderRadius: 8,
        marginBottom: "1rem",
      }}>
        <div style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--text-secondary)", marginBottom: "0.75rem" }}>
          Beállítások
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.7rem", marginBottom: "0.25rem" }}>
              <span style={{ color: "var(--text-muted)" }}>Belépési küszöb</span>
              <span style={{ fontFamily: "monospace", fontWeight: 600 }}>{(config.entryThreshold * 100).toFixed(0)}¢</span>
            </div>
            <input type="range" min={0.05} max={0.30} step={0.01}
              value={config.entryThreshold}
              onChange={(e) => setConfig(c => ({ ...c, entryThreshold: parseFloat(e.target.value) }))}
              style={{ width: "100%", accentColor: coinColor }}
            />
          </div>
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.7rem", marginBottom: "0.25rem" }}>
              <span style={{ color: "var(--text-muted)" }}>Tét méret</span>
              <span style={{ fontFamily: "monospace", fontWeight: 600 }}>{formatCurrency(config.betSize)}</span>
            </div>
            <input type="range" min={0.25} max={5} step={0.25}
              value={config.betSize}
              onChange={(e) => setConfig(c => ({ ...c, betSize: parseFloat(e.target.value) }))}
              style={{ width: "100%", accentColor: coinColor }}
            />
          </div>
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.7rem", marginBottom: "0.25rem" }}>
              <span style={{ color: "var(--text-muted)" }}>Take Profit</span>
              <span style={{ fontFamily: "monospace", fontWeight: 600, color: "#22c55e" }}>
                {config.takeProfitMultiplier}x (+{((config.takeProfitMultiplier - 1) * 100).toFixed(0)}%)
              </span>
            </div>
            <input type="range" min={1.3} max={5} step={0.1}
              value={config.takeProfitMultiplier}
              onChange={(e) => setConfig(c => ({ ...c, takeProfitMultiplier: parseFloat(e.target.value) }))}
              style={{ width: "100%", accentColor: "#22c55e" }}
            />
          </div>
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.7rem", marginBottom: "0.25rem" }}>
              <span style={{ color: "var(--text-muted)" }}>Stop Loss</span>
              <span style={{ fontFamily: "monospace", fontWeight: 600, color: "#ef4444" }}>
                {config.stopLossMultiplier}x (-{((1 - config.stopLossMultiplier) * 100).toFixed(0)}%)
              </span>
            </div>
            <input type="range" min={0.1} max={0.9} step={0.05}
              value={config.stopLossMultiplier}
              onChange={(e) => setConfig(c => ({ ...c, stopLossMultiplier: parseFloat(e.target.value) }))}
              style={{ width: "100%", accentColor: "#ef4444" }}
            />
          </div>
        </div>
      </div>

      {/* Nyitott pozíciók */}
      {positions.length > 0 && (
        <div>
          <div style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--text-secondary)", marginBottom: "0.5rem" }}>
            Nyitott swing pozíciók ({positions.length})
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            {positions.map((pos) => (
              <div key={pos.id} style={{
                padding: "0.75rem",
                background: "rgba(0,0,0,0.25)",
                borderRadius: 8,
                border: `1px solid ${pos.unrealizedPnlPct >= 0 ? "rgba(34,197,94,0.2)" : "rgba(239,68,68,0.2)"}`,
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.5rem" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                    <span style={{
                      padding: "0.125rem 0.5rem",
                      borderRadius: 4,
                      fontSize: "0.7rem",
                      fontWeight: 700,
                      background: pos.outcome === "YES" ? "rgba(34,197,94,0.2)" : "rgba(239,68,68,0.2)",
                      color: pos.outcome === "YES" ? "#22c55e" : "#ef4444",
                    }}>
                      {pos.outcome === "YES" ? "↑ UP" : "↓ DOWN"}
                    </span>
                    <span style={{ fontFamily: "monospace", fontSize: "0.75rem" }}>
                      Belépés: {(pos.entryOdds * 100).toFixed(1)}¢ → Most: {(pos.currentOdds * 100).toFixed(1)}¢
                    </span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                    <span style={{
                      fontFamily: "monospace",
                      fontWeight: 600,
                      color: pos.unrealizedPnlPct >= 0 ? "#22c55e" : "#ef4444",
                      fontSize: "0.875rem",
                    }}>
                      {pos.unrealizedPnlPct >= 0 ? "+" : ""}{pos.unrealizedPnlPct.toFixed(1)}%
                    </span>
                    <button
                      onClick={() => closePosition(pos.id)}
                      style={{
                        padding: "0.25rem 0.5rem",
                        borderRadius: 6,
                        border: "1px solid var(--border)",
                        background: "transparent",
                        color: "var(--text-muted)",
                        fontSize: "0.625rem",
                        cursor: "pointer",
                      }}
                    >
                      Zárás
                    </button>
                  </div>
                </div>

                {/* Progress bar: SL --- current --- TP */}
                <div style={{ position: "relative", height: 6, borderRadius: 3, background: "rgba(0,0,0,0.3)", overflow: "hidden" }}>
                  {/* SL zona (piros bal oldal) */}
                  <div style={{ position: "absolute", left: 0, top: 0, height: "100%", width: "10%", background: "rgba(239,68,68,0.3)" }} />
                  {/* TP zona (zöld jobb oldal) */}
                  <div style={{ position: "absolute", right: 0, top: 0, height: "100%", width: "10%", background: "rgba(34,197,94,0.3)" }} />
                  {/* Progress indicator */}
                  <div style={{
                    position: "absolute",
                    left: 0,
                    top: 0,
                    height: "100%",
                    width: `${pos.progressToTP}%`,
                    background: pos.unrealizedPnlPct >= 0 ? "#22c55e" : "#ef4444",
                    transition: "width 0.3s",
                    borderRadius: 3,
                  }} />
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.6rem", color: "var(--text-muted)", marginTop: "0.25rem" }}>
                  <span style={{ color: "#ef4444" }}>SL: {(pos.stopLossOdds * 100).toFixed(1)}¢</span>
                  <span style={{ color: "var(--text-muted)" }}>{formatCurrency(pos.amount)} tét</span>
                  <span style={{ color: "#22c55e" }}>TP: {(pos.takeProfitOdds * 100).toFixed(1)}¢</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {positions.length === 0 && (
        <div style={{ textAlign: "center", padding: "1rem", color: "var(--text-muted)", fontSize: "0.875rem" }}>
          <ArrowUpRight className="w-5 h-5" style={{ margin: "0 auto 0.5rem", opacity: 0.4 }} />
          <p style={{ margin: 0 }}>Nincs nyitott swing pozíció</p>
          <p style={{ margin: "0.25rem 0 0", fontSize: "0.75rem" }}>
            {entryAvailable ? "✅ Van belépési lehetőség!" : `Várakozás: ár < ${(config.entryThreshold * 100).toFixed(0)}¢`}
          </p>
        </div>
      )}
    </div>
  );
}

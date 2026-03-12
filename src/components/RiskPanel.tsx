import { useState, useEffect, useCallback } from "react";
import { Shield, AlertTriangle, Play, Pause, RefreshCw, Settings } from "lucide-react";
import type { RiskSettings, RiskWarning, RiskStatus } from "../lib/risk-manager";

interface BotRiskInfo {
  id: string;
  name: string;
  status: RiskStatus;
}

export function RiskPanel() {
  const [settings, setSettings] = useState<RiskSettings | null>(null);
  const [warnings, setWarnings] = useState<RiskWarning[]>([]);
  const [botRisks, setBotRisks] = useState<BotRiskInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const [settingsRes, warningsRes, botsRes] = await Promise.all([
        fetch("/api/risk/settings"),
        fetch("/api/risk/warnings?limit=20"),
        fetch("/api/bots"),
      ]);

      const settingsData = await settingsRes.json();
      const warningsData = await warningsRes.json();
      const botsData = await botsRes.json();

      setSettings(settingsData);
      setWarnings(warningsData);

      // Fetch risk status for each bot
      const riskPromises = botsData.map(async (bot: { id: string; name: string }) => {
        const res = await fetch(`/api/risk/status/${bot.id}`);
        const status = await res.json();
        return { id: bot.id, name: bot.name, status };
      });

      const risks = await Promise.all(riskPromises);
      setBotRisks(risks);
    } catch (err) {
      console.error("Failed to fetch risk data:", err);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 3000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const updateSettings = async (updates: Partial<RiskSettings>) => {
    setLoading(true);
    try {
      await fetch("/api/risk/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });
      await fetchData();
    } catch (err) {
      console.error("Failed to update settings:", err);
    } finally {
      setLoading(false);
    }
  };

  const resumeBot = async (botId: string) => {
    try {
      await fetch(`/api/risk/resume/${botId}`, { method: "POST" });
      await fetchData();
    } catch (err) {
      console.error("Failed to resume bot:", err);
    }
  };

  const resetAll = async () => {
    if (!confirm("Reset all risk states? This will clear warnings and unpause all bots.")) return;
    try {
      await fetch("/api/risk/reset-all", { method: "POST" });
      await fetchData();
    } catch (err) {
      console.error("Failed to reset:", err);
    }
  };

  const getSeverityColor = (severity: RiskWarning["severity"]) => {
    return severity === "critical" ? "#ef4444" : "#f59e0b";
  };

  const getTypeLabel = (type: RiskWarning["type"]) => {
    const labels: Record<RiskWarning["type"], string> = {
      daily_loss: "Daily Loss",
      drawdown: "Drawdown",
      rate_limit: "Rate Limit",
      position_size: "Position Size",
      portfolio_loss: "Portfolio Loss",
    };
    return labels[type] || type;
  };

  if (!settings) {
    return (
      <div style={{ textAlign: "center", padding: "2rem", color: "var(--text-muted)" }}>
        <div className="loading-spinner" style={{ margin: "0 auto 1rem" }} />
        Loading risk data...
      </div>
    );
  }

  const pausedBots = botRisks.filter(b => b.status.paused);
  const activeWarnings = warnings.filter(w => Date.now() - w.timestamp < 3600000); // Last hour

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      {/* Header */}
      <div className="glass-card" style={{ padding: "1rem" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <Shield className="w-5 h-5" style={{ color: "#3b82f6" }} />
            <span style={{ fontWeight: 600, fontSize: "1.125rem" }}>Risk Management</span>
          </div>
          <div style={{ display: "flex", gap: "0.5rem" }}>
            <button
              onClick={() => setShowSettings(!showSettings)}
              className="quick-btn"
              style={{ display: "flex", alignItems: "center", gap: "0.25rem" }}
            >
              <Settings className="w-3 h-3" />
              Settings
            </button>
            <button
              onClick={resetAll}
              className="quick-btn"
              style={{ display: "flex", alignItems: "center", gap: "0.25rem" }}
            >
              <RefreshCw className="w-3 h-3" />
              Reset All
            </button>
          </div>
        </div>

        {/* Quick Stats */}
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          gap: "1rem",
          marginTop: "1rem"
        }}>
          <div style={{ textAlign: "center", padding: "0.5rem", background: "var(--glass-bg)", borderRadius: 6 }}>
            <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", display: "block" }}>Max Daily Loss</span>
            <span style={{ fontFamily: "ui-monospace, monospace", fontWeight: 600 }}>${settings.maxDailyLoss}</span>
          </div>
          <div style={{ textAlign: "center", padding: "0.5rem", background: "var(--glass-bg)", borderRadius: 6 }}>
            <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", display: "block" }}>Max Position</span>
            <span style={{ fontFamily: "ui-monospace, monospace", fontWeight: 600 }}>${settings.maxPositionSize}</span>
          </div>
          <div style={{ textAlign: "center", padding: "0.5rem", background: "var(--glass-bg)", borderRadius: 6 }}>
            <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", display: "block" }}>Max Drawdown</span>
            <span style={{ fontFamily: "ui-monospace, monospace", fontWeight: 600 }}>{settings.maxDrawdownPercent}%</span>
          </div>
          <div style={{ textAlign: "center", padding: "0.5rem", background: "var(--glass-bg)", borderRadius: 6 }}>
            <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", display: "block" }}>Paused Bots</span>
            <span style={{
              fontFamily: "ui-monospace, monospace",
              fontWeight: 600,
              color: pausedBots.length > 0 ? "#ef4444" : "var(--text-primary)"
            }}>
              {pausedBots.length}
            </span>
          </div>
        </div>
      </div>

      {/* Settings Panel */}
      {showSettings && (
        <div className="glass-card" style={{ padding: "1rem" }}>
          <h3 style={{ margin: "0 0 1rem", fontSize: "1rem", fontWeight: 600 }}>Risk Settings</h3>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "1rem" }}>
            {/* Per-bot limits */}
            <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
              <h4 style={{ margin: 0, fontSize: "0.875rem", color: "var(--text-secondary)" }}>Per-Bot Limits</h4>

              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <label style={{ fontSize: "0.875rem" }}>Max Daily Loss ($)</label>
                <input
                  type="number"
                  value={settings.maxDailyLoss}
                  onChange={(e) => updateSettings({ maxDailyLoss: parseFloat(e.target.value) || 5 })}
                  className="input"
                  style={{ width: 80, padding: "0.25rem 0.5rem", fontSize: "0.875rem" }}
                  min={0.1}
                  step={0.5}
                  disabled={loading}
                />
              </div>

              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <label style={{ fontSize: "0.875rem" }}>Max Position Size ($)</label>
                <input
                  type="number"
                  value={settings.maxPositionSize}
                  onChange={(e) => updateSettings({ maxPositionSize: parseFloat(e.target.value) || 3 })}
                  className="input"
                  style={{ width: 80, padding: "0.25rem 0.5rem", fontSize: "0.875rem" }}
                  min={0.1}
                  step={0.5}
                  disabled={loading}
                />
              </div>

              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <label style={{ fontSize: "0.875rem" }}>Max Open Positions</label>
                <input
                  type="number"
                  value={settings.maxOpenPositions}
                  onChange={(e) => updateSettings({ maxOpenPositions: parseInt(e.target.value) || 5 })}
                  className="input"
                  style={{ width: 80, padding: "0.25rem 0.5rem", fontSize: "0.875rem" }}
                  min={1}
                  max={20}
                  disabled={loading}
                />
              </div>

              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <label style={{ fontSize: "0.875rem" }}>Max Drawdown (%)</label>
                <input
                  type="number"
                  value={settings.maxDrawdownPercent}
                  onChange={(e) => updateSettings({ maxDrawdownPercent: parseFloat(e.target.value) || 20 })}
                  className="input"
                  style={{ width: 80, padding: "0.25rem 0.5rem", fontSize: "0.875rem" }}
                  min={1}
                  max={100}
                  disabled={loading}
                />
              </div>
            </div>

            {/* Trading limits */}
            <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
              <h4 style={{ margin: 0, fontSize: "0.875rem", color: "var(--text-secondary)" }}>Trading Limits</h4>

              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <label style={{ fontSize: "0.875rem" }}>Min Confidence (%)</label>
                <input
                  type="number"
                  value={Math.round(settings.minConfidence * 100)}
                  onChange={(e) => updateSettings({ minConfidence: (parseInt(e.target.value) || 50) / 100 })}
                  className="input"
                  style={{ width: 80, padding: "0.25rem 0.5rem", fontSize: "0.875rem" }}
                  min={0}
                  max={100}
                  disabled={loading}
                />
              </div>

              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <label style={{ fontSize: "0.875rem" }}>Cooldown After Loss (s)</label>
                <input
                  type="number"
                  value={settings.cooldownAfterLoss}
                  onChange={(e) => updateSettings({ cooldownAfterLoss: parseInt(e.target.value) || 30 })}
                  className="input"
                  style={{ width: 80, padding: "0.25rem 0.5rem", fontSize: "0.875rem" }}
                  min={0}
                  max={300}
                  disabled={loading}
                />
              </div>

              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <label style={{ fontSize: "0.875rem" }}>Max Trades/Hour</label>
                <input
                  type="number"
                  value={settings.maxTradesPerHour}
                  onChange={(e) => updateSettings({ maxTradesPerHour: parseInt(e.target.value) || 60 })}
                  className="input"
                  style={{ width: 80, padding: "0.25rem 0.5rem", fontSize: "0.875rem" }}
                  min={1}
                  max={1000}
                  disabled={loading}
                />
              </div>

              <h4 style={{ margin: "0.5rem 0 0", fontSize: "0.875rem", color: "var(--text-secondary)" }}>Portfolio Limits</h4>

              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <label style={{ fontSize: "0.875rem" }}>Max Portfolio Loss ($)</label>
                <input
                  type="number"
                  value={settings.portfolioMaxLoss}
                  onChange={(e) => updateSettings({ portfolioMaxLoss: parseFloat(e.target.value) || 10 })}
                  className="input"
                  style={{ width: 80, padding: "0.25rem 0.5rem", fontSize: "0.875rem" }}
                  min={1}
                  step={1}
                  disabled={loading}
                />
              </div>

              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <label style={{ fontSize: "0.875rem" }}>Max Portfolio Drawdown (%)</label>
                <input
                  type="number"
                  value={settings.portfolioMaxDrawdown}
                  onChange={(e) => updateSettings({ portfolioMaxDrawdown: parseFloat(e.target.value) || 25 })}
                  className="input"
                  style={{ width: 80, padding: "0.25rem 0.5rem", fontSize: "0.875rem" }}
                  min={1}
                  max={100}
                  disabled={loading}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Paused Bots */}
      {pausedBots.length > 0 && (
        <div className="glass-card" style={{ padding: "1rem", borderLeft: "4px solid #ef4444" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.75rem" }}>
            <Pause className="w-4 h-4" style={{ color: "#ef4444" }} />
            <h3 style={{ margin: 0, fontSize: "1rem", fontWeight: 600 }}>Paused Bots</h3>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            {pausedBots.map(bot => (
              <div key={bot.id} style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "0.5rem",
                background: "var(--glass-bg)",
                borderRadius: 6
              }}>
                <div>
                  <span style={{ fontWeight: 500 }}>{bot.name}</span>
                  <p style={{ margin: 0, fontSize: "0.75rem", color: "#ef4444" }}>
                    {bot.status.pauseReason}
                  </p>
                </div>
                <button
                  onClick={() => resumeBot(bot.id)}
                  className="quick-btn"
                  style={{ display: "flex", alignItems: "center", gap: "0.25rem", color: "#22c55e" }}
                >
                  <Play className="w-3 h-3" />
                  Resume
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Warnings */}
      {activeWarnings.length > 0 && (
        <div className="glass-card" style={{ padding: "1rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.75rem" }}>
            <AlertTriangle className="w-4 h-4" style={{ color: "#f59e0b" }} />
            <h3 style={{ margin: 0, fontSize: "1rem", fontWeight: 600 }}>Recent Warnings</h3>
            <span className="badge badge-primary" style={{ fontSize: "0.625rem" }}>{activeWarnings.length}</span>
          </div>
          <div style={{ maxHeight: 200, overflowY: "auto", display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            {activeWarnings.slice(0, 10).map((warning, i) => (
              <div key={i} style={{
                display: "flex",
                alignItems: "center",
                gap: "0.5rem",
                padding: "0.5rem",
                background: "var(--glass-bg)",
                borderRadius: 6,
                borderLeft: `3px solid ${getSeverityColor(warning.severity)}`
              }}>
                <AlertTriangle className="w-3 h-3" style={{ color: getSeverityColor(warning.severity) }} />
                <div style={{ flex: 1 }}>
                  <span style={{ fontWeight: 500, fontSize: "0.875rem" }}>{warning.message}</span>
                  <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                    {warning.botId} • {getTypeLabel(warning.type)} • {new Date(warning.timestamp).toLocaleTimeString()}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Bot Risk Status */}
      <div className="glass-card" style={{ padding: "1rem" }}>
        <h3 style={{ margin: "0 0 0.75rem", fontSize: "1rem", fontWeight: 600 }}>Bot Risk Status</h3>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.875rem" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid var(--border)" }}>
                <th style={{ textAlign: "left", padding: "0.5rem", color: "var(--text-muted)", fontWeight: 500 }}>Bot</th>
                <th style={{ textAlign: "right", padding: "0.5rem", color: "var(--text-muted)", fontWeight: 500 }}>Daily P&L</th>
                <th style={{ textAlign: "right", padding: "0.5rem", color: "var(--text-muted)", fontWeight: 500 }}>Drawdown</th>
                <th style={{ textAlign: "right", padding: "0.5rem", color: "var(--text-muted)", fontWeight: 500 }}>Trades</th>
                <th style={{ textAlign: "center", padding: "0.5rem", color: "var(--text-muted)", fontWeight: 500 }}>Status</th>
                <th style={{ textAlign: "center", padding: "0.5rem", color: "var(--text-muted)", fontWeight: 500 }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {botRisks.map(bot => (
                <tr key={bot.id} style={{ borderBottom: "1px solid var(--border)" }}>
                  <td style={{ padding: "0.5rem", fontWeight: 500 }}>{bot.name}</td>
                  <td style={{
                    padding: "0.5rem",
                    textAlign: "right",
                    fontFamily: "ui-monospace, monospace",
                    color: bot.status.dailyPnL >= 0 ? "#22c55e" : "#ef4444"
                  }}>
                    {bot.status.dailyPnL >= 0 ? "+" : ""}${bot.status.dailyPnL.toFixed(2)}
                  </td>
                  <td style={{
                    padding: "0.5rem",
                    textAlign: "right",
                    fontFamily: "ui-monospace, monospace",
                    color: bot.status.currentDrawdown > settings.maxDrawdownPercent * 0.8 ? "#ef4444" : "var(--text-primary)"
                  }}>
                    {bot.status.currentDrawdown.toFixed(1)}%
                  </td>
                  <td style={{ padding: "0.5rem", textAlign: "right", fontFamily: "ui-monospace, monospace" }}>
                    {bot.status.tradesToday}
                  </td>
                  <td style={{ padding: "0.5rem", textAlign: "center" }}>
                    <span style={{
                      padding: "0.125rem 0.5rem",
                      borderRadius: 4,
                      fontSize: "0.75rem",
                      background: bot.status.paused ? "rgba(239, 68, 68, 0.2)" : "rgba(34, 197, 94, 0.2)",
                      color: bot.status.paused ? "#ef4444" : "#22c55e"
                    }}>
                      {bot.status.paused ? "PAUSED" : "ACTIVE"}
                    </span>
                  </td>
                  <td style={{ padding: "0.5rem", textAlign: "center" }}>
                    {bot.status.paused ? (
                      <button
                        onClick={() => resumeBot(bot.id)}
                        className="quick-btn"
                        style={{ fontSize: "0.75rem", color: "#22c55e" }}
                      >
                        Resume
                      </button>
                    ) : (
                      <span style={{ color: "var(--text-muted)", fontSize: "0.75rem" }}>-</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
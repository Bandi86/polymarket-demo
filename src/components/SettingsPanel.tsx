'use client'

// Settings Panel - API key configuration and trading settings
import { useState, useEffect, useCallback } from "react";
import { Settings, Key, Wallet, Save, Eye, EyeOff, CheckCircle, AlertCircle, ExternalLink, DollarSign, RefreshCw, Shield } from "lucide-react";
import { toast } from "@/components/ui/toast";

interface PolymarketKeys {
  apiKey: string;
  apiSecret: string;
  apiPassphrase: string;
}

interface SettingsState {
  polymarket: PolymarketKeys;
  walletAddress: string;
  maxBalance: number;
  requireConfirmation: boolean;
  paperTradingHours: number;
  defaultStartBalance: number;
  tradingMode: "demo" | "live";
  riskSettings: {
    maxPositionSizePercent: number;
    kellyFraction: number;
    maxDailyLossPercent: number;
    maxDrawdownPercent: number;
    maxOpenPositions: number;
    autoReduceOnLoss: boolean;
    autoIncreaseOnWin: boolean;
    circuitBreakerEnabled: boolean;
    consecutiveLossThreshold: number;
  };
}

export function SettingsPanel() {
  const [settings, setSettings] = useState<SettingsState>({
    polymarket: {
      apiKey: "",
      apiSecret: "",
      apiPassphrase: "",
    },
    walletAddress: "",
    maxBalance: 100,
    requireConfirmation: true,
    paperTradingHours: 24,
    defaultStartBalance: 10,
    tradingMode: "demo",
    riskSettings: {
      maxPositionSizePercent: 5,
      kellyFraction: 0.25,
      maxDailyLossPercent: 5,
      maxDrawdownPercent: 20,
      maxOpenPositions: 3,
      autoReduceOnLoss: true,
      autoIncreaseOnWin: true,
      circuitBreakerEnabled: true,
      consecutiveLossThreshold: 5,
    },
  });
  const [showSecrets, setShowSecrets] = useState(false);
  const [saving, setSaving] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<"unknown" | "connected" | "error">("unknown");
  const [settingBalance, setSettingBalance] = useState(false);

  const fetchSettings = useCallback(async () => {
    try {
      // Fetch general settings
      const settingsRes = await fetch("/api/settings");
      const settingsData = await settingsRes.json();
      
      // Fetch account info (trading mode)
      const accountRes = await fetch("/api/account");
      const accountData = await accountRes.json();
      
      // Fetch risk settings
      const riskRes = await fetch("/api/risk/settings");
      const riskData = await riskRes.json();
      
      setSettings(prev => ({
        ...prev,
        ...settingsData,
        tradingMode: accountData.mode || "demo",
        riskSettings: {
          maxPositionSizePercent: riskData.maxPositionSize || riskData.maxDailyLoss || 5,
          kellyFraction: 0.25,
          maxDailyLossPercent: riskData.maxDailyLoss || 5,
          maxDrawdownPercent: riskData.maxDrawdownPercent || 20,
          maxOpenPositions: riskData.maxOpenPositions || 3,
          autoReduceOnLoss: true,
          autoIncreaseOnWin: true,
          circuitBreakerEnabled: true,
          consecutiveLossThreshold: riskData.consecutiveLossThreshold || 5,
        },
      }));
    } catch (err) {
      console.error("Failed to fetch settings:", err);
    }
  }, []);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const saveSettings = async () => {
    setSaving(true);
    try {
      // Save trading mode
      await fetch("/api/trading-mode", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: settings.tradingMode === "live" ? "real" : "simulated" }),
      });
      
      // Save risk settings
      await fetch("/api/risk/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          maxDailyLoss: settings.riskSettings.maxDailyLossPercent,
          maxDrawdownPercent: settings.riskSettings.maxDrawdownPercent,
          maxOpenPositions: settings.riskSettings.maxOpenPositions,
          consecutiveLossThreshold: settings.riskSettings.consecutiveLossThreshold,
          autoReduceOnLoss: settings.riskSettings.autoReduceOnLoss,
          autoIncreaseOnWin: settings.riskSettings.autoIncreaseOnWin,
          circuitBreakerEnabled: settings.riskSettings.circuitBreakerEnabled,
        }),
      });
      
      // Save general settings
      await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          defaultStartBalance: settings.defaultStartBalance,
          polymarket: settings.polymarket,
          walletAddress: settings.walletAddress,
        }),
      });
      
      toast.success("Settings Saved", "Your trading and risk settings have been updated");
    } catch (err) {
      console.error("Failed to save settings:", err);
      toast.error("Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  const testConnection = async () => {
    setConnectionStatus("unknown");
    try {
      const res = await fetch("/api/polymarket/test-connection", {
        method: "POST",
      });
      const data = await res.json();
      setConnectionStatus(data.success ? "connected" : "error");
    } catch (err) {
      setConnectionStatus("error");
    }
  };

  const updatePolymarketKey = (key: keyof PolymarketKeys, value: string) => {
    setSettings(prev => ({
      ...prev,
      polymarket: { ...prev.polymarket, [key]: value },
    }));
  };

  const setAllBotsBalance = async (balance: number) => {
    setSettingBalance(true);
    try {
      const res = await fetch("/api/balance/set-all", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ balance }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success("Balance Updated", `Set all bots to $${balance}`);
      } else {
        toast.error("Failed to update balance");
      }
    } catch (err) {
      toast.error("Failed to update balance");
    } finally {
      setSettingBalance(false);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      {/* Header */}
      <div className="glass-card" style={{ padding: "1rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <Settings className="w-5 h-5" style={{ color: "var(--primary)" }} />
          <span style={{ fontWeight: 600, fontSize: "1.125rem" }}>Settings</span>
        </div>
        <p style={{ margin: "0.5rem 0 0", fontSize: "0.875rem", color: "var(--text-muted)" }}>
          Configure your Polymarket API keys and trading preferences.
        </p>
      </div>

      {/* Trading Mode Selector */}
      <div className="glass-card" style={{ padding: "1rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.75rem" }}>
          <Wallet className="w-4 h-4" style={{ color: "var(--primary)" }} />
          <span style={{ fontWeight: 600 }}>Trading Mode</span>
          <span style={{
            fontSize: "0.625rem",
            padding: "0.125rem 0.5rem",
            borderRadius: 999,
            background: settings.tradingMode === "live" ? "rgba(239, 68, 68, 0.2)" : "rgba(34, 197, 94, 0.2)",
            color: settings.tradingMode === "live" ? "#ef4444" : "#22c55e",
            fontWeight: 600,
            textTransform: "uppercase",
          }}>
            {settings.tradingMode}
          </span>
        </div>

        <div style={{ display: "flex", gap: "0.5rem" }}>
          <button
            onClick={() => setSettings(prev => ({ ...prev, tradingMode: "demo" }))}
            style={{
              flex: 1,
              padding: "0.75rem",
              borderRadius: 8,
              border: settings.tradingMode === "demo" ? "2px solid #22c55e" : "1px solid var(--border)",
              background: settings.tradingMode === "demo" ? "rgba(34, 197, 94, 0.1)" : "transparent",
              cursor: "pointer",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: "0.25rem",
            }}
          >
            <span style={{ fontWeight: 600, color: settings.tradingMode === "demo" ? "#22c55e" : "var(--text-primary)" }}>🧪 Demo</span>
            <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>Simulated trading</span>
          </button>
          <button
            onClick={() => setSettings(prev => ({ ...prev, tradingMode: "live" }))}
            style={{
              flex: 1,
              padding: "0.75rem",
              borderRadius: 8,
              border: settings.tradingMode === "live" ? "2px solid #ef4444" : "1px solid var(--border)",
              background: settings.tradingMode === "live" ? "rgba(239, 68, 68, 0.1)" : "transparent",
              cursor: "pointer",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: "0.25rem",
            }}
          >
            <span style={{ fontWeight: 600, color: settings.tradingMode === "live" ? "#ef4444" : "var(--text-primary)" }}>⚡ Live</span>
            <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>Real money trading</span>
          </button>
        </div>

        {settings.tradingMode === "live" && (
          <div style={{
            marginTop: "0.75rem",
            padding: "0.75rem",
            background: "rgba(239, 68, 68, 0.1)",
            borderRadius: 8,
            border: "1px solid rgba(239, 68, 68, 0.3)",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", color: "#ef4444", fontWeight: 600, fontSize: "0.875rem" }}>
              ⚠️ Warning: Real trading is enabled
            </div>
            <p style={{ margin: "0.5rem 0 0", fontSize: "0.75rem", color: "var(--text-muted)" }}>
              Make sure your API keys have trading permissions. Start with small amounts.
            </p>
          </div>
        )}
      </div>

      {/* Risk Management Settings */}
      <div className="glass-card" style={{ padding: "1rem" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.75rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <Shield className="w-4 h-4" style={{ color: "var(--primary)" }} />
            <span style={{ fontWeight: 600 }}>Risk Management</span>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
          {/* Max Position Size */}
          <div>
            <label style={{ display: "block", fontSize: "0.75rem", color: "var(--text-muted)", marginBottom: "0.25rem" }}>
              Max Position Size (%)
            </label>
            <input
              type="number"
              value={settings.riskSettings.maxPositionSizePercent}
              onChange={(e) => setSettings(prev => ({ 
                ...prev, 
                riskSettings: { ...prev.riskSettings, maxPositionSizePercent: parseFloat(e.target.value) || 5 }
              }))}
              className="input"
              style={{ width: "100%", padding: "0.5rem" }}
              min={0.5}
              max={50}
              step={0.5}
            />
          </div>

          {/* Kelly Fraction */}
          <div>
            <label style={{ display: "block", fontSize: "0.75rem", color: "var(--text-muted)", marginBottom: "0.25rem" }}>
              Kelly Fraction
            </label>
            <input
              type="number"
              value={settings.riskSettings.kellyFraction}
              onChange={(e) => setSettings(prev => ({ 
                ...prev, 
                riskSettings: { ...prev.riskSettings, kellyFraction: parseFloat(e.target.value) || 0.25 }
              }))}
              className="input"
              style={{ width: "100%", padding: "0.5rem" }}
              min={0.05}
              max={1}
              step={0.05}
            />
          </div>

          {/* Max Daily Loss */}
          <div>
            <label style={{ display: "block", fontSize: "0.75rem", color: "var(--text-muted)", marginBottom: "0.25rem" }}>
              Max Daily Loss (%)
            </label>
            <input
              type="number"
              value={settings.riskSettings.maxDailyLossPercent}
              onChange={(e) => setSettings(prev => ({ 
                ...prev, 
                riskSettings: { ...prev.riskSettings, maxDailyLossPercent: parseFloat(e.target.value) || 5 }
              }))}
              className="input"
              style={{ width: "100%", padding: "0.5rem" }}
              min={1}
              max={50}
              step={1}
            />
          </div>

          {/* Max Drawdown */}
          <div>
            <label style={{ display: "block", fontSize: "0.75rem", color: "var(--text-muted)", marginBottom: "0.25rem" }}>
              Max Drawdown (%)
            </label>
            <input
              type="number"
              value={settings.riskSettings.maxDrawdownPercent}
              onChange={(e) => setSettings(prev => ({ 
                ...prev, 
                riskSettings: { ...prev.riskSettings, maxDrawdownPercent: parseFloat(e.target.value) || 20 }
              }))}
              className="input"
              style={{ width: "100%", padding: "0.5rem" }}
              min={5}
              max={50}
              step={1}
            />
          </div>

          {/* Max Open Positions */}
          <div>
            <label style={{ display: "block", fontSize: "0.75rem", color: "var(--text-muted)", marginBottom: "0.25rem" }}>
              Max Open Positions
            </label>
            <input
              type="number"
              value={settings.riskSettings.maxOpenPositions}
              onChange={(e) => setSettings(prev => ({ 
                ...prev, 
                riskSettings: { ...prev.riskSettings, maxOpenPositions: parseInt(e.target.value) || 3 }
              }))}
              className="input"
              style={{ width: "100%", padding: "0.5rem" }}
              min={1}
              max={10}
            />
          </div>

          {/* Consecutive Loss Threshold */}
          <div>
            <label style={{ display: "block", fontSize: "0.75rem", color: "var(--text-muted)", marginBottom: "0.25rem" }}>
              Stop After X Losses
            </label>
            <input
              type="number"
              value={settings.riskSettings.consecutiveLossThreshold}
              onChange={(e) => setSettings(prev => ({ 
                ...prev, 
                riskSettings: { ...prev.riskSettings, consecutiveLossThreshold: parseInt(e.target.value) || 5 }
              }))}
              className="input"
              style={{ width: "100%", padding: "0.5rem" }}
              min={1}
              max={20}
            />
          </div>
        </div>

        {/* Auto-adjustment toggles */}
        <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", marginTop: "0.75rem" }}>
          <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", cursor: "pointer" }}>
            <input
              type="checkbox"
              checked={settings.riskSettings.autoReduceOnLoss}
              onChange={(e) => setSettings(prev => ({ 
                ...prev, 
                riskSettings: { ...prev.riskSettings, autoReduceOnLoss: e.target.checked }
              }))}
            />
            <span style={{ fontSize: "0.875rem" }}>Auto-reduce bet size after losses</span>
          </label>
          <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", cursor: "pointer" }}>
            <input
              type="checkbox"
              checked={settings.riskSettings.autoIncreaseOnWin}
              onChange={(e) => setSettings(prev => ({ 
                ...prev, 
                riskSettings: { ...prev.riskSettings, autoIncreaseOnWin: e.target.checked }
              }))}
            />
            <span style={{ fontSize: "0.875rem" }}>Auto-increase bet size after wins</span>
          </label>
          <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", cursor: "pointer" }}>
            <input
              type="checkbox"
              checked={settings.riskSettings.circuitBreakerEnabled}
              onChange={(e) => setSettings(prev => ({ 
                ...prev, 
                riskSettings: { ...prev.riskSettings, circuitBreakerEnabled: e.target.checked }
              }))}
            />
            <span style={{ fontSize: "0.875rem" }}>Enable circuit breaker (stop after consecutive losses)</span>
          </label>
        </div>
      </div>

      {/* Polymarket API Keys */}
      <div className="glass-card" style={{ padding: "1rem" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.75rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <Key className="w-4 h-4" style={{ color: "var(--primary)" }} />
            <span style={{ fontWeight: 600 }}>Polymarket API Keys</span>
          </div>
          <button
            onClick={() => setShowSecrets(!showSecrets)}
            className="quick-btn"
            style={{ display: "flex", alignItems: "center", gap: "0.25rem" }}
          >
            {showSecrets ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
            {showSecrets ? "Hide" : "Show"}
          </button>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
          <div>
            <label style={{ display: "block", fontSize: "0.75rem", color: "var(--text-muted)", marginBottom: "0.25rem" }}>
              API Key
            </label>
            <input
              type={showSecrets ? "text" : "password"}
              value={settings.polymarket.apiKey}
              onChange={(e) => updatePolymarketKey("apiKey", e.target.value)}
              placeholder="Enter your Polymarket API key"
              className="input"
              style={{ width: "100%", padding: "0.5rem" }}
            />
          </div>

          <div>
            <label style={{ display: "block", fontSize: "0.75rem", color: "var(--text-muted)", marginBottom: "0.25rem" }}>
              API Secret
            </label>
            <input
              type={showSecrets ? "text" : "password"}
              value={settings.polymarket.apiSecret}
              onChange={(e) => updatePolymarketKey("apiSecret", e.target.value)}
              placeholder="Enter your Polymarket API secret"
              className="input"
              style={{ width: "100%", padding: "0.5rem" }}
            />
          </div>

          <div>
            <label style={{ display: "block", fontSize: "0.75rem", color: "var(--text-muted)", marginBottom: "0.25rem" }}>
              API Passphrase
            </label>
            <input
              type={showSecrets ? "text" : "password"}
              value={settings.polymarket.apiPassphrase}
              onChange={(e) => updatePolymarketKey("apiPassphrase", e.target.value)}
              placeholder="Enter your Polymarket API passphrase"
              className="input"
              style={{ width: "100%", padding: "0.5rem" }}
            />
          </div>
        </div>

        <div style={{ marginTop: "0.75rem", fontSize: "0.75rem", color: "var(--text-muted)" }}>
          <a
            href="https://polymarket.com/portfolio"
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: "var(--primary)", display: "inline-flex", alignItems: "center", gap: "0.25rem" }}
          >
            Get your API keys from Polymarket <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      </div>

      {/* Wallet Settings */}
      <div className="glass-card" style={{ padding: "1rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.75rem" }}>
          <Wallet className="w-4 h-4" style={{ color: "var(--primary)" }} />
          <span style={{ fontWeight: 600 }}>Wallet Settings</span>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
          <div>
            <label style={{ display: "block", fontSize: "0.75rem", color: "var(--text-muted)", marginBottom: "0.25rem" }}>
              Wallet Address
            </label>
            <input
              type="text"
              value={settings.walletAddress}
              onChange={(e) => setSettings(prev => ({ ...prev, walletAddress: e.target.value }))}
              placeholder="0x..."
              className="input"
              style={{ width: "100%", padding: "0.5rem", fontFamily: "ui-monospace, monospace" }}
            />
          </div>

          <div>
            <label style={{ display: "block", fontSize: "0.75rem", color: "var(--text-muted)", marginBottom: "0.25rem" }}>
              Max Balance to Use ($)
            </label>
            <input
              type="number"
              value={settings.maxBalance}
              onChange={(e) => setSettings(prev => ({ ...prev, maxBalance: parseFloat(e.target.value) || 0 }))}
              className="input"
              style={{ width: "100%", padding: "0.5rem" }}
              min={1}
            />
          </div>
        </div>
      </div>

      {/* Demo Balance Settings */}
      <div className="glass-card" style={{ padding: "1rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.75rem" }}>
          <DollarSign className="w-4 h-4" style={{ color: "var(--primary)" }} />
          <span style={{ fontWeight: 600 }}>Demo Balance</span>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
          <div>
            <label style={{ display: "block", fontSize: "0.75rem", color: "var(--text-muted)", marginBottom: "0.25rem" }}>
              Default Starting Balance ($)
            </label>
            <div style={{ display: "flex", gap: "0.5rem" }}>
              <input
                type="number"
                value={settings.defaultStartBalance}
                onChange={(e) => setSettings(prev => ({ ...prev, defaultStartBalance: parseFloat(e.target.value) || 10 }))}
                className="input"
                style={{ width: "100%", padding: "0.5rem" }}
                min={1}
                step={1}
              />
              <button
                onClick={() => setAllBotsBalance(settings.defaultStartBalance)}
                disabled={settingBalance}
                className="trade-btn up"
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.25rem",
                  padding: "0.5rem 1rem",
                  whiteSpace: "nowrap",
                }}
              >
                {settingBalance ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <RefreshCw className="w-4 h-4" />
                )}
                Set All
              </button>
            </div>
          </div>

          <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
            Click "Set All" to update all bots to this balance immediately.
            Individual bot balances can be adjusted in the Monitor tab.
          </div>

          {/* Quick preset buttons */}
          <div style={{ display: "flex", gap: "0.25rem", flexWrap: "wrap" }}>
            {[10, 25, 50, 100, 250, 500].map(val => (
              <button
                key={val}
                onClick={() => {
                  setSettings(prev => ({ ...prev, defaultStartBalance: val }));
                  setAllBotsBalance(val);
                }}
                disabled={settingBalance}
                style={{
                  padding: "0.375rem 0.75rem",
                  borderRadius: 6,
                  fontSize: "0.75rem",
                  fontWeight: 500,
                  background: settings.defaultStartBalance === val ? "var(--primary)" : "var(--glass-bg)",
                  color: settings.defaultStartBalance === val ? "white" : "var(--text-muted)",
                  border: "1px solid var(--border)",
                  cursor: "pointer",
                  transition: "all 0.2s",
                }}
              >
                ${val}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Safety Settings */}
      <div className="glass-card" style={{ padding: "1rem" }}>
        <span style={{ fontWeight: 600 }}>Safety Settings</span>

        <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem", marginTop: "0.75rem" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <label style={{ fontSize: "0.875rem" }}>Require Confirmation for Each Trade</label>
            <input
              type="checkbox"
              checked={settings.requireConfirmation}
              onChange={(e) => setSettings(prev => ({ ...prev, requireConfirmation: e.target.checked }))}
              style={{ width: 18, height: 18 }}
            />
          </div>

          <div>
            <label style={{ display: "block", fontSize: "0.75rem", color: "var(--text-muted)", marginBottom: "0.25rem" }}>
              Minimum Paper Trading Hours Before Real
            </label>
            <input
              type="number"
              value={settings.paperTradingHours}
              onChange={(e) => setSettings(prev => ({ ...prev, paperTradingHours: parseInt(e.target.value) || 0 }))}
              className="input"
              style={{ width: "100%", padding: "0.5rem" }}
              min={0}
            />
          </div>
        </div>
      </div>

      {/* Actions */}
      <div style={{ display: "flex", gap: "0.5rem" }}>
        <button
          onClick={testConnection}
          className="quick-btn"
          style={{ display: "flex", alignItems: "center", gap: "0.25rem", flex: 1 }}
        >
          {connectionStatus === "connected" ? (
            <CheckCircle className="w-4 h-4" style={{ color: "#22c55e" }} />
          ) : connectionStatus === "error" ? (
            <AlertCircle className="w-4 h-4" style={{ color: "#ef4444" }} />
          ) : null}
          Test Connection
        </button>
        <button
          onClick={saveSettings}
          disabled={saving}
          className="trade-btn up"
          style={{ display: "flex", alignItems: "center", gap: "0.25rem", flex: 1 }}
        >
          <Save className="w-4 h-4" />
          {saving ? "Saving..." : "Save Settings"}
        </button>
      </div>
    </div>
  );
}
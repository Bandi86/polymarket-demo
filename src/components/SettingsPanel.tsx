// Settings Panel - API key configuration and trading settings
import { useState, useEffect, useCallback } from "react";
import { Settings, Key, Wallet, Save, Eye, EyeOff, CheckCircle, AlertCircle, ExternalLink, DollarSign, RefreshCw } from "lucide-react";
import { toast } from "./ui/toast";

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
  });
  const [showSecrets, setShowSecrets] = useState(false);
  const [saving, setSaving] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<"unknown" | "connected" | "error">("unknown");
  const [settingBalance, setSettingBalance] = useState(false);

  const fetchSettings = useCallback(async () => {
    try {
      const res = await fetch("/api/settings");
      const data = await res.json();
      setSettings(prev => ({ ...prev, ...data }));
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
      await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
    } catch (err) {
      console.error("Failed to save settings:", err);
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
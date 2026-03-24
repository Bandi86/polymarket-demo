'use client'

// Trading Mode Toggle - Switch between Demo and Live trading
import { useState } from "react";
import { FlaskConical, Zap, AlertTriangle, Shield } from "lucide-react";

interface TradingModeToggleProps {
  currentMode: "demo" | "live";
  onModeChange: (mode: "demo" | "live") => Promise<void>;
  liveBalance: number;
  hasWallet: boolean;
  hasApiKey: boolean;
  isDisabled?: boolean;
}

export function TradingModeToggle({
  currentMode,
  onModeChange,
  liveBalance,
  hasWallet,
  hasApiKey,
  isDisabled = false,
}: TradingModeToggleProps) {
  const [loading, setLoading] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const canGoLive = hasWallet && hasApiKey;

  const requestModeChange = async (newMode: "demo" | "live") => {
    if (newMode === currentMode) return;
    if (isDisabled) return;

    // Show warning when switching to live
    if (newMode === "live" && currentMode !== "live") {
      setShowConfirm(true);
      return;
    }

    await changeMode(newMode);
  };

  const changeMode = async (newMode: "demo" | "live") => {
    setLoading(true);
    setShowConfirm(false);

    try {
      await onModeChange(newMode);
    } catch (err) {
      console.error("Failed to change mode:", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {/* Main Toggle */}
      <div style={{
        display: "inline-flex",
        alignItems: "center",
        padding: "0.25rem",
        background: "var(--glass-bg)",
        borderRadius: 12,
        border: `2px solid ${currentMode === "live" ? "#ef4444" : "var(--border)"}`,
        boxShadow: currentMode === "live" ? "0 0 20px rgba(239, 68, 68, 0.3)" : "none",
      }}>
        {/* Demo Button */}
        <button
          onClick={() => requestModeChange("demo")}
          disabled={loading || currentMode === "demo" || isDisabled}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.5rem",
            padding: "0.5rem 1rem",
            borderRadius: 8,
            background: currentMode === "demo" ? "var(--primary)" : "transparent",
            color: currentMode === "demo" ? "white" : "var(--text-muted)",
            border: "none",
            fontWeight: 600,
            fontSize: "0.875rem",
            cursor: currentMode === "demo" || isDisabled ? "default" : "pointer",
            transition: "all 0.2s",
          }}
        >
          <FlaskConical className="w-4 h-4" />
          DEMO
        </button>

        {/* Live Button */}
        <button
          onClick={() => requestModeChange("live")}
          disabled={loading || currentMode === "live" || !canGoLive || isDisabled}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.5rem",
            padding: "0.5rem 1rem",
            borderRadius: 8,
            background: currentMode === "live" ? "#ef4444" : "transparent",
            color: currentMode === "live" ? "white" : canGoLive ? "var(--text-muted)" : "var(--text-muted)",
            border: "none",
            fontWeight: 600,
            fontSize: "0.875rem",
            cursor: currentMode === "live" || !canGoLive || isDisabled ? "default" : "pointer",
            opacity: canGoLive ? 1 : 0.5,
            transition: "all 0.2s",
          }}
          title={!canGoLive ? "Connect wallet and configure API to enable live mode" : ""}
        >
          <Zap className="w-4 h-4" />
          LIVE
        </button>
      </div>

      {/* Confirmation Modal for Live Mode */}
      {showConfirm && (
        <div style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0, 0, 0, 0.85)",
          backdropFilter: "blur(10px)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 200,
          padding: "1rem",
        }}>
          <div style={{
            background: "var(--bg)",
            border: "2px solid #ef4444",
            borderRadius: 16,
            padding: "2rem",
            maxWidth: 440,
            width: "100%",
            boxShadow: "0 0 60px rgba(239, 68, 68, 0.3)",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "1.25rem" }}>
              <div style={{
                padding: "0.75rem",
                background: "rgba(239, 68, 68, 0.2)",
                borderRadius: 12,
              }}>
                <AlertTriangle className="w-8 h-8" style={{ color: "#ef4444" }} />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: "1.25rem", fontWeight: 700 }}>Switch to Live Mode?</h3>
                <p style={{ margin: 0, color: "#ef4444", fontSize: "0.875rem", fontWeight: 600 }}>Real money trading</p>
              </div>
            </div>

            <div style={{
              padding: "1rem",
              background: "var(--glass-bg)",
              borderRadius: 12,
              marginBottom: "1.5rem",
              border: "1px solid var(--border)",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.75rem" }}>
                <Shield className="w-4 h-4" style={{ color: "#f59e0b" }} />
                <span style={{ fontWeight: 600, fontSize: "0.875rem" }}>Important Notice</span>
              </div>
              <ul style={{ margin: 0, paddingLeft: "1.25rem", color: "var(--text-secondary)", fontSize: "0.875rem", lineHeight: 1.6 }}>
                <li>Bots will trade with <strong style={{ color: "#ef4444" }}>real USDC</strong> from your Polymarket account</li>
                <li>Losses are <strong>permanent</strong> and cannot be recovered</li>
                <li>Current live balance: <strong style={{ color: "#22c55e" }}>${liveBalance.toFixed(2)}</strong></li>
                <li>Start with small amounts to test strategies</li>
              </ul>
            </div>

            <div style={{
              padding: "0.75rem",
              background: "rgba(239, 68, 68, 0.1)",
              borderRadius: 8,
              marginBottom: "1.5rem",
              border: "1px solid rgba(239, 68, 68, 0.3)",
            }}>
              <p style={{ margin: 0, color: "#ef4444", fontSize: "0.875rem", fontWeight: 500 }}>
                ⚠️ Only enable live mode if you have thoroughly tested your strategies in demo mode.
              </p>
            </div>

            <div style={{ display: "flex", gap: "0.75rem" }}>
              <button
                onClick={() => setShowConfirm(false)}
                style={{
                  flex: 1,
                  padding: "0.875rem",
                  borderRadius: 10,
                  background: "var(--glass-bg)",
                  border: "1px solid var(--border)",
                  color: "var(--text-primary)",
                  fontWeight: 600,
                  fontSize: "0.875rem",
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>
              <button
                onClick={() => changeMode("live")}
                style={{
                  flex: 1,
                  padding: "0.875rem",
                  borderRadius: 10,
                  background: "#ef4444",
                  border: "none",
                  color: "white",
                  fontWeight: 600,
                  fontSize: "0.875rem",
                  cursor: "pointer",
                  boxShadow: "0 4px 15px rgba(239, 68, 68, 0.4)",
                }}
              >
                Yes, Enable Live Mode
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
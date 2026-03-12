// Trading Mode Toggle - Switch between Simulation and Real trading
import { useState, useEffect, useCallback } from "react";
import { Zap, AlertTriangle, Shield, CheckCircle } from "lucide-react";

interface TradingMode {
  mode: "simulation" | "paper" | "real";
  balance: number;
  requiresConfirmation: boolean;
  testModeHours: number;
}

export function TradingModeToggle() {
  const [mode, setMode] = useState<TradingMode>({
    mode: "simulation",
    balance: 100,
    requiresConfirmation: true,
    testModeHours: 0,
  });
  const [loading, setLoading] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [pendingMode, setPendingMode] = useState<"simulation" | "paper" | "real">("simulation");

  const fetchMode = useCallback(async () => {
    try {
      const res = await fetch("/api/trading-mode");
      const data = await res.json();
      setMode(data);
    } catch (err) {
      console.error("Failed to fetch trading mode:", err);
    }
  }, []);

  useEffect(() => {
    fetchMode();
  }, [fetchMode]);

  const requestModeChange = (newMode: "simulation" | "paper" | "real") => {
    if (newMode === "real" && mode.mode !== "real") {
      setPendingMode(newMode);
      setShowConfirm(true);
    } else {
      changeMode(newMode);
    }
  };

  const changeMode = async (newMode: "simulation" | "paper" | "real") => {
    setLoading(true);
    setShowConfirm(false);

    try {
      const res = await fetch("/api/trading-mode", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: newMode }),
      });

      const data = await res.json();
      if (data.success) {
        setMode(prev => ({ ...prev, mode: newMode }));
      }
    } catch (err) {
      console.error("Failed to change mode:", err);
    } finally {
      setLoading(false);
    }
  };

  const getModeConfig = () => {
    switch (mode.mode) {
      case "simulation":
        return {
          color: "#3b82f6",
          label: "Simulation",
          description: "Virtual trading with simulated markets",
          icon: Zap,
        };
      case "paper":
        return {
          color: "#f59e0b",
          label: "Paper Trading",
          description: "Real markets with virtual money",
          icon: Shield,
        };
      case "real":
        return {
          color: "#22c55e",
          label: "Real Trading",
          description: "Real markets with real money",
          icon: CheckCircle,
        };
    }
  };

  const config = getModeConfig();
  const Icon = config.icon;

  return (
    <div className="glass-card" style={{ padding: "1rem" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.75rem" }}>
        <span style={{ fontWeight: 600 }}>Trading Mode</span>
        <div style={{
          display: "flex",
          alignItems: "center",
          gap: "0.5rem",
          padding: "0.25rem 0.75rem",
          background: `${config.color}20`,
          borderRadius: 9999,
          color: config.color,
          fontSize: "0.875rem",
          fontWeight: 500,
        }}>
          <Icon className="w-4 h-4" />
          {config.label}
        </div>
      </div>

      <p style={{ margin: "0 0 0.75rem", fontSize: "0.875rem", color: "var(--text-muted)" }}>
        {config.description}
      </p>

      {/* Mode selector */}
      <div style={{ display: "flex", gap: "0.5rem" }}>
        <button
          onClick={() => requestModeChange("simulation")}
          disabled={loading || mode.mode === "simulation"}
          className={`quick-btn ${mode.mode === "simulation" ? "active" : ""}`}
          style={{
            flex: 1,
            opacity: mode.mode === "simulation" ? 1 : 0.7,
          }}
        >
          <Zap className="w-3 h-3" />
          Simulation
        </button>
        <button
          onClick={() => requestModeChange("paper")}
          disabled={loading || mode.mode === "paper"}
          className={`quick-btn ${mode.mode === "paper" ? "active" : ""}`}
          style={{
            flex: 1,
            opacity: mode.mode === "paper" ? 1 : 0.7,
          }}
        >
          <Shield className="w-3 h-3" />
          Paper
        </button>
        <button
          onClick={() => requestModeChange("real")}
          disabled={loading || mode.mode === "real"}
          className={`quick-btn ${mode.mode === "real" ? "active" : ""}`}
          style={{
            flex: 1,
            opacity: mode.mode === "real" ? 1 : 0.7,
            color: mode.mode === "real" ? "#22c55e" : undefined,
          }}
        >
          <CheckCircle className="w-3 h-3" />
          Real
        </button>
      </div>

      {/* Warning for real mode */}
      {mode.mode === "real" && (
        <div style={{
          marginTop: "0.75rem",
          padding: "0.5rem",
          background: "rgba(34, 197, 94, 0.1)",
          borderRadius: 6,
          border: "1px solid rgba(34, 197, 94, 0.2)",
          fontSize: "0.75rem",
        }}>
          <strong>Real trading enabled.</strong> All trades use actual funds from your connected wallet.
        </div>
      )}

      {/* Confirmation Modal */}
      {showConfirm && (
        <div style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: "rgba(0, 0, 0, 0.5)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 1000,
        }}>
          <div className="glass-card" style={{
            padding: "1.5rem",
            maxWidth: 400,
            margin: "1rem",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "1rem" }}>
              <AlertTriangle className="w-6 h-6" style={{ color: "#ef4444" }} />
              <span style={{ fontWeight: 600, fontSize: "1.125rem" }}>Enable Real Trading?</span>
            </div>

            <p style={{ margin: "0 0 1rem", color: "var(--text-secondary)", fontSize: "0.875rem" }}>
              Real trading uses actual funds from your wallet. Only enable this if you understand the risks and have tested your strategies thoroughly.
            </p>

            <div style={{
              padding: "0.75rem",
              background: "rgba(239, 68, 68, 0.1)",
              borderRadius: 6,
              marginBottom: "1rem",
              fontSize: "0.75rem",
            }}>
              <strong>Requirements:</strong>
              <ul style={{ margin: "0.5rem 0 0", paddingLeft: "1rem" }}>
                <li>Connected Polymarket wallet</li>
                <li>Minimum recommended test hours: 24h</li>
                <li>Verified strategy performance</li>
              </ul>
            </div>

            <div style={{ display: "flex", gap: "0.5rem" }}>
              <button
                onClick={() => setShowConfirm(false)}
                className="quick-btn"
                style={{ flex: 1 }}
              >
                Cancel
              </button>
              <button
                onClick={() => changeMode(pendingMode)}
                className="trade-btn up"
                style={{ flex: 1 }}
              >
                I Understand - Enable
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
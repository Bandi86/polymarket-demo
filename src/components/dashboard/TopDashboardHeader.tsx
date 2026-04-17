import { Zap, AlertTriangle, Plus, Loader2, ShieldAlert, Check, Users, HelpCircle } from "lucide-react";
import { useState, useEffect } from "react";
import { toast } from "@/components/ui/toast";
import { AccountManagerModal } from "@/components/AccountManagerModal";
import { PaymentGuideModal } from "@/components/PaymentGuideModal";
import { PriceTicker } from "@/components/ui/PriceTicker";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { SoundToggle } from "@/components/ui/SoundToggle";
import { WalletButton } from "@/components/WalletButton";
import { TradingModeToggle } from "@/components/TradingModeToggle";
import { NotificationCenter } from "@/components/NotificationCenter";
import { ASSETS, TIMEFRAMES } from "@/components/dashboard";
import type { LiveBalance } from "@/hooks/useTradingData";

interface TopDashboardHeaderProps {
  coinColor: string;
  selectedAsset: string;
  onAssetChange: (asset: string) => void;
  selectedTimeframe: string;
  onTimeframeChange: (tf: string) => void;
  tradingMode: "demo" | "live";
  onModeChange?: (mode: "demo" | "live") => Promise<void>;
  setTradingMode?: (mode: "demo" | "live") => void;
  liveBalance?: LiveBalance;
  onRefreshLiveBalance?: () => Promise<void>;
  isBotRunning: boolean;
  soundEnabled: boolean;
  onToggleSound: () => void;
  onDepositClick: () => void;
  risk: { level: 'low' | 'medium' | 'high'; color: string; label: string };
}

export function TopDashboardHeader({
  coinColor,
  selectedAsset,
  onAssetChange,
  selectedTimeframe,
  onTimeframeChange,
  tradingMode,
  onModeChange,
  setTradingMode,
  liveBalance,
  isBotRunning,
  soundEnabled,
  onToggleSound,
  onDepositClick,
  risk,
}: TopDashboardHeaderProps) {
  const hasPrivateKey = liveBalance?.hasPrivateKey ?? false;
  const hasCredentials = liveBalance?.hasCredentials ?? false;
  const walletAddress = liveBalance?.walletAddress;

  const [isApproved, setIsApproved] = useState<boolean | null>(null);
  const [isApproving, setIsApproving] = useState(false);
  const [showAccountModal, setShowAccountModal] = useState(false);
  const [showPaymentGuide, setShowPaymentGuide] = useState(false);

  // Check approvals on load and mode change
  useEffect(() => {
    if (tradingMode === "live" && hasPrivateKey) {
      checkApprovals();
    } else {
      setIsApproved(null);
    }
  }, [tradingMode, hasPrivateKey]);

  const checkApprovals = async () => {
    try {
      const res = await fetch("/api/account/approvals");
      const data = await res.json();
      if (data.success) {
        setIsApproved(data.isApproved);
      }
    } catch (e) {
      console.error("Failed to check approvals", e);
    }
  };

  const handleApprove = async () => {
    setIsApproving(true);
    try {
      const res = await fetch("/api/account/approvals", { method: "POST" });
      const data = await res.json();
      if (data.success) {
        toast.success("Contracts approved successfully", "You can now trade in Live mode");
        setIsApproved(true);
      } else {
        toast.error("Failed to approve contracts", data.error || "Ensure you have MATIC for gas");
      }
    } catch (e) {
      toast.error("Network error during approval");
    } finally {
      setIsApproving(false);
    }
  };

  const getConnectionStatus = () => {
    if (tradingMode === "demo") return null;
    if (hasPrivateKey) return { color: "#22c55e", label: "Connected", short: "OK" };
    if (hasCredentials) return { color: "#f59e0b", label: "Partial", short: "?" };
    return { color: "#ef4444", label: "No Key", short: "X" };
  };

  const connectionStatus = getConnectionStatus();

  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "2rem" }}>
        {/* Logo + Mode Badge */}
        <div style={{ fontSize: "1.25rem", fontWeight: 700, display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <Zap style={{ color: coinColor }} className="w-5 h-5" />
          <span>Poly</span><span style={{ color: "var(--primary)" }}>Trade</span>

          {/* Trading Mode Toggle */}
          {onModeChange && (
            <TradingModeToggle
              currentMode={tradingMode}
              onModeChange={onModeChange}
              liveBalance={liveBalance?.balance || 0}
              hasWallet={!!liveBalance?.hasCredentials}
              hasApiKey={!!liveBalance?.hasPrivateKey}
              isDisabled={isBotRunning}
            />
          )}

          {/* Connection Status Badge (only in live mode) */}
          {tradingMode === "live" && connectionStatus && (
            <div
              title={`Wallet: ${walletAddress || "Unknown"}\nStatus: ${connectionStatus.label}`}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.4rem",
                padding: "0.3rem 0.6rem",
                background: `${connectionStatus.color}20`,
                border: `1px solid ${connectionStatus.color}40`,
                borderRadius: 6,
                cursor: "help",
              }}
            >
              <span
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: "50%",
                  background: connectionStatus.color,
                  boxShadow: `0 0 6px ${connectionStatus.color}`,
                }}
              />
              <span style={{ fontSize: "0.7rem", fontWeight: 600, color: connectionStatus.color }}>
                {connectionStatus.short}
              </span>
            </div>
          )}

          {/* Approvals Warning */}
          {tradingMode === "live" && isApproved === false && (
            <button
              onClick={handleApprove}
              disabled={isApproving}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.4rem",
                padding: "0.3rem 0.75rem",
                background: "rgba(245, 158, 11, 0.15)",
                border: "1px solid rgba(245, 158, 11, 0.4)",
                borderRadius: 8,
                cursor: isApproving ? "not-allowed" : "pointer",
                color: "#f59e0b",
                fontSize: "0.75rem",
                fontWeight: 600,
              }}
              title="You must approve Polymarket contracts to trade. Costs MATIC."
            >
              {isApproving ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldAlert className="w-4 h-4" />}
              {isApproving ? "Approving..." : "Approve Contracts"}
            </button>
          )}

          {/* Account Manager Button - always visible to add/manage accounts */}
          {true && (
            <button
              onClick={() => setShowAccountModal(true)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.4rem",
                padding: "0.4rem 0.75rem",
                background: "var(--glass-bg)",
                border: "1px solid var(--border)",
                borderRadius: 8,
                cursor: "pointer",
                color: "var(--text-primary)",
                fontSize: "0.875rem",
                fontWeight: 600,
              }}
            >
              <Users className="w-4 h-4" style={{ color: "var(--primary)" }} />
              Accounts
            </button>
          )}

          {/* Missing Keys Warning */}
          {tradingMode === "live" && !hasPrivateKey && (
            <div style={{
              display: "flex", alignItems: "center", gap: "0.4rem",
              padding: "0.4rem 0.75rem", background: "rgba(239, 68, 68, 0.15)",
              border: "1px solid rgba(239, 68, 68, 0.4)", borderRadius: 8, color: "#ef4444",
              fontSize: "0.75rem", fontWeight: 600
            }}>
              <AlertTriangle className="w-4 h-4" />
              Missing Private Key
            </div>
          )}

          {/* Live Balance Display */}
          {tradingMode === "live" && hasPrivateKey && liveBalance && (
            <div style={{ display: "flex", gap: "0.5rem" }}>
              <div style={{
                display: "flex",
                alignItems: "center",
                gap: "0.5rem",
                padding: "0.3rem 0.75rem",
                background: liveBalance.balance > 0 ? "rgba(34, 197, 94, 0.15)" : "rgba(239, 68, 68, 0.15)",
                border: `1px solid ${liveBalance.balance > 0 ? "rgba(34, 197, 94, 0.3)" : "rgba(239, 68, 68, 0.3)"}`,
                borderRadius: 8,
              }}>
                <span style={{ fontSize: "0.7rem", color: "var(--text-muted)" }} title="Available for bot trading on the CLOB">Trading:</span>
                <span style={{
                  fontSize: "0.9rem",
                  fontWeight: 700,
                  fontFamily: "ui-monospace, monospace",
                  color: liveBalance.balance > 0 ? "#22c55e" : "#ef4444",
                }}>
                  ${liveBalance.balance.toFixed(2)}
                </span>
              </div>
              {liveBalance.onChainValue !== undefined && liveBalance.onChainValue >= 0 && (
                <div style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.5rem",
                  padding: "0.3rem 0.75rem",
                  background: "rgba(59, 130, 246, 0.15)",
                  border: "1px solid rgba(59, 130, 246, 0.3)",
                  borderRadius: 8,
                }}>
                  <span style={{ fontSize: "0.7rem", color: "var(--text-muted)" }} title="Total on-chain value (USDC + CTF)">Wallet:</span>
                  <span style={{
                    fontSize: "0.9rem",
                    fontWeight: 700,
                    fontFamily: "ui-monospace, monospace",
                    color: "#3b82f6",
                  }}>
                    ${liveBalance.onChainValue.toFixed(2)}
                  </span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Asset & Timeframe Selectors */}
        <div style={{ display: "flex", alignItems: "center", gap: "1rem", background: "var(--glass-bg)", padding: "0.25rem", borderRadius: "8px", border: "1px solid var(--border)" }}>
          <div style={{ display: "flex", gap: "0.25rem" }}>
            {ASSETS.map(asset => (
              <button
                key={asset}
                onClick={() => onAssetChange(asset)}
                style={{
                  padding: "0.25rem 0.5rem",
                  borderRadius: 4,
                  fontSize: "0.75rem",
                  fontWeight: selectedAsset === asset ? 700 : 500,
                  background: selectedAsset === asset ? `${coinColor}20` : "transparent",
                  color: selectedAsset === asset ? coinColor : "var(--text-muted)",
                  border: "none",
                  cursor: "pointer",
                }}
              >
                {asset}
              </button>
            ))}
          </div>
          <div style={{ width: 1, height: 16, background: "var(--border)" }} />
          <div style={{ display: "flex", gap: "0.25rem" }}>
            {TIMEFRAMES.map(tf => (
              <button
                key={tf.id}
                onClick={() => onTimeframeChange(tf.id)}
                style={{
                  padding: "0.25rem 0.5rem",
                  borderRadius: 4,
                  fontSize: "0.75rem",
                  fontWeight: selectedTimeframe === tf.id ? 700 : 500,
                  background: selectedTimeframe === tf.id ? "var(--primary)" : "transparent",
                  color: selectedTimeframe === tf.id ? "white" : "var(--text-muted)",
                  border: "none",
                  cursor: "pointer",
                }}
              >
                {tf.label}
              </button>
            ))}
          </div>
        </div>

        {/* Price Ticker */}
        <PriceTicker className="hidden xl:flex" />
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
        {/* Risk Meter */}
        {isBotRunning && (
          <div style={{
            display: "flex",
            alignItems: "center",
            gap: "0.5rem",
            padding: "0.25rem 0.75rem",
            borderRadius: 999,
            background: `${risk.color}15`,
            border: `1px solid ${risk.color}30`,
          }}>
            <AlertTriangle style={{ width: 14, height: 14, color: risk.color }} />
            <span style={{ fontSize: "0.75rem", fontWeight: 600, color: risk.color }}>
              {risk.label}
            </span>
          </div>
        )}

        {/* Wallet Button */}
        <WalletButton />

        {/* Deposit Button */}
        <button
          onClick={onDepositClick}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.375rem",
            padding: "0.5rem 0.75rem",
            borderRadius: 8,
            background: "var(--glass-bg)",
            border: "1px solid var(--border)",
            color: "var(--text-primary)",
            fontWeight: 500,
            fontSize: "0.75rem",
            cursor: "pointer",
          }}
        >
          <Plus className="w-4 h-4" />
          Deposit
        </button>

        {/* Help/Guide Button */}
        <button
          onClick={() => setShowPaymentGuide(true)}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.375rem",
            padding: "0.5rem 0.75rem",
            borderRadius: 8,
            background: "linear-gradient(135deg, rgba(99, 102, 241, 0.2), rgba(139, 92, 246, 0.2))",
            border: "1px solid rgba(139, 92, 246, 0.3)",
            color: "#a78bfa",
            fontWeight: 500,
            fontSize: "0.75rem",
            cursor: "pointer",
          }}
          title="Pénzügyi útmutató"
        >
          <HelpCircle className="w-4 h-4" />
          Guide
        </button>

        <SoundToggle enabled={soundEnabled} onToggle={onToggleSound} />
        <NotificationCenter />
        <ThemeToggle />
      </div>

      {showAccountModal && (
        <AccountManagerModal
          onClose={() => setShowAccountModal(false)}
          onAccountSwitched={() => {
            if (onModeChange) onModeChange("live");
            window.location.reload();
          }}
        />
      )}

      {showPaymentGuide && (
        <PaymentGuideModal
          isOpen={showPaymentGuide}
          onClose={() => setShowPaymentGuide(false)}
        />
      )}
    </div>
  );
}
import { Zap, AlertTriangle, Plus } from "lucide-react";
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

        <SoundToggle enabled={soundEnabled} onToggle={onToggleSound} />
        <NotificationCenter />
        <ThemeToggle />
      </div>
    </div>
  );
}
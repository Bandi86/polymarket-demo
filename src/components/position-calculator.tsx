import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import { Calculator, AlertTriangle, TrendingUp, TrendingDown, Info } from "lucide-react";

interface PositionSizeCalculatorProps {
  accountBalance: number;
  entryPrice: number;
  stopLossPrice?: number;
  riskPercent?: number;
  maxRiskPercent?: number;
  onCalculate?: (result: PositionSizeResult) => void;
}

interface PositionSizeResult {
  positionSize: number;
  riskAmount: number;
  shares: number;
  riskRewardRatio?: number;
}

export function PositionSizeCalculator({
  accountBalance,
  entryPrice,
  stopLossPrice,
  riskPercent = 1,
  maxRiskPercent = 5,
  onCalculate,
}: PositionSizeCalculatorProps) {
  const [risk, setRisk] = useState(riskPercent);
  const [stopLoss, setStopLoss] = useState(stopLossPrice?.toString() || "");

  const result = useMemo<PositionSizeResult>(() => {
    const riskAmount = (accountBalance * risk) / 100;
    const stopLossValue = parseFloat(stopLoss) || entryPrice * 0.95; // Default 5% stop loss
    
    const priceDiff = Math.abs(entryPrice - stopLossValue);
    const positionSize = priceDiff > 0 ? riskAmount / priceDiff : 0;
    const shares = Math.floor(positionSize / entryPrice);

    const riskRewardRatio = stopLossPrice ? 
      Math.abs(entryPrice - stopLossPrice) > 0 ? 
        Math.abs((entryPrice - stopLossPrice)) / Math.abs(entryPrice - stopLossPrice) : 
        undefined : 
      undefined;

    return {
      positionSize,
      riskAmount,
      shares,
      riskRewardRatio,
    };
  }, [accountBalance, entryPrice, risk, stopLoss, stopLossPrice]);

  const isRiskHigh = risk > maxRiskPercent;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-sm font-medium text-[var(--color-text-primary)]">
        <Calculator className="w-4 h-4" />
        Position Size Calculator
      </div>

      <div className="grid grid-cols-2 gap-3">
        {/* Risk Percent */}
        <div className="space-y-1">
          <label className="text-xs text-[var(--color-text-secondary)]">
            Risk % of Account
          </label>
          <div className="relative">
            <input
              type="number"
              value={risk}
              onChange={(e) => setRisk(parseFloat(e.target.value) || 0)}
              min={0.1}
              max={100}
              step={0.1}
              className="w-full px-3 py-2 rounded-lg bg-[var(--color-surface)] border border-[var(--color-border)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-[var(--color-text-muted)]">
              %
            </span>
          </div>
          {isRiskHigh && (
            <motion.div
              initial={{ opacity: 0, y: -5 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-center gap-1 text-xs text-amber-400"
            >
              <AlertTriangle className="w-3 h-3" />
              High risk level
            </motion.div>
          )}
        </div>

        {/* Stop Loss Price */}
        <div className="space-y-1">
          <label className="text-xs text-[var(--color-text-secondary)]">
            Stop Loss Price
          </label>
          <input
            type="number"
            value={stopLoss}
            onChange={(e) => setStopLoss(e.target.value)}
            placeholder={(entryPrice * 0.95).toFixed(3)}
            step={0.001}
            className="w-full px-3 py-2 rounded-lg bg-[var(--color-surface)] border border-[var(--color-border)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
          />
        </div>
      </div>

      {/* Results */}
      <div className="p-3 rounded-lg bg-[var(--color-surface)] border border-[var(--color-border)] space-y-2">
        <div className="flex justify-between items-center">
          <span className="text-xs text-[var(--color-text-secondary)]">Position Size</span>
          <motion.span
            key={result.positionSize}
            initial={{ scale: 1.1 }}
            animate={{ scale: 1 }}
            className="font-mono text-sm font-medium"
          >
            ${result.positionSize.toFixed(2)}
          </motion.span>
        </div>
        
        <div className="flex justify-between items-center">
          <span className="text-xs text-[var(--color-text-secondary)]">Risk Amount</span>
          <span className="font-mono text-sm">${result.riskAmount.toFixed(2)}</span>
        </div>
        
        <div className="flex justify-between items-center">
          <span className="text-xs text-[var(--color-text-secondary)]">Shares/Units</span>
          <span className="font-mono text-sm">{result.shares}</span>
        </div>
      </div>

      {/* Quick Risk Presets */}
      <div className="flex gap-2">
        {[0.5, 1, 2, 3].map((preset) => (
          <button
            key={preset}
            onClick={() => setRisk(preset)}
            className={`flex-1 py-1.5 text-xs rounded-lg transition-colors ${
              risk === preset
                ? "bg-[var(--color-primary)] text-white"
                : "bg-[var(--color-surface)] text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-hover)]"
            }`}
          >
            {preset}%
          </button>
        ))}
      </div>
    </div>
  );
}

// Risk management settings
interface RiskManagementSettings {
  maxDailyLoss: number;
  maxPositionSize: number;
  maxOpenPositions: number;
  circuitBreakerEnabled: boolean;
  circuitBreakerThreshold: number;
}

interface RiskManagementProps {
  settings: RiskManagementSettings;
  onUpdateSettings: (settings: Partial<RiskManagementSettings>) => void;
  currentLoss?: number;
  openPositions?: number;
}

export function RiskManagementPanel({
  settings,
  onUpdateSettings,
  currentLoss = 0,
  openPositions = 0,
}: RiskManagementProps) {
  const isDailyLossExceeded = currentLoss >= settings.maxDailyLoss;
  const isMaxPositionsExceeded = openPositions >= settings.maxOpenPositions;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-sm font-medium text-[var(--color-text-primary)]">
        <TrendingUp className="w-4 h-4" />
        Risk Management
      </div>

      <div className="space-y-3">
        {/* Max Daily Loss */}
        <div className="space-y-1">
          <div className="flex justify-between items-center">
            <label className="text-xs text-[var(--color-text-secondary)]">
              Max Daily Loss
            </label>
            {isDailyLossExceeded && (
              <span className="text-xs text-red-400 flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" />
                Exceeded!
              </span>
            )}
          </div>
          <input
            type="number"
            value={settings.maxDailyLoss}
            onChange={(e) => onUpdateSettings({ maxDailyLoss: parseFloat(e.target.value) || 0 })}
            min={0}
            step={10}
            className="w-full px-3 py-2 rounded-lg bg-[var(--color-surface)] border border-[var(--color-border)] text-sm"
          />
        </div>

        {/* Max Position Size */}
        <div className="space-y-1">
          <label className="text-xs text-[var(--color-text-secondary)]">
            Max Position Size ($)
          </label>
          <input
            type="number"
            value={settings.maxPositionSize}
            onChange={(e) => onUpdateSettings({ maxPositionSize: parseFloat(e.target.value) || 0 })}
            min={0}
            step={10}
            className="w-full px-3 py-2 rounded-lg bg-[var(--color-surface)] border border-[var(--color-border)] text-sm"
          />
        </div>

        {/* Max Open Positions */}
        <div className="space-y-1">
          <div className="flex justify-between items-center">
            <label className="text-xs text-[var(--color-text-secondary)]">
              Max Open Positions
            </label>
            <span className="text-xs text-[var(--color-text-muted)]">
              Current: {openPositions}
            </span>
          </div>
          <input
            type="number"
            value={settings.maxOpenPositions}
            onChange={(e) => onUpdateSettings({ maxOpenPositions: parseInt(e.target.value) || 1 })}
            min={1}
            max={20}
            className="w-full px-3 py-2 rounded-lg bg-[var(--color-surface)] border border-[var(--color-border)] text-sm"
          />
        </div>

        {/* Circuit Breaker */}
        <div className="flex items-center justify-between p-2 rounded-lg bg-[var(--color-surface)]">
          <div className="flex items-center gap-2">
            <span className="text-xs text-[var(--color-text-primary)]">Circuit Breaker</span>
            <Info className="w-3 h-3 text-[var(--color-text-muted)" />
          </div>
          <button
            onClick={() => onUpdateSettings({ circuitBreakerEnabled: !settings.circuitBreakerEnabled })}
            className={`w-10 h-5 rounded-full transition-colors ${
              settings.circuitBreakerEnabled ? "bg-emerald-500" : "bg-[var(--color-border)]"
            }`}
          >
            <motion.div
              className="w-4 h-4 bg-white rounded-full"
              animate={{ x: settings.circuitBreakerEnabled ? 20 : 2 }}
            />
          </button>
        </div>

        {settings.circuitBreakerEnabled && (
          <div className="space-y-1">
            <label className="text-xs text-[var(--color-text-secondary)]">
              Circuit Breaker Threshold (%)
            </label>
            <input
              type="number"
              value={settings.circuitBreakerThreshold}
              onChange={(e) => onUpdateSettings({ circuitBreakerThreshold: parseFloat(e.target.value) || 0 })}
              min={1}
              max={50}
              step={1}
              className="w-full px-3 py-2 rounded-lg bg-[var(--color-surface)] border border-[var(--color-border)] text-sm"
            />
          </div>
        )}
      </div>
    </div>
  );
}
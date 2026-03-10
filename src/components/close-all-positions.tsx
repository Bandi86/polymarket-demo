import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, AlertTriangle, CheckCircle2, Trash2 } from "lucide-react";
import type { Position } from "../types";

interface CloseAllPositionsProps {
  positions: Position[];
  onCloseAll: () => Promise<void>;
  onClosePosition: (positionId: string) => Promise<void>;
}

export function CloseAllPositionsButton({
  positions,
  onCloseAll,
  onClosePosition,
}: CloseAllPositionsProps) {
  const [showConfirm, setShowConfirm] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [selectedPositions, setSelectedPositions] = useState<Set<string>>(
    new Set(positions.map((p) => p.id))
  );

  const openPositions = positions.filter((p) => p.status === "open");
  const hasPositions = openPositions.length > 0;

  const handleCloseAll = async () => {
    setIsClosing(true);
    try {
      // Close each selected position
      const closePromises = Array.from(selectedPositions).map((id) =>
        onClosePosition(id)
      );
      await Promise.all(closePromises);
      await onCloseAll();
      setShowConfirm(false);
    } catch (error) {
      console.error("Failed to close positions:", error);
    } finally {
      setIsClosing(false);
    }
  };

  const togglePosition = (id: string) => {
    const newSelected = new Set(selectedPositions);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedPositions(newSelected);
  };

  const selectAll = () => setSelectedPositions(new Set(openPositions.map((p) => p.id)));
  const deselectAll = () => setSelectedPositions(new Set());

  const totalValue = openPositions
    .filter((p) => selectedPositions.has(p.id))
    .reduce((sum, p) => sum + (p.currentValue || p.amount), 0);

  const totalPnL = openPositions
    .filter((p) => selectedPositions.has(p.id))
    .reduce((sum, p) => sum + (p.unrealizedPnl || 0), 0);

  if (!hasPositions) {
    return (
      <button
        disabled
        className="w-full py-2 px-4 rounded-lg bg-[var(--color-surface)] text-[var(--color-text-muted)] text-sm font-medium opacity-50 cursor-not-allowed"
      >
        No Open Positions
      </button>
    );
  }

  return (
    <>
      <motion.button
        onClick={() => setShowConfirm(true)}
        className="w-full flex items-center justify-center gap-2 py-2 px-4 rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500/30 border border-red-500/30 text-sm font-medium transition-colors"
        whileHover={{ scale: 1.01 }}
        whileTap={{ scale: 0.99 }}
      >
        <Trash2 className="w-4 h-4" />
        Close All Positions ({openPositions.length})
      </motion.button>

      <AnimatePresence>
        {showConfirm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
            onClick={() => !isClosing && setShowConfirm(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-md bg-[var(--color-card)] rounded-xl border border-[var(--color-border)] shadow-2xl"
            >
              <div className="p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 rounded-full bg-red-500/20">
                    <AlertTriangle className="w-6 h-6 text-red-400" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-[var(--color-text-primary)]">
                      Close All Positions
                    </h3>
                    <p className="text-sm text-[var(--color-text-secondary)]">
                      This action cannot be undone
                    </p>
                  </div>
                </div>

                {/* Position Selection */}
                <div className="mb-4 max-h-48 overflow-y-auto space-y-2">
                  <div className="flex gap-2 mb-2">
                    <button
                      onClick={selectAll}
                      className="text-xs px-2 py-1 rounded bg-[var(--color-surface)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
                    >
                      Select All
                    </button>
                    <button
                      onClick={deselectAll}
                      className="text-xs px-2 py-1 rounded bg-[var(--color-surface)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
                    >
                      Deselect All
                    </button>
                  </div>

                  {openPositions.map((position) => (
                    <label
                      key={position.id}
                      className="flex items-center gap-3 p-2 rounded-lg bg-[var(--color-surface)] cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={selectedPositions.has(position.id)}
                        onChange={() => togglePosition(position.id)}
                        className="w-4 h-4 rounded border-[var(--color-border)]"
                      />
                      <div className="flex-1">
                        <div className="flex justify-between text-sm">
                          <span className="font-medium text-[var(--color-text-primary)]">
                            {position.outcome}
                          </span>
                          <span
                            className={
                              (position.unrealizedPnl || 0) >= 0
                                ? "text-emerald-400"
                                : "text-red-400"
                            }
                          >
                            ${(position.unrealizedPnl || 0).toFixed(2)}
                          </span>
                        </div>
                        <div className="text-xs text-[var(--color-text-muted)]">
                          ${(position.currentValue || position.amount).toFixed(2)} @{" "}
                          {position.odds.toFixed(3)}
                        </div>
                      </div>
                    </label>
                  ))}
                </div>

                {/* Summary */}
                <div className="p-3 rounded-lg bg-[var(--color-surface)] mb-4">
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-[var(--color-text-secondary)]">Total Value</span>
                    <span className="font-medium text-[var(--color-text-primary)]">
                      ${totalValue.toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-[var(--color-text-secondary)]">Total P&L</span>
                    <span
                      className={`font-medium ${
                        totalPnL >= 0 ? "text-emerald-400" : "text-red-400"
                      }`}
                    >
                      {totalPnL >= 0 ? "+" : ""}${totalPnL.toFixed(2)}
                    </span>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-3">
                  <button
                    onClick={() => setShowConfirm(false)}
                    disabled={isClosing}
                    className="flex-1 py-2.5 rounded-lg border border-[var(--color-border)] text-[var(--color-text-primary)] hover:bg-[var(--color-surface)] transition-colors disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleCloseAll}
                    disabled={isClosing || selectedPositions.size === 0}
                    className="flex-1 py-2.5 rounded-lg bg-red-500 text-white hover:bg-red-600 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {isClosing ? (
                      <motion.div
                        className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full"
                        animate={{ rotate: 360 }}
                        transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                      />
                    ) : (
                      <CheckCircle2 className="w-4 h-4" />
                    )}
                    Close {selectedPositions.size} Position
                    {selectedPositions.size !== 1 ? "s" : ""}
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

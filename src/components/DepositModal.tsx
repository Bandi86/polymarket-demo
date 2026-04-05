'use client'

import { X, AlertCircle, ExternalLink, Check, Loader2 } from "lucide-react";
import { useState } from "react";
import { useWallet } from "@/hooks/useWallet";

interface DepositModalProps {
  isOpen: boolean;
  onClose: () => void;
  polymarketBalance: number;
  onRefreshBalance: () => Promise<void>;
}

export function DepositModal({ isOpen, onClose, polymarketBalance, onRefreshBalance }: DepositModalProps) {
  const {
    address,
    usdcBalance,
    usdcAllowance,
    approveUsdc,
    isCorrectNetwork,
    switchToPolygon,
  } = useWallet();

  const [amount, setAmount] = useState(10);
  const [step, setStep] = useState<"amount" | "approving" | "done">("amount");
  const [error, setError] = useState<string | null>(null);

  const presets = [10, 50, 100, 250];

  const handleApprove = async () => {
    if (!address) return;

    setStep("approving");
    setError(null);

    try {
      const success = await approveUsdc(amount);
      if (success) {
        setStep("done");
        await onRefreshBalance();
      } else {
        setError("Approval failed. Please try again.");
        setStep("amount");
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Approval failed";
      setError(errorMessage);
      setStep("amount");
    }
  };

  if (!isOpen) return null;

  return (
    <div style={{
      position: "fixed",
      inset: 0,
      background: "rgba(0, 0, 0, 0.8)",
      backdropFilter: "blur(10px)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      zIndex: 100,
      padding: "1rem",
    }}>
      <div style={{
        background: "var(--bg)",
        border: "1px solid var(--border)",
        borderRadius: 16,
        width: "100%",
        maxWidth: 420,
        maxHeight: "90vh",
        overflow: "auto",
      }}>
        {/* Header */}
        <div style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "1rem 1.5rem",
          borderBottom: "1px solid var(--border)",
        }}>
          <h2 style={{ fontSize: "1.125rem", fontWeight: 700, margin: 0 }}>
            Deposit to Polymarket
          </h2>
          <button
            onClick={onClose}
            style={{
              background: "transparent",
              border: "none",
              cursor: "pointer",
              padding: "0.25rem",
              color: "var(--text-muted)",
            }}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div style={{ padding: "1.5rem" }}>
          {/* Wrong Network Warning */}
          {!isCorrectNetwork && (
            <div style={{
              padding: "1rem",
              background: "rgba(245, 158, 11, 0.1)",
              border: "1px solid rgba(245, 158, 11, 0.3)",
              borderRadius: 8,
              marginBottom: "1rem",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", color: "#f59e0b" }}>
                <AlertCircle className="w-4 h-4" />
                <span style={{ fontWeight: 600 }}>Wrong Network</span>
              </div>
              <p style={{ fontSize: "0.875rem", color: "var(--text-muted)", marginTop: "0.5rem", margin: "0.5rem 0 0" }}>
                Please switch to Polygon network to deposit.
              </p>
              <button
                onClick={switchToPolygon}
                style={{
                  marginTop: "0.75rem",
                  padding: "0.5rem 1rem",
                  background: "#f59e0b",
                  color: "white",
                  border: "none",
                  borderRadius: 6,
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Switch to Polygon
              </button>
            </div>
          )}

          {/* Balance Info */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginBottom: "1.5rem" }}>
            <div style={{
              padding: "1rem",
              background: "var(--glass-bg)",
              borderRadius: 12,
              border: "1px solid var(--border)",
            }}>
              <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", textTransform: "uppercase" }}>
                Wallet USDC
              </div>
              <div style={{ fontSize: "1.5rem", fontWeight: 700, marginTop: "0.25rem" }}>
                ${usdcBalance.toFixed(2)}
              </div>
            </div>
            <div style={{
              padding: "1rem",
              background: "var(--glass-bg)",
              borderRadius: 12,
              border: "1px solid var(--border)",
            }}>
              <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", textTransform: "uppercase" }}>
                Polymarket Balance
              </div>
              <div style={{ fontSize: "1.5rem", fontWeight: 700, marginTop: "0.25rem" }}>
                ${polymarketBalance.toFixed(2)}
              </div>
            </div>
          </div>

          {/* Info about deposits */}
          <div style={{
            padding: "1rem",
            background: "rgba(59, 130, 246, 0.1)",
            border: "1px solid rgba(59, 130, 246, 0.3)",
            borderRadius: 8,
            marginBottom: "1.5rem",
          }}>
            <p style={{ fontSize: "0.875rem", color: "var(--text-secondary)", margin: 0 }}>
              To trade on Polymarket, you need USDC in your Polymarket account.
              You can deposit directly through Polymarket's website.
            </p>
          </div>

          {/* Amount Selection */}
          {step === "amount" && (
            <>
              <div style={{ marginBottom: "1rem" }}>
                <label style={{ fontSize: "0.875rem", fontWeight: 600, display: "block", marginBottom: "0.5rem" }}>
                  Approve Amount
                </label>
                <div style={{ display: "flex", gap: "0.5rem", marginBottom: "0.75rem" }}>
                  {presets.map(preset => (
                    <button
                      key={preset}
                      onClick={() => setAmount(preset)}
                      style={{
                        flex: 1,
                        padding: "0.5rem",
                        borderRadius: 6,
                        background: amount === preset ? "var(--primary)" : "var(--glass-bg)",
                        color: amount === preset ? "white" : "var(--text-primary)",
                        border: "1px solid var(--border)",
                        fontWeight: 600,
                        cursor: "pointer",
                      }}
                    >
                      ${preset}
                    </button>
                  ))}
                </div>
                <input
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(Number(e.target.value))}
                  placeholder="Custom amount"
                  style={{
                    width: "100%",
                    padding: "0.75rem",
                    borderRadius: 8,
                    background: "var(--glass-bg)",
                    border: "1px solid var(--border)",
                    color: "var(--text-primary)",
                    fontSize: "1rem",
                  }}
                />
              </div>

              {/* Insufficient Balance Warning */}
              {amount > usdcBalance && (
                <div style={{
                  padding: "0.75rem",
                  background: "rgba(239, 68, 68, 0.1)",
                  border: "1px solid rgba(239, 68, 68, 0.3)",
                  borderRadius: 8,
                  marginBottom: "1rem",
                  color: "#ef4444",
                  fontSize: "0.875rem",
                  display: "flex",
                  alignItems: "center",
                  gap: "0.5rem",
                }}>
                  <AlertCircle className="w-4 h-4" />
                  Insufficient USDC balance in wallet
                </div>
              )}

              {/* Action Buttons */}
              <div style={{ display: "flex", gap: "0.75rem" }}>
                <button
                  onClick={handleApprove}
                  disabled={amount > usdcBalance || !isCorrectNetwork}
                  style={{
                    flex: 1,
                    padding: "0.75rem 1.5rem",
                    borderRadius: 8,
                    background: "linear-gradient(135deg, #22c55e, #16a34a)",
                    color: "white",
                    border: "none",
                    fontWeight: 600,
                    cursor: amount > usdcBalance || !isCorrectNetwork ? "not-allowed" : "pointer",
                    opacity: amount > usdcBalance || !isCorrectNetwork ? 0.5 : 1,
                  }}
                >
                  Approve ${amount} USDC
                </button>
              </div>

              {/* Link to Polymarket */}
              <div style={{ marginTop: "1rem", textAlign: "center" }}>
                <a
                  href="https://polymarket.com/portfolio"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    color: "var(--primary)",
                    fontSize: "0.875rem",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "0.25rem",
                  }}
                >
                  Deposit on Polymarket.com
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </>
          )}

          {/* Approving State */}
          {step === "approving" && (
            <div style={{ textAlign: "center", padding: "2rem 0" }}>
              <Loader2 className="w-12 h-12 animate-spin" style={{ color: "var(--primary)", margin: "0 auto" }} />
              <p style={{ marginTop: "1rem", color: "var(--text-secondary)" }}>
                Approving USDC...<br />
                <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                  Please confirm the transaction in MetaMask
                </span>
              </p>
            </div>
          )}

          {/* Done State */}
          {step === "done" && (
            <div style={{ textAlign: "center", padding: "2rem 0" }}>
              <div style={{
                width: 64,
                height: 64,
                borderRadius: "50%",
                background: "rgba(34, 197, 94, 0.2)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                margin: "0 auto",
              }}>
                <Check className="w-8 h-8" style={{ color: "#22c55e" }} />
              </div>
              <p style={{ marginTop: "1rem", fontWeight: 600, color: "#22c55e" }}>
                Approval Successful!
              </p>
              <p style={{ color: "var(--text-muted)", fontSize: "0.875rem" }}>
                You can now trade on Polymarket with your approved USDC.
              </p>
              <button
                onClick={onClose}
                style={{
                  marginTop: "1.5rem",
                  padding: "0.75rem 2rem",
                  background: "var(--primary)",
                  color: "white",
                  border: "none",
                  borderRadius: 8,
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Done
              </button>
            </div>
          )}

          {/* Error */}
          {error && (
            <div style={{
              marginTop: "1rem",
              padding: "0.75rem",
              background: "rgba(239, 68, 68, 0.1)",
              border: "1px solid rgba(239, 68, 68, 0.3)",
              borderRadius: 8,
              color: "#ef4444",
              fontSize: "0.875rem",
            }}>
              {error}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
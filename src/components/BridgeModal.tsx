'use client'

import { X, AlertCircle, ExternalLink, Check, Loader2, Copy, RefreshCw, ArrowDownLeft, ArrowUpRight, Wallet } from "lucide-react";
import { useState, useEffect } from "react";
import { useWallet } from "@/hooks/useWallet";

interface BridgeModalProps {
  isOpen: boolean;
  onClose: () => void;
  polymarketBalance: number;
  onRefreshBalance: () => Promise<void>;
  mode: "deposit" | "withdraw";
}

interface ChainInfo {
  name: string;
  symbol: string;
  icon: string;
  color: string;
}

interface DepositAddresses {
  evm: string;
  svm: string;
  btc: string;
}

export function BridgeModal({ isOpen, onClose, polymarketBalance, onRefreshBalance, mode }: BridgeModalProps) {
  const { address, usdcBalance, isCorrectNetwork, switchToPolygon } = useWallet();

  const [depositAddresses, setDepositAddresses] = useState<DepositAddresses | null>(null);
  const [chains, setChains] = useState<Record<string, ChainInfo>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedAddress, setCopiedAddress] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");

  useEffect(() => {
    if (isOpen && mode === "deposit") {
      fetchDepositInfo();
    }
  }, [isOpen, mode]);

  const fetchDepositInfo = async () => {
    if (!address) return;

    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/bridge?action=deposit`);
      const data = await res.json();

      if (data.success) {
        setDepositAddresses(data.addresses);
        setChains(data.chains);
      } else {
        setError(data.error || "Failed to fetch deposit addresses");
      }
    } catch (err) {
      setError("Failed to fetch deposit addresses");
    } finally {
      setLoading(false);
    }
  };

  const copyAddress = async (address: string, type: string) => {
    try {
      await navigator.clipboard.writeText(address);
      setCopiedAddress(type);
      setTimeout(() => setCopiedAddress(null), 2000);
    } catch {
      setError("Failed to copy address");
    }
  };

  const openInExplorer = (address: string, type: "evm" | "btc" | "svm") => {
    let url = "";
    if (type === "evm") {
      url = `https://polygonscan.com/address/${address}`;
    } else if (type === "btc") {
      url = `https://blockstream.info/address/${address}`;
    } else if (type === "svm") {
      url = `https://solscan.io/address/${address}`;
    }
    if (url) window.open(url, "_blank");
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
        maxWidth: 500,
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
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            {mode === "deposit" ? (
              <ArrowDownLeft className="w-5 h-5" style={{ color: "#22c55e" }} />
            ) : (
              <ArrowUpRight className="w-5 h-5" style={{ color: "#f59e0b" }} />
            )}
            <h2 style={{ fontSize: "1.125rem", fontWeight: 700, margin: 0 }}>
              {mode === "deposit" ? "Deposit to Polymarket" : "Withdraw from Polymarket"}
            </h2>
          </div>
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
          {/* Balance Info */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginBottom: "1.5rem" }}>
            <div style={{
              padding: "1rem",
              background: "var(--glass-bg)",
              borderRadius: 12,
              border: "1px solid var(--border)",
            }}>
              <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", textTransform: "uppercase", display: "flex", alignItems: "center", gap: "0.25rem" }}>
                <Wallet className="w-3 h-3" />
                Wallet {mode === "deposit" ? "USDC" : "Balance"}
              </div>
              <div style={{ fontSize: "1.5rem", fontWeight: 700, marginTop: "0.25rem" }}>
                ${mode === "deposit" ? (usdcBalance ?? 0).toFixed(2) : polymarketBalance.toFixed(2)}
              </div>
            </div>
            <div style={{
              padding: "1rem",
              background: "var(--glass-bg)",
              borderRadius: 12,
              border: "1px solid var(--border)",
            }}>
              <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", textTransform: "uppercase", display: "flex", alignItems: "center", gap: "0.25rem" }}>
                <Wallet className="w-3 h-3" />
                Polymarket
              </div>
              <div style={{ fontSize: "1.5rem", fontWeight: 700, marginTop: "0.25rem" }}>
                ${(polymarketBalance ?? 0).toFixed(2)}
              </div>
            </div>
          </div>

          {loading && (
            <div style={{ textAlign: "center", padding: "2rem" }}>
              <Loader2 className="w-8 h-8 animate-spin" style={{ margin: "0 auto", color: "var(--primary)" }} />
              <p style={{ marginTop: "1rem", color: "var(--text-muted)" }}>Loading...</p>
            </div>
          )}

          {error && (
            <div style={{
              padding: "1rem",
              background: "rgba(239, 68, 68, 0.1)",
              border: "1px solid rgba(239, 68, 68, 0.3)",
              borderRadius: 8,
              marginBottom: "1rem",
              color: "#ef4444",
            }}>
              {error}
            </div>
          )}

          {/* Deposit Addresses */}
          {mode === "deposit" && depositAddresses && !loading && (
            <>
              <div style={{
                padding: "1rem",
                background: "rgba(59, 130, 246, 0.1)",
                border: "1px solid rgba(59, 130, 246, 0.3)",
                borderRadius: 8,
                marginBottom: "1.5rem",
              }}>
                <p style={{ fontSize: "0.875rem", color: "var(--text-secondary)", margin: 0 }}>
                  <strong style={{ color: "#3b82f6" }}>How to deposit:</strong> Send USDC to any of the addresses below from your wallet or exchange.
                  Transactions typically complete in 1-5 minutes.
                </p>
              </div>

              {/* EVM Address */}
              <div style={{ marginBottom: "1rem" }}>
                <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginBottom: "0.25rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
                  <span style={{ color: chains["137"]?.color || "#8247E5" }}>⬡</span>
                  Polygon (Recommended)
                </div>
                <div style={{
                  display: "flex",
                  gap: "0.5rem",
                  alignItems: "center",
                }}>
                  <code style={{
                    flex: 1,
                    padding: "0.75rem",
                    background: "var(--glass-bg)",
                    borderRadius: 8,
                    border: "1px solid var(--border)",
                    fontSize: "0.8rem",
                    fontFamily: "monospace",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}>
                    {depositAddresses.evm}
                  </code>
                  <button
                    onClick={() => copyAddress(depositAddresses.evm, "evm")}
                    style={{
                      padding: "0.5rem",
                      background: "var(--glass-bg)",
                      border: "1px solid var(--border)",
                      borderRadius: 6,
                      cursor: "pointer",
                      color: copiedAddress === "evm" ? "#22c55e" : "var(--text-muted)",
                    }}
                  >
                    {copiedAddress === "evm" ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  </button>
                  <button
                    onClick={() => openInExplorer(depositAddresses.evm, "evm")}
                    style={{
                      padding: "0.5rem",
                      background: "var(--glass-bg)",
                      border: "1px solid var(--border)",
                      borderRadius: 6,
                      cursor: "pointer",
                      color: "var(--text-muted)",
                    }}
                  >
                    <ExternalLink className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Solana Address */}
              <div style={{ marginBottom: "1rem" }}>
                <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginBottom: "0.25rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
                  <span style={{ color: "#14F195" }}>◎</span>
                  Solana
                </div>
                <div style={{
                  display: "flex",
                  gap: "0.5rem",
                  alignItems: "center",
                }}>
                  <code style={{
                    flex: 1,
                    padding: "0.75rem",
                    background: "var(--glass-bg)",
                    borderRadius: 8,
                    border: "1px solid var(--border)",
                    fontSize: "0.75rem",
                    fontFamily: "monospace",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}>
                    {depositAddresses.svm}
                  </code>
                  <button
                    onClick={() => copyAddress(depositAddresses.svm, "svm")}
                    style={{
                      padding: "0.5rem",
                      background: "var(--glass-bg)",
                      border: "1px solid var(--border)",
                      borderRadius: 6,
                      cursor: "pointer",
                      color: copiedAddress === "svm" ? "#22c55e" : "var(--text-muted)",
                    }}
                  >
                    {copiedAddress === "svm" ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  </button>
                  <button
                    onClick={() => openInExplorer(depositAddresses.svm, "svm")}
                    style={{
                      padding: "0.5rem",
                      background: "var(--glass-bg)",
                      border: "1px solid var(--border)",
                      borderRadius: 6,
                      cursor: "pointer",
                      color: "var(--text-muted)",
                    }}
                  >
                    <ExternalLink className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Bitcoin Address */}
              <div style={{ marginBottom: "1rem" }}>
                <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginBottom: "0.25rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
                  <span style={{ color: "#F7931A" }}>₿</span>
                  Bitcoin
                </div>
                <div style={{
                  display: "flex",
                  gap: "0.5rem",
                  alignItems: "center",
                }}>
                  <code style={{
                    flex: 1,
                    padding: "0.75rem",
                    background: "var(--glass-bg)",
                    borderRadius: 8,
                    border: "1px solid var(--border)",
                    fontSize: "0.75rem",
                    fontFamily: "monospace",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}>
                    {depositAddresses.btc}
                  </code>
                  <button
                    onClick={() => copyAddress(depositAddresses.btc, "btc")}
                    style={{
                      padding: "0.5rem",
                      background: "var(--glass-bg)",
                      border: "1px solid var(--border)",
                      borderRadius: 6,
                      cursor: "pointer",
                      color: copiedAddress === "btc" ? "#22c55e" : "var(--text-muted)",
                    }}
                  >
                    {copiedAddress === "btc" ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  </button>
                  <button
                    onClick={() => openInExplorer(depositAddresses.btc, "btc")}
                    style={{
                      padding: "0.5rem",
                      background: "var(--glass-bg)",
                      border: "1px solid var(--border)",
                      borderRadius: 6,
                      cursor: "pointer",
                      color: "var(--text-muted)",
                    }}
                  >
                    <ExternalLink className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Actions */}
              <div style={{ display: "flex", gap: "0.75rem", marginTop: "1.5rem" }}>
                <button
                  onClick={fetchDepositInfo}
                  style={{
                    flex: 1,
                    padding: "0.75rem",
                    background: "var(--glass-bg)",
                    border: "1px solid var(--border)",
                    borderRadius: 8,
                    color: "var(--text-primary)",
                    fontWeight: 600,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "0.5rem",
                  }}
                >
                  <RefreshCw className="w-4 h-4" />
                  Refresh
                </button>
                <button
                  onClick={async () => {
                    await onRefreshBalance();
                  }}
                  style={{
                    flex: 1,
                    padding: "0.75rem",
                    background: "var(--primary)",
                    border: "none",
                    borderRadius: 8,
                    color: "white",
                    fontWeight: 600,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "0.5rem",
                  }}
                >
                  <Check className="w-4 h-4" />
                  I Sent - Refresh Balance
                </button>
              </div>
            </>
          )}

          {/* Withdraw Info */}
          {mode === "withdraw" && (
            <>
              <div style={{
                padding: "1rem",
                background: "rgba(245, 158, 11, 0.1)",
                border: "1px solid rgba(245, 158, 11, 0.3)",
                borderRadius: 8,
                marginBottom: "1.5rem",
              }}>
                <p style={{ fontSize: "0.875rem", color: "var(--text-secondary)", margin: 0 }}>
                  <strong style={{ color: "#f59e0b" }}>Withdraw to external wallet:</strong> Withdraw your Polymarket balance to your external wallet (MetaMask, Phantom, etc.).
                </p>
              </div>

              <div style={{
                padding: "2rem",
                textAlign: "center",
                background: "var(--glass-bg)",
                borderRadius: 12,
                border: "1px dashed var(--border)",
              }}>
                <ArrowUpRight className="w-12 h-12" style={{ color: "var(--text-muted)", margin: "0 auto" }} />
                <p style={{ marginTop: "1rem", color: "var(--text-muted)" }}>
                  Withdraw functionality coming soon
                </p>
                <p style={{ fontSize: "0.875rem", color: "var(--text-muted)", marginTop: "0.5rem" }}>
                  For now, withdraw directly on polymarket.com
                </p>
                <a
                  href="https://polymarket.com/portfolio"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "0.5rem",
                    marginTop: "1rem",
                    padding: "0.75rem 1.5rem",
                    background: "var(--primary)",
                    color: "white",
                    borderRadius: 8,
                    fontWeight: 600,
                    textDecoration: "none",
                  }}
                >
                  Withdraw on Polymarket.com
                  <ExternalLink className="w-4 h-4" />
                </a>
              </div>
            </>
          )}

          {/* Footer */}
          <div style={{ marginTop: "1.5rem", textAlign: "center", borderTop: "1px solid var(--border)", paddingTop: "1rem" }}>
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
              View full portfolio on Polymarket.com
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}

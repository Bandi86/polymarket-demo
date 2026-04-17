'use client'

import { useState, useEffect } from "react";
import { Wallet, Plus, Trash2, Check, AlertCircle, Loader2, Copy, X } from "lucide-react";

interface Account {
  id: string;
  walletAddress: string;
  label?: string;
  isActive: boolean;
}

interface AccountsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function AccountsModal({ isOpen, onClose }: AccountsModalProps) {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [newKey, setNewKey] = useState("");
  const [newLabel, setNewLabel] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      fetchAccounts();
    }
  }, [isOpen]);

  const fetchAccounts = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/accounts");
      const data = await res.json();
      if (data.success) {
        setAccounts(data.accounts);
        setActiveId(data.activeAccountId);
      } else {
        setError(data.error);
      }
    } catch (err) {
      setError("Failed to fetch accounts");
    } finally {
      setLoading(false);
    }
  };

  const addAccount = async () => {
    if (!newKey.trim()) {
      setError("Private key is required");
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const res = await fetch("/api/accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          privateKey: newKey.trim().startsWith("0x") ? newKey.trim() : `0x${newKey.trim()}`,
          label: newLabel.trim() || undefined
        }),
      });
      const data = await res.json();

      if (data.success) {
        setNewKey("");
        setNewLabel("");
        await fetchAccounts();
      } else {
        setError(data.error);
      }
    } catch (err) {
      setError("Failed to add account");
    } finally {
      setSaving(false);
    }
  };

  const setActive = async (id: string) => {
    setSaving(true);
    try {
      const res = await fetch("/api/accounts", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      const data = await res.json();
      if (data.success) {
        setActiveId(id);
        // Reload page to reinitialize everything
        window.location.reload();
      } else {
        setError(data.error);
      }
    } catch (err) {
      setError("Failed to switch account");
    } finally {
      setSaving(false);
    }
  };

  const removeAccount = async (id: string) => {
    if (!confirm("Are you sure you want to remove this account?")) return;

    try {
      const res = await fetch(`/api/accounts?id=${id}`, { method: "DELETE" });
      const data = await res.json();
      if (data.success) {
        await fetchAccounts();
      } else {
        setError(data.error);
      }
    } catch (err) {
      setError("Failed to remove account");
    }
  };

  const copyAddress = async (addr: string) => {
    await navigator.clipboard.writeText(addr);
    setCopied(addr);
    setTimeout(() => setCopied(null), 2000);
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
            <Wallet className="w-5 h-5" style={{ color: "var(--primary)" }} />
            <h2 style={{ fontSize: "1.125rem", fontWeight: 700, margin: 0 }}>
              Manage Accounts
            </h2>
          </div>
          <button onClick={onClose} style={{ background: "transparent", border: "none", cursor: "pointer" }}>
            <X className="w-5 h-5" style={{ color: "var(--text-muted)" }} />
          </button>
        </div>

        <div style={{ padding: "1.5rem" }}>
          {loading ? (
            <div style={{ textAlign: "center", padding: "2rem" }}>
              <Loader2 className="w-8 h-8 animate-spin" style={{ margin: "0 auto", color: "var(--primary)" }} />
            </div>
          ) : accounts.length === 0 ? (
            <div style={{ textAlign: "center", padding: "2rem", color: "var(--text-muted)" }}>
              <AlertCircle className="w-12 h-12" style={{ margin: "0 auto 1rem", opacity: 0.5 }} />
              <p>No accounts configured</p>
              <p style={{ fontSize: "0.875rem" }}>Add your first account below to get started</p>
            </div>
          ) : (
            <div style={{ marginBottom: "1.5rem" }}>
              {accounts.map((acc) => (
                <div key={acc.id} style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "1rem",
                  background: acc.id === activeId ? "rgba(34, 197, 94, 0.1)" : "var(--glass-bg)",
                  border: `1px solid ${acc.id === activeId ? "rgba(34, 197, 94, 0.3)" : "var(--border)"}`,
                  borderRadius: 8,
                  marginBottom: "0.5rem",
                }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, display: "flex", alignItems: "center", gap: "0.5rem" }}>
                      {acc.label || "Wallet"}
                      {acc.id === activeId && (
                        <span style={{ fontSize: "0.75rem", color: "#22c55e", background: "rgba(34,197,94,0.2)", padding: "0.125rem 0.5rem", borderRadius: 4 }}>
                          Active
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: "0.8rem", fontFamily: "monospace", color: "var(--text-muted)", marginTop: "0.25rem" }}>
                      {acc.walletAddress.slice(0, 6)}...{acc.walletAddress.slice(-4)}
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: "0.5rem" }}>
                    <button
                      onClick={() => copyAddress(acc.walletAddress)}
                      style={{ padding: "0.5rem", background: "transparent", border: "1px solid var(--border)", borderRadius: 6, cursor: "pointer" }}
                      title="Copy address"
                    >
                      {copied === acc.walletAddress ? <Check className="w-4 h-4" style={{ color: "#22c55e" }} /> : <Copy className="w-4 h-4" style={{ color: "var(--text-muted)" }} />}
                    </button>
                    {acc.id !== activeId && (
                      <>
                        <button
                          onClick={() => setActive(acc.id)}
                          disabled={saving}
                          style={{ padding: "0.5rem 1rem", background: "var(--primary)", border: "none", borderRadius: 6, cursor: "pointer", color: "white", fontSize: "0.875rem" }}
                        >
                          Switch
                        </button>
                        <button
                          onClick={() => removeAccount(acc.id)}
                          style={{ padding: "0.5rem", background: "transparent", border: "1px solid rgba(239,68,68,0.3)", borderRadius: 6, cursor: "pointer" }}
                          title="Remove account"
                        >
                          <Trash2 className="w-4 h-4" style={{ color: "#ef4444" }} />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Add new account */}
          <div style={{
            padding: "1rem",
            background: "var(--glass-bg)",
            border: "1px solid var(--border)",
            borderRadius: 8,
          }}>
            <h3 style={{ fontSize: "0.875rem", fontWeight: 600, margin: "0 0 1rem" }}>Add New Account</h3>

            <input
              type="text"
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
              placeholder="Label (optional)"
              style={{
                width: "100%",
                padding: "0.75rem",
                marginBottom: "0.75rem",
                borderRadius: 8,
                background: "var(--bg)",
                border: "1px solid var(--border)",
                color: "var(--text-primary)",
                fontSize: "0.875rem",
              }}
            />

            <input
              type="password"
              value={newKey}
              onChange={(e) => setNewKey(e.target.value)}
              placeholder="Private key (0x...)"
              style={{
                width: "100%",
                padding: "0.75rem",
                marginBottom: "0.75rem",
                borderRadius: 8,
                background: "var(--bg)",
                border: "1px solid var(--border)",
                color: "var(--text-primary)",
                fontSize: "0.875rem",
                fontFamily: "monospace",
              }}
            />

            {error && (
              <div style={{ padding: "0.75rem", background: "rgba(239,68,68,0.1)", borderRadius: 6, marginBottom: "0.75rem", color: "#ef4444", fontSize: "0.875rem" }}>
                {error}
              </div>
            )}

            <button
              onClick={addAccount}
              disabled={saving || !newKey.trim()}
              style={{
                width: "100%",
                padding: "0.75rem",
                background: saving ? "var(--text-muted)" : "linear-gradient(135deg, #22c55e, #16a34a)",
                border: "none",
                borderRadius: 8,
                color: "white",
                fontWeight: 600,
                cursor: saving || !newKey.trim() ? "not-allowed" : "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "0.5rem",
              }}
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              Add Account
            </button>
          </div>

          <p style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: "1rem", textAlign: "center" }}>
            Private keys are stored locally in an encrypted format
          </p>
        </div>
      </div>
    </div>
  );
}

import { useState, useEffect } from "react";
import { Key, Plus, Trash2, CheckCircle2, AlertCircle, X, ShieldAlert } from "lucide-react";
import { toast } from "@/components/ui/toast";

export interface AccountProfile {
  id: string;
  walletAddress: string;
  label?: string;
  isActive: boolean;
}

interface AccountManagerModalProps {
  onClose: () => void;
  onAccountSwitched: () => void;
}

export function AccountManagerModal({ onClose, onAccountSwitched }: AccountManagerModalProps) {
  const [accounts, setAccounts] = useState<AccountProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [newKey, setNewKey] = useState("");
  const [newLabel, setNewLabel] = useState("");

  const fetchAccounts = async () => {
    try {
      const res = await fetch("/api/accounts");
      const data = await res.json();
      if (data.success) {
        setAccounts(data.accounts || []);
      }
    } catch (e) {
      toast.error("Failed to load accounts");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAccounts();
  }, []);

  const handleAddAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newKey) return;
    setAdding(true);
    try {
      const res = await fetch("/api/accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ privateKey: newKey, label: newLabel }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success("Account added successfully");
        setNewKey("");
        setNewLabel("");
        fetchAccounts();
        onAccountSwitched(); // trigger reload of balances
      } else {
        toast.error(data.error || "Failed to add account");
      }
    } catch (e) {
      toast.error("Network error");
    } finally {
      setAdding(false);
    }
  };

  const handleSetActive = async (id: string) => {
    try {
      const res = await fetch("/api/accounts", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success("Active account switched");
        fetchAccounts();
        onAccountSwitched();
      } else {
        toast.error(data.error || "Failed to switch account");
      }
    } catch (e) {
      toast.error("Network error");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to remove this account?")) return;
    try {
      const res = await fetch(`/api/accounts?id=${id}`, { method: "DELETE" });
      const data = await res.json();
      if (data.success) {
        toast.success("Account removed");
        fetchAccounts();
        onAccountSwitched();
      } else {
        toast.error(data.error || "Failed to remove account");
      }
    } catch (e) {
      toast.error("Network error");
    }
  };

  return (
    <div
      onClick={(e) => e.target === e.currentTarget && onClose()}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0, 0, 0, 0.85)",
        backdropFilter: "blur(8px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 9999,
        padding: "1rem",
      }}
    >
      <div style={{
        background: "var(--bg)",
        border: "1px solid var(--border)",
        borderRadius: 16,
        width: "100%",
        maxWidth: 480,
        maxHeight: "85vh",
        overflow: "auto",
        boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.5)",
      }}>
        {/* Header */}
        <div style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "1rem 1.5rem",
          borderBottom: "1px solid var(--border)",
          position: "sticky",
          top: 0,
          background: "var(--bg)",
          zIndex: 1,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <Key className="w-5 h-5" style={{ color: "var(--primary)" }} />
            <h2 style={{ margin: 0, fontSize: "1.25rem", fontWeight: 700 }}>Trading Accounts</h2>
          </div>
          <button
            onClick={onClose}
            style={{
              background: "var(--glass-bg)",
              border: "1px solid var(--border)",
              borderRadius: 8,
              padding: "0.5rem",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <X className="w-5 h-5" style={{ color: "var(--text-muted)" }} />
          </button>
        </div>

        <div style={{ marginBottom: "1.5rem", padding: "0.75rem", background: "rgba(245, 158, 11, 0.1)", borderRadius: 8, display: "flex", gap: "0.5rem", border: "1px solid rgba(245, 158, 11, 0.3)" }}>
          <ShieldAlert className="w-4 h-4 flex-shrink-0" style={{ color: "#f59e0b", marginTop: 2 }} />
          <p style={{ margin: 0, fontSize: "0.75rem", color: "var(--text-secondary)" }}>
            These accounts are securely stored on your local server. They are required for the automated trading bot to sign orders and execute transactions on Polymarket.
          </p>
        </div>

        {/* Account List */}
        <div style={{ marginBottom: "1.5rem", maxHeight: 200, overflowY: "auto", display: "flex", flexDirection: "column", gap: "0.5rem" }}>
          {loading ? (
            <p style={{ textAlign: "center", color: "var(--text-muted)", fontSize: "0.875rem" }}>Loading accounts...</p>
          ) : accounts.length === 0 ? (
            <p style={{ textAlign: "center", color: "var(--text-muted)", fontSize: "0.875rem", padding: "1rem" }}>No accounts added yet.</p>
          ) : (
            accounts.map(acc => (
              <div key={acc.id} style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                padding: "0.75rem", background: acc.isActive ? "rgba(99, 102, 241, 0.1)" : "var(--glass-bg)",
                border: `1px solid ${acc.isActive ? "var(--primary)" : "var(--border)"}`, borderRadius: 8
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", cursor: "pointer" }} onClick={() => !acc.isActive && handleSetActive(acc.id)}>
                  {acc.isActive ? <CheckCircle2 className="w-5 h-5" style={{ color: "var(--primary)" }} /> : <div style={{ width: 20, height: 20, borderRadius: "50%", border: "2px solid var(--text-muted)" }} />}
                  <div>
                    <div style={{ fontWeight: 600, fontSize: "0.875rem" }}>{acc.label || "Wallet"}</div>
                    <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", fontFamily: "monospace" }}>{acc.walletAddress.slice(0, 8)}...{acc.walletAddress.slice(-6)}</div>
                  </div>
                </div>
                <button onClick={() => handleDelete(acc.id)} disabled={acc.isActive && accounts.length === 1} style={{
                  background: "transparent", border: "none", color: "var(--red)", cursor: "pointer", opacity: 0.8
                }}>
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))
          )}
        </div>

        <hr style={{ borderColor: "var(--border)", margin: "1.5rem 0" }} />

        {/* Add Account Form */}
        <form onSubmit={handleAddAccount} style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
          <h3 style={{ margin: 0, fontSize: "1rem" }}>Add New Account</h3>
          <input
            type="text"
            placeholder="Label (e.g. Main Trading Bot)"
            value={newLabel}
            onChange={(e) => setNewLabel(e.target.value)}
            style={{ padding: "0.75rem", borderRadius: 8, background: "var(--bg)", border: "1px solid var(--border)", color: "var(--text-primary)" }}
          />
          <input
            type="password"
            placeholder="Private Key (0x...)"
            value={newKey}
            onChange={(e) => setNewKey(e.target.value)}
            required
            style={{ padding: "0.75rem", borderRadius: 8, background: "var(--bg)", border: "1px solid var(--border)", color: "var(--text-primary)", fontFamily: "monospace" }}
          />
          <button type="submit" disabled={adding || !newKey} className="btn-primary" style={{ width: "100%", justifyContent: "center", marginTop: "0.5rem" }}>
            {adding ? "Adding..." : <><Plus className="w-4 h-4" /> Add Account</>}
          </button>
        </form>
      </div>
    </div>
  );
}

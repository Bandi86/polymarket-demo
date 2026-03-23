import { Wallet, ChevronDown, ExternalLink, Copy, Check, AlertCircle } from "lucide-react";
import { useState } from "react";
import { useWallet } from "../hooks/useWallet";

export function WalletButton() {
  const {
    isConnected,
    address,
    isCorrectNetwork,
    usdcBalance,
    isConnecting,
    isMetaMaskInstalled,
    error,
    connect,
    disconnect,
    switchToPolygon,
  } = useWallet();

  const [showDropdown, setShowDropdown] = useState(false);
  const [copied, setCopied] = useState(false);

  // Format address for display
  const formatAddress = (addr: string) => {
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  };

  // Copy address to clipboard
  const copyAddress = () => {
    if (address) {
      navigator.clipboard.writeText(address);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // Open Polygonscan
  const openExplorer = () => {
    if (address) {
      window.open(`https://polygonscan.com/address/${address}`, "_blank");
    }
  };

  // MetaMask not installed
  if (!isMetaMaskInstalled) {
    return (
      <button
        onClick={() => window.open("https://metamask.io/download/", "_blank")}
        style={{
          display: "flex",
          alignItems: "center",
          gap: "0.5rem",
          padding: "0.5rem 1rem",
          borderRadius: 8,
          background: "linear-gradient(135deg, #f6851b, #e2761b)",
          color: "white",
          border: "none",
          fontWeight: 600,
          fontSize: "0.875rem",
          cursor: "pointer",
        }}
      >
        <Wallet className="w-4 h-4" />
        Install MetaMask
      </button>
    );
  }

  // Not connected
  if (!isConnected) {
    return (
      <button
        onClick={connect}
        disabled={isConnecting}
        style={{
          display: "flex",
          alignItems: "center",
          gap: "0.5rem",
          padding: "0.5rem 1rem",
          borderRadius: 8,
          background: isConnecting ? "var(--glass-bg)" : "linear-gradient(135deg, #8b5cf6, #6366f1)",
          color: "white",
          border: "1px solid var(--border)",
          fontWeight: 600,
          fontSize: "0.875rem",
          cursor: isConnecting ? "wait" : "pointer",
          opacity: isConnecting ? 0.7 : 1,
        }}
      >
        <Wallet className="w-4 h-4" />
        {isConnecting ? "Connecting..." : "Connect Wallet"}
      </button>
    );
  }

  // Wrong network
  if (!isCorrectNetwork) {
    return (
      <button
        onClick={switchToPolygon}
        style={{
          display: "flex",
          alignItems: "center",
          gap: "0.5rem",
          padding: "0.5rem 1rem",
          borderRadius: 8,
          background: "rgba(245, 158, 11, 0.2)",
          color: "#f59e0b",
          border: "1px solid rgba(245, 158, 11, 0.3)",
          fontWeight: 600,
          fontSize: "0.875rem",
          cursor: "pointer",
        }}
      >
        <AlertCircle className="w-4 h-4" />
        Switch to Polygon
      </button>
    );
  }

  // Connected - show dropdown
  return (
    <div style={{ position: "relative" }}>
      <button
        onClick={() => setShowDropdown(!showDropdown)}
        style={{
          display: "flex",
          alignItems: "center",
          gap: "0.75rem",
          padding: "0.5rem 1rem",
          borderRadius: 8,
          background: "var(--glass-bg)",
          color: "var(--text-primary)",
          border: "1px solid var(--border)",
          fontWeight: 500,
          fontSize: "0.875rem",
          cursor: "pointer",
        }}
      >
        <div style={{
          width: 32,
          height: 32,
          borderRadius: "50%",
          background: "linear-gradient(135deg, #8b5cf6, #6366f1)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}>
          <span style={{ color: "white", fontWeight: 700, fontSize: "0.75rem" }}>
            {address?.slice(2, 4).toUpperCase()}
          </span>
        </div>
        <div style={{ textAlign: "left" }}>
          <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
            ${usdcBalance.toFixed(2)} USDC
          </div>
          <div style={{ fontFamily: "ui-monospace, monospace", fontSize: "0.75rem" }}>
            {formatAddress(address!)}
          </div>
        </div>
        <ChevronDown className="w-4 h-4" style={{ color: "var(--text-muted)" }} />
      </button>

      {/* Dropdown Menu */}
      {showDropdown && (
        <>
          <div
            onClick={() => setShowDropdown(false)}
            style={{
              position: "fixed",
              inset: 0,
              zIndex: 40,
            }}
          />
          <div style={{
            position: "absolute",
            top: "calc(100% + 0.5rem)",
            right: 0,
            width: 220,
            background: "var(--bg)",
            border: "1px solid var(--border)",
            borderRadius: 12,
            padding: "0.5rem",
            zIndex: 50,
            boxShadow: "0 10px 40px rgba(0,0,0,0.3)",
          }}>
            {/* Balance */}
            <div style={{
              padding: "0.75rem",
              borderBottom: "1px solid var(--border)",
              marginBottom: "0.5rem",
            }}>
              <div style={{ fontSize: "0.625rem", color: "var(--text-muted)", textTransform: "uppercase" }}>
                USDC Balance
              </div>
              <div style={{ fontSize: "1.25rem", fontWeight: 700, color: "var(--text-primary)" }}>
                ${usdcBalance.toFixed(2)}
              </div>
            </div>

            {/* Actions */}
            <button
              onClick={copyAddress}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.75rem",
                width: "100%",
                padding: "0.75rem",
                borderRadius: 8,
                background: "transparent",
                border: "none",
                color: "var(--text-primary)",
                fontSize: "0.875rem",
                cursor: "pointer",
                textAlign: "left",
              }}
            >
              {copied ? <Check className="w-4 h-4" style={{ color: "#22c55e" }} /> : <Copy className="w-4 h-4" />}
              {copied ? "Copied!" : "Copy Address"}
            </button>

            <button
              onClick={openExplorer}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.75rem",
                width: "100%",
                padding: "0.75rem",
                borderRadius: 8,
                background: "transparent",
                border: "none",
                color: "var(--text-primary)",
                fontSize: "0.875rem",
                cursor: "pointer",
                textAlign: "left",
              }}
            >
              <ExternalLink className="w-4 h-4" />
              View on Polygonscan
            </button>

            <div style={{ height: 1, background: "var(--border)", margin: "0.5rem 0" }} />

            <button
              onClick={() => {
                disconnect();
                setShowDropdown(false);
              }}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.75rem",
                width: "100%",
                padding: "0.75rem",
                borderRadius: 8,
                background: "rgba(239, 68, 68, 0.1)",
                border: "none",
                color: "#ef4444",
                fontSize: "0.875rem",
                cursor: "pointer",
                textAlign: "left",
              }}
            >
              <Wallet className="w-4 h-4" />
              Disconnect
            </button>
          </div>
        </>
      )}

      {/* Error Toast */}
      {error && (
        <div style={{
          position: "absolute",
          top: "calc(100% + 0.5rem)",
          right: 0,
          padding: "0.5rem 1rem",
          background: "rgba(239, 68, 68, 0.1)",
          border: "1px solid rgba(239, 68, 68, 0.3)",
          borderRadius: 8,
          color: "#ef4444",
          fontSize: "0.75rem",
          whiteSpace: "nowrap",
        }}>
          {error}
        </div>
      )}
    </div>
  );
}
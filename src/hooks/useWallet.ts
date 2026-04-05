import { useState, useEffect, useCallback } from "react";

// Polygon chain ID
const POLYGON_CHAIN_ID = 137;

// USDC contract on Polygon
const USDC_ADDRESS = "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174";

// Polymarket CLOB Exchange
const CTF_EXCHANGE = "0x4bFb41d5B3570DeFd03C39a9A4D8dE6Bd8B8982E";

// ERC20 ABI for USDC
const ERC20_ABI = [
  {
    constant: true,
    inputs: [{ name: "_owner", type: "address" }],
    name: "balanceOf",
    outputs: [{ name: "balance", type: "uint256" }],
    type: "function",
  },
  {
    constant: true,
    inputs: [{ name: "_owner", type: "address" }, { name: "_spender", type: "address" }],
    name: "allowance",
    outputs: [{ name: "remaining", type: "uint256" }],
    type: "function",
  },
  {
    constant: false,
    inputs: [{ name: "_spender", type: "address" }, { name: "_amount", type: "uint256" }],
    name: "approve",
    outputs: [{ name: "success", type: "bool" }],
    type: "function",
  },
];

// EIP-1193 Provider interface
interface Eip1193Provider {
  request<T = unknown>(args: { method: string; params?: unknown[] }): Promise<T>;
  on(event: "accountsChanged" | "chainChanged" | string, listener: (...args: unknown[]) => void): void;
  removeListener(event: "accountsChanged" | "chainChanged" | string, listener: (...args: unknown[]) => void): void;
}

// EIP-712 Typed Data types
interface Eip712Domain {
  name: string;
  version: string;
  chainId: number;
  verifyingContract: string;
}

interface Eip712Type {
  name: string;
  type: string;
}

interface Eip712Types {
  [key: string]: Eip712Type[];
}

interface Eip712Value {
  [key: string]: string | number;
}

// Wallet error with optional code (for RPC errors)
interface WalletError extends Error {
  code?: number;
}

export interface WalletState {
  isConnected: boolean;
  address: string | null;
  chainId: number | null;
  isCorrectNetwork: boolean;
  usdcBalance: number;
  usdcAllowance: number;
  isConnecting: boolean;
  error: string | null;
}

export function useWallet() {
  const [state, setState] = useState<WalletState>({
    isConnected: false,
    address: null,
    chainId: null,
    isCorrectNetwork: false,
    usdcBalance: 0,
    usdcAllowance: 0,
    isConnecting: false,
    error: null,
  });

  // Check if MetaMask is installed
  const isMetaMaskInstalled = typeof window !== "undefined" && typeof (window as { ethereum?: Eip1193Provider }).ethereum !== "undefined";

  // Get ethereum provider
  const getProvider = useCallback(() => {
    if (typeof window === "undefined") return null;
    return (window as { ethereum?: Eip1193Provider }).ethereum;
  }, []);

  // Update USDC balance
  const updateUsdcBalance = useCallback(async (address: string) => {
    const provider = getProvider();
    if (!provider) return;

    try {
      // Call balanceOf on USDC contract
      const data = "0x70a08231" + // balanceOf selector
        "000000000000000000000000" + address.slice(2); // padded address

      const result = await provider.request({
        method: "eth_call",
        params: [{
          to: USDC_ADDRESS,
          data: data,
        }, "latest"],
      });

      // Parse result (6 decimals for USDC)
      const balance = parseInt(result as string, 16) / 1e6;
      setState(prev => ({ ...prev, usdcBalance: balance }));
    } catch (err) {
      console.error("Failed to fetch USDC balance:", err instanceof Error ? err.message : err);
    }
  }, [getProvider]);

  // Update USDC allowance
  const updateUsdcAllowance = useCallback(async (address: string) => {
    const provider = getProvider();
    if (!provider) return;

    try {
      // Call allowance(owner, spender) on USDC contract
      const data = "0xdd62ed3e" + // allowance selector
        "000000000000000000000000" + address.slice(2) + // owner
        "000000000000000000000000" + CTF_EXCHANGE.slice(2); // spender

      const result = await provider.request({
        method: "eth_call",
        params: [{
          to: USDC_ADDRESS,
          data: data,
        }, "latest"],
      });

      // Parse result
      const allowance = parseInt(result as string, 16) / 1e6;
      setState(prev => ({ ...prev, usdcAllowance: allowance }));
    } catch (err) {
      console.error("Failed to fetch USDC allowance:", err instanceof Error ? err.message : err);
    }
  }, [getProvider]);

  // Connect wallet
  const connect = useCallback(async () => {
    const provider = getProvider();
    if (!provider) {
      setState(prev => ({ ...prev, error: "MetaMask not installed" }));
      return;
    }

    setState(prev => ({ ...prev, isConnecting: true, error: null }));

    try {
      // Request account access
      const accounts = await provider.request<string[]>({ method: "eth_requestAccounts" });
      const address = accounts[0];

      // Get chain ID
      const chainId = await provider.request<string>({ method: "eth_chainId" });
      const chainIdNum = parseInt(chainId, 16);

      setState(prev => ({
        ...prev,
        isConnected: true,
        address,
        chainId: chainIdNum,
        isCorrectNetwork: chainIdNum === POLYGON_CHAIN_ID,
        isConnecting: false,
      }));

      // Fetch USDC balance
      await updateUsdcBalance(address);
      await updateUsdcAllowance(address);
    } catch (err) {
      console.error("Failed to connect wallet:", err);
      const errorMessage = err instanceof Error ? err.message : "Failed to connect wallet";
      setState(prev => ({
        ...prev,
        isConnecting: false,
        error: errorMessage,
      }));
    }
  }, [getProvider, updateUsdcBalance, updateUsdcAllowance]);

  // Disconnect wallet
  const disconnect = useCallback(() => {
    setState({
      isConnected: false,
      address: null,
      chainId: null,
      isCorrectNetwork: false,
      usdcBalance: 0,
      usdcAllowance: 0,
      isConnecting: false,
      error: null,
    });
  }, []);

  // Switch to Polygon network
  const switchToPolygon = useCallback(async () => {
    const provider = getProvider();
    if (!provider) return;

    try {
      // Try to switch to Polygon
      await provider.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: "0x89" }], // 137 in hex
      });
    } catch (switchError) {
      const error = switchError as WalletError;
      // If the chain is not added, add it
      if (error.code === 4902) {
        try {
          await provider.request({
            method: "wallet_addEthereumChain",
            params: [{
              chainId: "0x89",
              chainName: "Polygon",
              nativeCurrency: {
                name: "MATIC",
                symbol: "MATIC",
                decimals: 18,
              },
              rpcUrls: ["https://polygon-rpc.com"],
              blockExplorerUrls: ["https://polygonscan.com"],
            }],
          });
        } catch (addError) {
          console.error("Failed to add Polygon network:", addError instanceof Error ? addError.message : addError);
        }
      } else {
        console.error("Failed to switch network:", error.message ?? switchError);
      }
    }
  }, [getProvider]);

  // Approve USDC for Polymarket
  const approveUsdc = useCallback(async (amount: number) => {
    const provider = getProvider();
    if (!provider || !state.address) return false;

    try {
      // Convert amount to wei (6 decimals for USDC)
      const amountWei = BigInt(Math.floor(amount * 1e6)).toString(16).padStart(64, "0");

      // approve(spender, amount)
      const data = "0x095ea7b3" + // approve selector
        "000000000000000000000000" + CTF_EXCHANGE.slice(2) + // spender
        amountWei; // amount

      const txHash = await provider.request<string>({
        method: "eth_sendTransaction",
        params: [{
          from: state.address,
          to: USDC_ADDRESS,
          data: data,
        }],
      });

      console.log("Approval transaction sent:", txHash);

      // Wait for transaction confirmation
      await waitForTransaction(provider, txHash);

      // Update allowance
      await updateUsdcAllowance(state.address);

      return true;
    } catch (err) {
      console.error("Failed to approve USDC:", err instanceof Error ? err.message : err);
      setState(prev => ({ ...prev, error: err instanceof Error ? err.message : "Failed to approve USDC" }));
      return false;
    }
  }, [getProvider, state.address, updateUsdcAllowance]);

  // Sign message for Polymarket authentication
  const signMessage = useCallback(async (message: string) => {
    const provider = getProvider();
    if (!provider || !state.address) return null;

    try {
      const signature = await provider.request({
        method: "personal_sign",
        params: [message, state.address],
      });
      return signature as string;
    } catch (err) {
      console.error("Failed to sign message:", err instanceof Error ? err.message : err);
      return null;
    }
  }, [getProvider, state.address]);

  // Sign typed data (EIP-712)
  const signTypedData = useCallback(async (domain: Eip712Domain, types: Eip712Types, value: Eip712Value) => {
    const provider = getProvider();
    if (!provider || !state.address) return null;

    try {
      const signature = await provider.request({
        method: "eth_signTypedData_v4",
        params: [state.address, JSON.stringify({ domain, types, primaryType: Object.keys(types)[0], message: value })],
      });
      return signature as string;
    } catch (err) {
      console.error("Failed to sign typed data:", err instanceof Error ? err.message : err);
      return null;
    }
  }, [getProvider, state.address]);

  // Listen for account and chain changes
  useEffect(() => {
    const provider = getProvider();
    if (!provider) return;

    const handleAccountsChanged = (accounts: unknown) => {
      const accountsArray = Array.isArray(accounts) ? accounts as string[] : [];
      if (accountsArray.length === 0) {
        disconnect();
      } else {
        const address = accountsArray[0];
        setState(prev => ({ ...prev, address }));
        updateUsdcBalance(address);
        updateUsdcAllowance(address);
      }
    };

    const handleChainChanged = (chainId: unknown) => {
      const chainIdStr = String(chainId);
      const chainIdNum = parseInt(chainIdStr, 16);
      setState(prev => ({
        ...prev,
        chainId: chainIdNum,
        isCorrectNetwork: chainIdNum === POLYGON_CHAIN_ID,
      }));
    };

    provider.on("accountsChanged", handleAccountsChanged);
    provider.on("chainChanged", handleChainChanged);

    // Check if already connected
    provider.request<string[]>({ method: "eth_accounts" }).then((accounts) => {
      if (accounts && accounts.length > 0) {
        connect();
      }
    });

    return () => {
      provider.removeListener("accountsChanged", handleAccountsChanged);
      provider.removeListener("chainChanged", handleChainChanged);
    };
  }, [getProvider, connect, disconnect, updateUsdcBalance, updateUsdcAllowance]);

  return {
    ...state,
    isMetaMaskInstalled,
    connect,
    disconnect,
    switchToPolygon,
    approveUsdc,
    signMessage,
    signTypedData,
    updateUsdcBalance,
    updateUsdcAllowance,
  };
}

// Helper to wait for transaction
async function waitForTransaction(provider: Eip1193Provider, txHash: string): Promise<void> {
  let receipt: unknown = null;
  while (!receipt) {
    receipt = await provider.request({
      method: "eth_getTransactionReceipt",
      params: [txHash],
    });
    if (!receipt) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
}
// Polymarket Bridge Provider
// Uses Bridge API for deposits and withdrawals
// Powered by fun.xyz

const BRIDGE_HOST = "https://bridge.polymarket.com";
const GAMMA_HOST = "https://gamma-api.polymarket.com";

// Chain IDs
export const CHAIN_IDS = {
  ETHEREUM: "1",
  POLYGON: "137",
  ARBITRUM: "42161",
  BASE: "8453",
  SOLANA: "solana",
  BITCOIN: "bitcoin",
} as const;

export type ChainId = typeof CHAIN_IDS[keyof typeof CHAIN_IDS];

// Token addresses on different chains
export const TOKEN_ADDRESSES: Record<string, Record<ChainId, string>> = {
  USDC: {
    [CHAIN_IDS.ETHEREUM]: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
    [CHAIN_IDS.POLYGON]: "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174",
    [CHAIN_IDS.ARBITRUM]: "0xaf88d065e77c8cC22393278274c2a24431E903c2",
    [CHAIN_IDS.BASE]: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    [CHAIN_IDS.SOLANA]: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
    [CHAIN_IDS.BITCOIN]: "BTC",
  },
  USDT: {
    [CHAIN_IDS.ETHEREUM]: "0xdAC17F958D2ee523a2206206994597C13D831ec7",
    [CHAIN_IDS.POLYGON]: "0xc2132D05D31c914a87C6611C10748AEb04B58e8F",
    [CHAIN_IDS.ARBITRUM]: "0xFd086bC7CD5D481aE848D7fC12D0eA80e7a0A65",
    [CHAIN_IDS.BASE]: "0x4DEcA517FF60c1d1c8B5b0B0eB2c1cA3f0F0E0F0",
    [CHAIN_IDS.SOLANA]: "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB",
    [CHAIN_IDS.BITCOIN]: "BTC",
  },
  ETH: {
    [CHAIN_IDS.ETHEREUM]: "0x0000000000000000000000000000000000000000",
    [CHAIN_IDS.POLYGON]: "0x0000000000000000000000000000000000000000",
    [CHAIN_IDS.ARBITRUM]: "0x0000000000000000000000000000000000000000",
    [CHAIN_IDS.BASE]: "0x0000000000000000000000000000000000000000",
    [CHAIN_IDS.SOLANA]: "So111111111111111111111111111111111111111",
    [CHAIN_IDS.BITCOIN]: "BTC",
  },
  WBTC: {
    [CHAIN_IDS.ETHEREUM]: "0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599",
    [CHAIN_IDS.POLYGON]: "0x1BFD67037B42Cf73acF2047067bd4F2C47D9BfD6",
    [CHAIN_IDS.ARBITRUM]: "0x2f2a2543B76a4166549F7aaB2e75Bef0a1C18312",
    [CHAIN_IDS.BASE]: "0x04c059767ae69e70e6bV9D1d1e6f9c2b3f5f8a9b",
    [CHAIN_IDS.SOLANA]: "3b6a27Bc1CbEA7bEa5Ec4cC3EEa7C8bC3dF0E8E",
    [CHAIN_IDS.BITCOIN]: "BTC",
  },
};

export interface SupportedAsset {
  chainId: string;
  chainName: string;
  token: {
    name: string;
    symbol: string;
    address: string;
    decimals: number;
  };
  minCheckoutUsd: number;
}

export interface DepositAddresses {
  evm: string;
  svm: string;
  btc: string;
}

export interface BridgeQuote {
  quoteId: string;
  estCheckoutTimeMs: number;
  estInputUsd: number;
  estOutputUsd: number;
  estToTokenBaseUnit: string;
  estFeeBreakdown: {
    appFeeLabel: string;
    appFeePercent: number;
    appFeeUsd: number;
    gasUsd: number;
    minReceived: number;
    maxSlippage: number;
  };
}

export interface TransactionStatus {
  fromChainId: string;
  fromTokenAddress: string;
  fromAmountBaseUnit: string;
  toChainId: string;
  toTokenAddress: string;
  status: "DEPOSIT_DETECTED" | "PROCESSING" | "COMPLETED" | "FAILED";
  txHash?: string;
  createdTimeMs?: number;
}

// Bridge Provider Class
export class BridgeProvider {
  private walletAddress: string;

  constructor(walletAddress: string) {
    this.walletAddress = walletAddress;
  }

  /**
   * Get supported assets for deposit/withdrawal
   */
  async getSupportedAssets(): Promise<SupportedAsset[]> {
    try {
      const response = await fetch(`${BRIDGE_HOST}/supported-assets`, {
        headers: { "Content-Type": "application/json" },
        signal: AbortSignal.timeout(15000),
      });

      if (!response.ok) {
        throw new Error(`Failed to get supported assets: ${response.status}`);
      }

      const data = await response.json();
      return data.supportedAssets || [];
    } catch (error) {
      console.error("[BridgeProvider] getSupportedAssets error:", error);
      throw error;
    }
  }

  /**
   * Get deposit addresses for all chains
   */
  async getDepositAddresses(): Promise<DepositAddresses> {
    try {
      const response = await fetch(`${BRIDGE_HOST}/deposit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address: this.walletAddress }),
        signal: AbortSignal.timeout(15000),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Failed to get deposit addresses: ${response.status} - ${error}`);
      }

      const data = await response.json();
      return data.address;
    } catch (error) {
      console.error("[BridgeProvider] getDepositAddresses error:", error);
      throw error;
    }
  }

  /**
   * Get bridge quote for deposit or withdrawal
   */
  async getQuote(params: {
    amount: number; // In USD
    fromChainId: ChainId;
    fromToken: string; // "USDC", "ETH", "WBTC"
    toChainId: ChainId;
    toToken: string;
    recipientAddress: string;
  }): Promise<BridgeQuote> {
    const fromTokenAddr = TOKEN_ADDRESSES[params.fromToken]?.[params.fromChainId];
    const toTokenAddr = TOKEN_ADDRESSES[params.toToken]?.[params.toChainId];

    if (!fromTokenAddr || !toTokenAddr) {
      throw new Error("Invalid token or chain combination");
    }

    // Convert amount to base units (6 decimals for USDC)
    const decimals = params.fromToken === "ETH" || params.fromToken === "WBTC" ? 18 : 6;
    const amountBaseUnit = Math.floor(params.amount * Math.pow(10, decimals)).toString();

    try {
      const response = await fetch(`${BRIDGE_HOST}/quote`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fromAmountBaseUnit: amountBaseUnit,
          fromChainId: params.fromChainId,
          fromTokenAddress: fromTokenAddr,
          recipientAddress: params.recipientAddress,
          toChainId: params.toChainId,
          toTokenAddress: toTokenAddr,
        }),
        signal: AbortSignal.timeout(15000),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Failed to get quote: ${response.status} - ${error}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error("[BridgeProvider] getQuote error:", error);
      throw error;
    }
  }

  /**
   * Create withdrawal addresses
   */
  async createWithdrawal(params: {
    toChainId: ChainId;
    toToken: string;
    recipientAddr: string;
  }): Promise<{ address: DepositAddresses; note: string }> {
    const toTokenAddr = TOKEN_ADDRESSES[params.toToken]?.[params.toChainId];

    if (!toTokenAddr) {
      throw new Error("Invalid token or chain combination");
    }

    try {
      const response = await fetch(`${BRIDGE_HOST}/withdraw`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          address: this.walletAddress,
          toChainId: params.toChainId,
          toTokenAddress: toTokenAddr,
          recipientAddr: params.recipientAddr,
        }),
        signal: AbortSignal.timeout(15000),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Failed to create withdrawal: ${response.status} - ${error}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error("[BridgeProvider] createWithdrawal error:", error);
      throw error;
    }
  }

  /**
   * Get transaction status for a deposit/withdrawal address
   */
  async getTransactionStatus(depositAddress: string): Promise<TransactionStatus[]> {
    try {
      const response = await fetch(`${BRIDGE_HOST}/status/${depositAddress}`, {
        headers: { "Content-Type": "application/json" },
        signal: AbortSignal.timeout(15000),
      });

      if (!response.ok) {
        throw new Error(`Failed to get status: ${response.status}`);
      }

      const data = await response.json();
      return data.transactions || [];
    } catch (error) {
      console.error("[BridgeProvider] getTransactionStatus error:", error);
      throw error;
    }
  }

  /**
   * Get user's Polymarket portfolio from Gamma API (for display purposes)
   */
  async getPortfolio() {
    try {
      const response = await fetch(
        `${GAMMA_HOST}/portfolio?address=${this.walletAddress}`,
        {
          headers: { "Content-Type": "application/json" },
          signal: AbortSignal.timeout(15000),
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to get portfolio: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error("[BridgeProvider] getPortfolio error:", error);
      return null;
    }
  }
}

// Chain info for UI
export const CHAIN_INFO: Record<ChainId, { name: string; symbol: string; icon: string; color: string }> = {
  [CHAIN_IDS.ETHEREUM]: { name: "Ethereum", symbol: "ETH", icon: "⬡", color: "#627EEA" },
  [CHAIN_IDS.POLYGON]: { name: "Polygon", symbol: "MATIC", icon: "⬡", color: "#8247E5" },
  [CHAIN_IDS.ARBITRUM]: { name: "Arbitrum", symbol: "ETH", icon: "▲", color: "#28A0F0" },
  [CHAIN_IDS.BASE]: { name: "Base", symbol: "ETH", icon: "🔵", color: "#0052FF" },
  [CHAIN_IDS.SOLANA]: { name: "Solana", symbol: "SOL", icon: "◎", color: "#14F195" },
  [CHAIN_IDS.BITCOIN]: { name: "Bitcoin", symbol: "BTC", icon: "₿", color: "#F7931A" },
};

// Default exports for convenience
export function createBridgeProvider(walletAddress: string): BridgeProvider {
  return new BridgeProvider(walletAddress);
}

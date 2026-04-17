import { fetchAccountBalance } from "./providers/account-client";
import { cliWrapper } from "./providers/cli-wrapper";

export interface AccountDetails {
  tradingBalance: {
    available: number;
    locked: number;
    total: number;
  };
  onChainWallet: {
    totalValue: number;
    address?: string;
  };
  isLive: boolean;
  success: boolean;
  error?: string;
}

export class AccountManager {
  constructor() {
    // We fetch dynamically per request now
  }

  /**
   * Helper to fetch active keys and environment dynamically
   */
  private async getActiveCredentials(): Promise<{ walletAddress: string; privateKey: string }> {
    const { accountStore } = await import('@/lib/account-store');
    const active = await accountStore.getActiveAccount();
    
    if (active) {
      return { walletAddress: active.walletAddress, privateKey: active.privateKey };
    }
    
    // Fallback to env
    const pk = process.env.POLYMARKET_PRIVATE_KEY;
    const wa = process.env.POLYMARKET_WALLET_ADDRESS;
    if (pk) {
      // Return env keys if no store active
      return { walletAddress: wa || '', privateKey: pk };
    }
    throw new Error('No active account or private key configured');
  }

  /**
   * Fast check for available trading balance. Used by bots for sizing.
   * Uses polymarket-cli which is more reliable than direct API calls.
   */
  async getTradingBalance() {
    try {
      const { privateKey } = await this.getActiveCredentials();

      // Try CLI first (more reliable)
      try {
        const cliResult = await cliWrapper.getClobBalance(privateKey);
        if (cliResult && cliResult.balance !== undefined) {
          const balance = parseFloat(cliResult.balance);
          return {
            available: balance,
            locked: 0,
            total: balance,
            success: true,
          };
        }
      } catch (cliErr) {
        console.warn("[AccountManager] CLI balance failed, trying API:", cliErr);
      }

      // Fallback to direct API
      const result = await fetchAccountBalance(privateKey);
      return {
        available: result.available,
        locked: result.locked,
        total: result.balance,
        success: result.success,
        error: result.error,
      };
    } catch (e: any) {
      return { available: 0, locked: 0, total: 0, success: false, error: e.message };
    }
  }

  /**
   * Comprehensive account fetch, bridging CLOB and On-Chain data.
   */
  async getDetailedAccount(): Promise<AccountDetails> {
    const tradingResult = await this.getTradingBalance();
    
    let onChainValue = 0;
    
    let creds;
    try {
      creds = await this.getActiveCredentials();
    } catch (e) {
      // No active account
    }

    // If we have wallet address configured, try to get deep value via CLI
    if (creds?.walletAddress && tradingResult.success) {
      try {
        const cliValue: any = await cliWrapper.getOnChainValue(creds.walletAddress, creds.privateKey);
        if (cliValue && cliValue.totalValue !== undefined) {
           onChainValue = parseFloat(cliValue.totalValue);
        } else if (cliValue && typeof cliValue.value === 'string') {
           onChainValue = parseFloat(cliValue.value);
        }
      } catch (e) {
        console.warn("[AccountManager] Failed to fetch on-chain value via CLI", e);
      }
    }

    return {
      tradingBalance: {
        available: tradingResult.available,
        locked: tradingResult.locked,
        total: tradingResult.total,
      },
      onChainWallet: {
        // Fallback to CLOB balance if on-chain fetch fails or not configured
        totalValue: onChainValue || tradingResult.total,
        address: creds?.walletAddress || undefined,
      },
      isLive: tradingResult.success,
      success: tradingResult.success,
      error: tradingResult.error,
    };
  }

  /**
   * Generates deposit info using CLI
   */
  async getDepositInfo() {
    const { walletAddress, privateKey } = await this.getActiveCredentials();
    return cliWrapper.getDepositAddresses(walletAddress, privateKey);
  }

  /**
   * Check contract approvals
   */
  async checkApprovals() {
    const { walletAddress, privateKey } = await this.getActiveCredentials();
    return cliWrapper.checkApprovals(walletAddress, privateKey);
  }

  /**
   * Set contract approvals (costs MATIC gas)
   */
  async setApprovals() {
    const { privateKey } = await this.getActiveCredentials();
    return cliWrapper.setApprovals(privateKey);
  }

  /**
   * Redeem winning tokens for a condition
   */
  async redeemWinnings(conditionId: string) {
    const { privateKey } = await this.getActiveCredentials();
    return cliWrapper.redeemCtfTokens(conditionId, privateKey);
  }
}

export const accountManager = new AccountManager();

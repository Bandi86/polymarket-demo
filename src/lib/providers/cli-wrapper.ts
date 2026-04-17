/**
 * Wrapper for the official polymarket-cli (Rust).
 * Uses child_process spawn to execute CLI commands programmatically and parse JSON output.
 * Relies on POLYMARKET_PRIVATE_KEY environment variable for authentication.
 */

import { spawn } from 'child_process';

export class PolymarketCliWrapper {
  private getEnv(privateKey?: string): Record<string, string> {
    const env = Object.fromEntries(
      Object.entries(process.env).filter(([_, v]) => v !== undefined)
    ) as Record<string, string>;

    if (privateKey) {
      env['POLYMARKET_PRIVATE_KEY'] = privateKey;
    }

    return env;
  }

  /**
   * Run a polymarket command and return parsed JSON.
   */
  private async runCommand<T>(args: string[], privateKey?: string): Promise<T> {
    return new Promise((resolve, reject) => {
      const env = this.getEnv(privateKey);
      const proc = spawn("polymarket", ["-o", "json", ...args], {
        env: env,
      });

      let stdoutText = '';
      let stderrText = '';

      proc.stdout?.on('data', (data) => {
        stdoutText += data.toString();
      });

      proc.stderr?.on('data', (data) => {
        stderrText += data.toString();
      });

      proc.on('close', (code) => {
        if (code !== 0) {
          let errorMsg = stderrText || stdoutText;
          try {
            const parsed = JSON.parse(errorMsg);
            if (parsed && parsed.error) {
              errorMsg = parsed.error;
            }
          } catch {
            // Ignore parse errors for raw stderr
          }
          reject(new Error(`CLI Error (${code}): ${errorMsg.trim()}`));
          return;
        }

        try {
          resolve(JSON.parse(stdoutText) as T);
        } catch (e) {
          reject(new Error(`Failed to parse CLI output: ${stdoutText}`));
        }
      });

      proc.on('error', (err) => {
        reject(new Error(`Failed to execute polymarket-cli: ${err.message}`));
      });
    });
  }

  /**
   * Fetch exact CLOB collateral balance.
   */
  async getClobBalance(privateKey?: string): Promise<{ balance: string }> {
    return this.runCommand<{ balance: string }>(["clob", "balance", "--asset-type", "collateral"], privateKey);
  }

  /**
   * Fetch deep on-chain portfolio value (Wallet USDC + Tokens).
   */
  async getOnChainValue(walletAddress: string, privateKey?: string): Promise<any> {
    return this.runCommand(["data", "value", walletAddress], privateKey);
  }

  /**
   * Redeem all winning tokens for a specific market/condition.
   */
  async redeemCtfTokens(conditionId: string, privateKey?: string): Promise<any> {
    return this.runCommand(["ctf", "redeem", "--condition", conditionId], privateKey);
  }

  /**
   * Generate bridge deposit addresses.
   */
  async getDepositAddresses(walletAddress: string, privateKey?: string): Promise<any> {
    return this.runCommand(["bridge", "deposit", walletAddress], privateKey);
  }

  /**
   * Check if Polymarket contracts are approved for spending.
   */
  async checkApprovals(walletAddress?: string, privateKey?: string): Promise<any> {
    const args = ["approve", "check"];
    if (walletAddress) {
      args.push(walletAddress);
    }
    return this.runCommand(args, privateKey);
  }

  /**
   * Approve Polymarket contracts (requires MATIC gas).
   */
  async setApprovals(privateKey?: string): Promise<any> {
    return this.runCommand(["approve", "set"], privateKey);
  }
}

export const cliWrapper = new PolymarketCliWrapper();

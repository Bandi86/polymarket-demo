import fs from 'fs/promises';
import path from 'path';
import { privateKeyToAccount } from 'viem/accounts';
import crypto from 'crypto';

export interface AccountProfile {
  id: string;
  walletAddress: string;
  privateKey: string;
  label?: string;
  isActive: boolean;
}

const STORE_FILE = path.join(process.cwd(), '.accounts.json');
const ENCRYPTION_KEY = process.env.ACCOUNTS_ENCRYPTION_KEY || '';
const ALGORITHM = 'aes-256-gcm';

// Encryption utilities
function getEncryptionKey(): Buffer | null {
  if (!ENCRYPTION_KEY) return null;
  // Derive a proper 32-byte key from the provided key using SHA-256
  return crypto.createHash('sha256').update(ENCRYPTION_KEY).digest();
}

function encrypt(text: string): string {
  const key = getEncryptionKey();
  if (!key) return text; // No encryption if no key

  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  const authTag = cipher.getAuthTag();

  // Return iv:authTag:encrypted
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
}

function decrypt(encryptedText: string): string {
  const key = getEncryptionKey();
  if (!key) return encryptedText; // No decryption if no key

  // Check if it's actually encrypted (has 3 parts)
  const parts = encryptedText.split(':');
  if (parts.length !== 3) return encryptedText; // Not encrypted, return as-is

  try {
    const iv = Buffer.from(parts[0], 'hex');
    const authTag = Buffer.from(parts[1], 'hex');
    const encrypted = parts[2];

    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  } catch (err) {
    console.error('[AccountStore] Decryption failed - key may be wrong:', err);
    return encryptedText; // Return as-is if decryption fails
  }
}

export class AccountStore {
  private async getStore(): Promise<AccountProfile[]> {
    try {
      const data = await fs.readFile(STORE_FILE, 'utf-8');
      // Try to decrypt if encryption is enabled
      const decrypted = decrypt(data);
      return JSON.parse(decrypted);
    } catch (e: any) {
      if (e.code === 'ENOENT') {
        // If the file doesn't exist, fallback to environment variable for migration
        const envKey = process.env.POLYMARKET_PRIVATE_KEY;
        if (envKey) {
          try {
            const viemAcc = privateKeyToAccount(envKey as `0x${string}`);
            const defaultAcc: AccountProfile = {
              id: viemAcc.address,
              walletAddress: viemAcc.address,
              privateKey: envKey,
              label: 'Default (.env)',
              isActive: true
            };
            await this.saveStore([defaultAcc]);
            return [defaultAcc];
          } catch (err) {
             console.error('[AccountStore] Error parsing .env private key', err);
          }
        }
        return [];
      }
      console.error('[AccountStore] Error reading store', e);
      return [];
    }
  }

  private async saveStore(accounts: AccountProfile[]): Promise<void> {
    const data = JSON.stringify(accounts, null, 2);
    // Encrypt if encryption key is set
    const encrypted = encrypt(data);
    await fs.writeFile(STORE_FILE, encrypted, 'utf-8');
  }

  async getAccounts(): Promise<Omit<AccountProfile, 'privateKey'>[]> {
    const accounts = await this.getStore();
    return accounts.map(a => ({
      id: a.id,
      walletAddress: a.walletAddress,
      label: a.label,
      isActive: a.isActive
    }));
  }

  async getActiveAccount(): Promise<AccountProfile | null> {
    const accounts = await this.getStore();
    return accounts.find(a => a.isActive) || null;
  }

  async getAccountByKey(privateKey: string): Promise<AccountProfile | null> {
    const accounts = await this.getStore();
    return accounts.find(a => a.privateKey === privateKey) || null;
  }

  async addAccount(privateKey: string, label?: string): Promise<AccountProfile> {
    // Validate key
    if (!privateKey.startsWith('0x')) {
      privateKey = `0x${privateKey}`;
    }
    const viemAcc = privateKeyToAccount(privateKey as `0x${string}`);
    const address = viemAcc.address;

    const accounts = await this.getStore();
    
    // Check if exists
    const existing = accounts.find(a => a.walletAddress.toLowerCase() === address.toLowerCase());
    if (existing) {
      throw new Error('Account already exists');
    }

    // If it's the first account, make it active
    const isActive = accounts.length === 0;

    const newAcc: AccountProfile = {
      id: address,
      walletAddress: address,
      privateKey,
      label: label || `Wallet ${address.slice(0, 6)}`,
      isActive
    };

    accounts.push(newAcc);
    await this.saveStore(accounts);
    return newAcc;
  }

  async setActiveAccount(id: string): Promise<void> {
    const accounts = await this.getStore();
    let found = false;
    
    const updated = accounts.map(a => {
      if (a.id === id) {
        found = true;
        return { ...a, isActive: true };
      }
      return { ...a, isActive: false };
    });

    if (!found) throw new Error('Account not found');
    await this.saveStore(updated);
  }

  async removeAccount(id: string): Promise<void> {
    let accounts = await this.getStore();
    const toRemove = accounts.find(a => a.id === id);
    if (!toRemove) throw new Error('Account not found');

    accounts = accounts.filter(a => a.id !== id);
    
    // If we removed the active account and there are others, make the first one active
    if (toRemove.isActive && accounts.length > 0) {
      accounts[0].isActive = true;
    }

    await this.saveStore(accounts);
  }
}

export const accountStore = new AccountStore();

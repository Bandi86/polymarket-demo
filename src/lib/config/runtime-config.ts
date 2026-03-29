// Runtime Configuration Manager
// Allows hot-reloadable strategy thresholds without restart

import fs from "fs";
import path from "path";
import type { StrategyType } from "../../types";
import type { StrategyThresholds } from "../strategies/types";

const CONFIG_PATH = path.join(process.cwd(), "config", "strategies.json");

/**
 * Manages runtime configuration for strategy thresholds
 * Supports hot reload from JSON file
 */
export class ConfigManager {
  private config: Partial<Record<StrategyType, StrategyThresholds>> = {};
  private lastLoadTime: number = 0;

  constructor() {
    this.load();
  }

  /**
   * Load configuration from JSON file
   */
  load(): void {
    try {
      if (fs.existsSync(CONFIG_PATH)) {
        const raw = fs.readFileSync(CONFIG_PATH, "utf-8");
        this.config = JSON.parse(raw);
        this.lastLoadTime = Date.now();
        console.log("[ConfigManager] Loaded config from", CONFIG_PATH);
      } else {
        console.log("[ConfigManager] Config file not found, using defaults");
      }
    } catch (error) {
      console.error("[ConfigManager] Load error:", error);
    }
  }

  /**
   * Get configuration for a specific strategy
   */
  getStrategyConfig(strategy: StrategyType): StrategyThresholds | undefined {
    // Auto-reload if file changed (check every 5s)
    if (Date.now() - this.lastLoadTime > 5000) {
      try {
        const stat = fs.statSync(CONFIG_PATH);
        if (stat.mtimeMs > this.lastLoadTime) {
          this.load();
        }
      } catch {
        // Ignore stat errors
      }
    }
    return this.config[strategy];
  }

  /**
   * Update configuration for a strategy
   */
  updateStrategyConfig(strategy: StrategyType, updates: Partial<StrategyThresholds>): void {
    if (!this.config[strategy]) {
      this.config[strategy] = {};
    }
    Object.assign(this.config[strategy]!, updates);
    this.save();
  }

  /**
   * Save current configuration to JSON file
   */
  save(): void {
    try {
      // Ensure directory exists
      const dir = path.dirname(CONFIG_PATH);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(CONFIG_PATH, JSON.stringify(this.config, null, 2));
      console.log("[ConfigManager] Saved config to", CONFIG_PATH);
    } catch (error) {
      console.error("[ConfigManager] Save error:", error);
    }
  }

  /**
   * Force reload from file
   */
  reload(): void {
    this.load();
  }

  /**
   * Get all configurations
   */
  getAllConfigs(): Partial<Record<StrategyType, StrategyThresholds>> {
    return { ...this.config };
  }
}

// Singleton instance
export const configManager = new ConfigManager();
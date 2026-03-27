// === Settings Types ===

import type { SimulationConfig } from "./api.types";

export interface UserSettings {
  defaultBetSize: number;
  autoRefreshInterval: number;
  enableSoundEffects: boolean;
  enableNotifications: boolean;
  theme: "dark" | "light" | "system";
  riskSettings: {
    maxDailyLoss: number;
    maxPositionSize: number;
    maxOpenPositions: number;
  };
}

export interface AppState {
  isInitialized: boolean;
  isLoading: boolean;
  error: string | null;
  simulationMode: SimulationConfig["mode"];
  lastUpdated: number;
}
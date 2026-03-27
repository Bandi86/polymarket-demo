// Dashboard constants and configuration

import type { TabId } from "../TopDashboard";
import { BarChart2, Activity, Shield, FlaskConical, Trophy, Settings } from "lucide-react";

export const TABS: { id: TabId; label: string; icon: typeof BarChart2 }[] = [
  { id: 'trade', label: 'Manual Trade', icon: BarChart2 },
  { id: 'monitor', label: 'Monitor', icon: Activity },
  { id: 'risk', label: 'Risk', icon: Shield },
  { id: 'backtest', label: 'Backtest', icon: FlaskConical },
  { id: 'leaderboard', label: 'Leaderboard', icon: Trophy },
  { id: 'config', label: 'Config', icon: Settings },
];

export const ASSETS = ["BTC", "ETH", "SOL", "XRP"];

export const TIMEFRAMES = [
  { id: "5", label: "5m" },
  { id: "15", label: "15m" },
  { id: "60", label: "1h" },
  { id: "240", label: "4h" },
];

export const QUICK_RUN_OPTIONS = [
  { minutes: 30, label: "30m" },
  { minutes: 60, label: "1h" },
  { minutes: 120, label: "2h" },
  { minutes: 240, label: "4h" },
];
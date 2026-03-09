import { Bot as BotIcon, BarChart3, Activity } from "lucide-react";
import { cn, formatCurrency, formatPercentage } from "../lib/utils";
import { Card, CardHeader, CardContent } from "./ui/card";
import { Badge } from "./ui/badge";
import { Input } from "./ui/input";
import { Switch } from "./ui/switch";
import { Tabs, TabsList, TabsTrigger } from "./ui/tabs";
import type { BotConfig, BotSession, TradeEvent } from "../types";

interface BotManagementProps {
  bots: BotConfig[];
  sessions: BotSession[];
  events: TradeEvent[];
  activeTab: string;
  onTabChange: (tab: string) => void;
  onToggleBot: (botId: string) => void;
  onUpdateBot: (botId: string, field: string, value: unknown) => void;
}

export function BotManagement({
  bots,
  sessions,
  events,
  activeTab,
  onTabChange,
  onToggleBot,
  onUpdateBot,
}: BotManagementProps) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <Tabs value={activeTab} onValueChange={onTabChange}>
          <TabsList>
            <TabsTrigger value="bots" isActive={activeTab === "bots"} onClick={() => onTabChange("bots")}>
              <BotIcon className="w-3 h-3 mr-1" />
              Bots
            </TabsTrigger>
            <TabsTrigger value="sessions" isActive={activeTab === "sessions"} onClick={() => onTabChange("sessions")}>
              <BarChart3 className="w-3 h-3 mr-1" />
              Sessions
            </TabsTrigger>
            <TabsTrigger value="activity" isActive={activeTab === "activity"} onClick={() => onTabChange("activity")}>
              <Activity className="w-3 h-3 mr-1" />
              Activity
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </CardHeader>

      <CardContent className="p-0">
        {activeTab === "bots" && (
          <div className="divide-y divide-[var(--color-border)] max-h-[400px] overflow-y-auto">
            {bots.map((bot) => (
              <div key={bot.id} className={cn("p-3", bot.enabled && "bg-[var(--color-primary-muted)]")}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <BotIcon className={cn("w-4 h-4", bot.enabled ? "text-[var(--color-primary)]" : "text-[var(--color-text-muted)]")} />
                    <span className="font-medium text-sm">{bot.name}</span>
                  </div>
                  <Switch checked={bot.enabled} onChange={() => onToggleBot(bot.id)} />
                </div>

                <div className="grid grid-cols-2 gap-2 mb-2">
                  <div>
                    <label className="text-xs text-[var(--color-text-muted)]">Bet $</label>
                    <Input
                      type="number"
                      value={bot.betSize}
                      onChange={(v) => onUpdateBot(bot.id, "betSize", parseFloat(v))}
                      min={0.1}
                      step={0.1}
                      className="text-sm py-1"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-[var(--color-text-muted)]">Interval (s)</label>
                    <Input
                      type="number"
                      value={bot.interval / 1000}
                      onChange={(v) => onUpdateBot(bot.id, "interval", parseFloat(v) * 1000)}
                      min={1}
                      className="text-sm py-1"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-2 mb-2">
                  <input
                    type="checkbox"
                    checked={bot.useKelly || false}
                    onChange={(e) => onUpdateBot(bot.id, "useKelly", e.target.checked)}
                    className="rounded border-[var(--color-border)]"
                  />
                  <span className="text-xs text-[var(--color-text-muted)]">Use Kelly Criterion</span>
                </div>

                <div className="flex gap-3 text-xs">
                  <span className="text-[var(--color-text-muted)]">
                    Trades: <span className="text-[var(--color-text-primary)]">{bot.stats.trades}</span>
                  </span>
                  <span className="text-[var(--color-text-muted)]">
                    WR: <span className={bot.stats.winRate >= 0.5 ? "text-[var(--color-success)]" : "text-[var(--color-danger)]"}>
                      {formatPercentage(bot.stats.winRate)}
                    </span>
                  </span>
                  <span className="text-[var(--color-text-muted)]">
                    P&L: <span className={bot.stats.pnl >= 0 ? "text-[var(--color-success)]" : "text-[var(--color-danger)]"}>
                      {formatCurrency(bot.stats.pnl)}
                    </span>
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}

        {activeTab === "sessions" && (
          <div className="divide-y divide-[var(--color-border)] max-h-[400px] overflow-y-auto">
            {sessions.length ? (
              sessions.slice(0, 10).map((s) => (
                <div key={s.id} className="p-3 hover:bg-[var(--color-surface-elevated)] transition-colors">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-medium text-sm">{s.botName}</span>
                    <span className={cn("font-mono text-sm", s.totalPnL >= 0 ? "text-[var(--color-success)]" : "text-[var(--color-danger)]")}>
                      {formatCurrency(s.totalPnL)}
                    </span>
                  </div>
                  <p className="text-xs text-[var(--color-text-muted)]">
                    {new Date(s.startTime).toLocaleDateString()} | {s.totalTrades} trades | {formatPercentage(s.winningTrades / (s.totalTrades || 1))} WR
                  </p>
                </div>
              ))
            ) : (
              <div className="p-8 text-center text-[var(--color-text-muted)]">
                <BarChart3 className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No sessions yet</p>
              </div>
            )}
          </div>
        )}

        {activeTab === "activity" && (
          <div className="divide-y divide-[var(--color-border)] max-h-[400px] overflow-y-auto">
            {events.length ? (
              events.slice().reverse().slice(0, 30).map((e, i) => (
                <div key={i} className="p-2 hover:bg-[var(--color-surface-elevated)] transition-colors">
                  <div className="flex items-start gap-2">
                    <span className="text-xs text-[var(--color-text-muted)] whitespace-nowrap">
                      {new Date(e.time).toLocaleTimeString()}
                    </span>
                    <span className="text-xs">
                      {e.type === "trade" && (
                        <span className="text-[var(--color-text-secondary)]">
                          🤖 <span className="text-[var(--color-primary)]">{e.bot}</span> bet{" "}
                          <Badge variant={e.outcome === "YES" ? "success" : "danger"} className="text-xs">
                            {e.outcome}
                          </Badge>{" "}
                          ${e.amount?.toFixed(2)}
                        </span>
                      )}
                      {e.type === "manual_trade" && (
                        <span className="text-[var(--color-text-secondary)]">
                          👆 Manual{" "}
                          <Badge variant={e.outcome === "YES" ? "success" : "danger"} className="text-xs">
                            {e.outcome}
                          </Badge>{" "}
                          ${e.amount?.toFixed(2)}
                        </span>
                      )}
                      {e.type === "bot_started" && (
                        <span className="text-[var(--color-success)]">▶️ {e.bot} started</span>
                      )}
                      {e.type === "bot_stopped" && (
                        <span className="text-[var(--color-danger)]">⏹️ {e.bot} stopped</span>
                      )}
                      {e.type === "market_settled" && (
                        <span className="text-[var(--color-primary)]">🎯 Market settled: {e.outcome}</span>
                      )}
                    </span>
                  </div>
                </div>
              ))
            ) : (
              <div className="p-8 text-center text-[var(--color-text-muted)]">
                <Activity className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No activity yet</p>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

import { ChevronUp, ChevronDown, Target, RefreshCw, ArrowRightLeft, Calendar } from "lucide-react";
import { cn, formatCurrency } from "../lib/utils";
import { Card, CardHeader, CardTitle, CardContent } from "./ui/card";
import { Badge } from "./ui/badge";
import { Input } from "./ui/input";
import { PriceChart } from "./price-chart";
import type { Market } from "../types";

interface MarketCardProps {
  market: Market | null;
  yesPrice: number;
  noPrice: number;
  yesPayout: number;
  noPayout: number;
  tradeAmount: number;
  fee: number;
  balance: number;
  endDate: string;
  availableMarkets: Market[];
  showMarketSelector: boolean;
  onTrade: (outcome: "YES" | "NO") => void;
  onTradeAmountChange: (amount: number) => void;
  onToggleSelector: () => void;
  onSwitchMarket: (marketId: string) => void;
}

export function MarketCard({
  market,
  yesPrice,
  noPrice,
  yesPayout,
  noPayout,
  tradeAmount,
  fee,
  balance,
  endDate,
  availableMarkets,
  showMarketSelector,
  onTrade,
  onTradeAmountChange,
  onToggleSelector,
  onSwitchMarket,
}: MarketCardProps) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Target className="w-4 h-4 text-[var(--color-primary)]" />
          <CardTitle className="text-sm">Active Market</CardTitle>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onToggleSelector}
            className="text-xs bg-[var(--color-surface-elevated)] hover:bg-[var(--color-surface-hover)] px-3 py-1 rounded-lg border border-[var(--color-border)] transition-colors flex items-center gap-1"
          >
            <ArrowRightLeft className="w-3 h-3" />
            Switch
          </button>
          <Badge variant={market ? "success" : "default"}>
            {market ? "Live" : "Loading"}
          </Badge>
        </div>
      </CardHeader>

      {/* Market Selector Dropdown */}
      {showMarketSelector && (
        <div className="mx-4 mb-3 p-3 bg-[var(--color-surface-elevated)] rounded-lg border border-[var(--color-border)] max-h-[200px] overflow-y-auto">
          <p className="text-xs text-[var(--color-text-muted)] mb-2 font-medium">Available Markets ({availableMarkets.length})</p>
          {availableMarkets.length === 0 ? (
            <p className="text-xs text-[var(--color-text-muted)]">Loading markets...</p>
          ) : (
            <div className="space-y-1">
              {availableMarkets.map((m) => (
                <button
                  key={m.id}
                  onClick={() => onSwitchMarket(m.id)}
                  className={cn(
                    "w-full text-left p-2 rounded-lg text-xs hover:bg-[var(--color-surface-hover)] transition-colors flex justify-between items-center",
                    market?.id === m.id && "bg-[var(--color-primary)]/10 border border-[var(--color-primary)]/30"
                  )}
                >
                  <span className="truncate mr-2 flex-1">{m.question}</span>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="font-mono text-[var(--color-success)]">{(parseFloat(m.outcomePrices.yes) * 100).toFixed(0)}¢</span>
                    <span className="text-[var(--color-text-muted)]">${(m.volumeNum || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      <CardContent className="p-4">
        {market ? (
          <>
            {/* Market Header */}
            <div className="mb-4 flex gap-4">
              {market.imageUrl && (
                <img src={market.imageUrl} alt="" className="w-14 h-14 rounded-lg object-cover border border-[var(--color-border)] shrink-0" />
              )}
              <div>
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <Badge variant="default" className="text-[10px] uppercase tracking-wider">{market.category || "Crypto"}</Badge>
                  <span className="text-[10px] text-[var(--color-text-muted)]">
                    <Calendar className="w-3 h-3 inline mr-1" />
                    Ends {endDate}
                  </span>
                </div>
                <h2 className="text-lg font-bold leading-tight">{market.question}</h2>
              </div>
            </div>

            {/* Market Info */}
            <div className="flex gap-6 mb-4 text-xs text-[var(--color-text-muted)]">
              <div>
                <span className="block mb-0.5">Volume</span>
                <span className="font-mono text-[var(--color-text-primary)] font-medium">
                  ${(market.volumeNum || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                </span>
              </div>
              <div>
                <span className="block mb-0.5">Liquidity</span>
                <span className="font-mono text-[var(--color-text-primary)] font-medium">
                  ${(market.liquidity || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                </span>
              </div>
              {market.resolutionSource && (
                <div>
                  <span className="block mb-0.5">Source</span>
                  <span className="text-[var(--color-text-primary)] font-medium">{market.resolutionSource}</span>
                </div>
              )}
            </div>

            {/* YES Probability Chart */}
            <div className="bg-[var(--color-surface-elevated)] rounded-lg p-3 mb-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-[var(--color-text-muted)]">YES Probability</span>
                <span className="text-xs font-mono text-[var(--color-success)] font-bold">{(yesPrice * 100).toFixed(1)}%</span>
              </div>
              <PriceChart data={market.yesPriceHistory || []} height={150} isProbability={true} />
            </div>

            {/* Probability Bar */}
            <div className="mb-5">
              <div className="flex justify-between text-xs mb-1">
                <span className="text-[var(--color-success)] font-bold">YES {(yesPrice * 100).toFixed(1)}%</span>
                <span className="text-[var(--color-danger)] font-bold">NO {(noPrice * 100).toFixed(1)}%</span>
              </div>
              <div className="h-3 bg-[var(--color-surface-elevated)] rounded-full overflow-hidden flex">
                <div className="h-full bg-[var(--color-success)] transition-all duration-500" style={{ width: `${yesPrice * 100}%` }} />
                <div className="h-full bg-[var(--color-danger)] transition-all duration-500" style={{ width: `${noPrice * 100}%` }} />
              </div>
            </div>

            {/* Trade Buttons */}
            <div className="grid grid-cols-2 gap-3 mb-4">
              <button
                onClick={() => onTrade("YES")}
                disabled={balance < tradeAmount + fee}
                className="p-4 bg-[var(--color-success-muted)] border border-[var(--color-success)]/30 rounded-xl hover:border-[var(--color-success)] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-base font-bold text-[var(--color-success)]">Buy YES</span>
                  <ChevronUp className="w-4 h-4 text-[var(--color-success)]" />
                </div>
                <p className="text-2xl font-bold text-[var(--color-success)]">{(yesPrice * 100).toFixed(1)}¢</p>
                <p className="text-xs text-[var(--color-text-muted)] mt-1">
                  Win {formatCurrency(yesPayout - tradeAmount - fee)}
                </p>
              </button>

              <button
                onClick={() => onTrade("NO")}
                disabled={balance < tradeAmount + fee}
                className="p-4 bg-[var(--color-danger-muted)] border border-[var(--color-danger)]/30 rounded-xl hover:border-[var(--color-danger)] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-base font-bold text-[var(--color-danger)]">Buy NO</span>
                  <ChevronDown className="w-4 h-4 text-[var(--color-danger)]" />
                </div>
                <p className="text-2xl font-bold text-[var(--color-danger)]">{(noPrice * 100).toFixed(1)}¢</p>
                <p className="text-xs text-[var(--color-text-muted)] mt-1">
                  Win {formatCurrency(noPayout - tradeAmount - fee)}
                </p>
              </button>
            </div>

            {/* Bet Amount */}
            <div className="flex gap-3">
              <div className="flex-1">
                <label className="text-xs text-[var(--color-text-muted)] mb-1 block">Bet Amount</label>
                <div className="flex gap-2">
                  <Input
                    type="number"
                    value={tradeAmount}
                    onChange={(v) => onTradeAmountChange(Math.max(0.01, parseFloat(v) || 0))}
                    min={0.01}
                    step={0.1}
                    className="flex-1"
                  />
                  <div className="flex gap-1">
                    {[0.25, 0.5, 1, 2, 5].map((a) => (
                      <button
                        key={a}
                        onClick={() => onTradeAmountChange(a)}
                        className={cn(
                          "px-2 py-1 text-xs rounded border transition-all",
                          tradeAmount === a
                            ? "bg-[var(--color-primary)] border-[var(--color-primary)] text-white"
                            : "bg-[var(--color-surface-elevated)] border-[var(--color-border)] text-[var(--color-text-secondary)] hover:border-[var(--color-primary)]"
                        )}
                      >
                        ${a}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              <div className="flex flex-col justify-end">
                <p className="text-xs text-[var(--color-text-muted)]">Fee (2%)</p>
                <p className="font-mono text-sm">{formatCurrency(fee)}</p>
              </div>
            </div>
          </>
        ) : (
          <div className="text-center py-8 text-[var(--color-text-muted)]">
            <RefreshCw className="w-8 h-8 mx-auto mb-2 animate-spin" />
            <p>Searching for active Polymarket markets...</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

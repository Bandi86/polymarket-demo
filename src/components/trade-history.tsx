import { History, CheckCircle2, XCircle } from "lucide-react";
import { cn, formatCurrency } from "../lib/utils";
import { Card, CardHeader, CardTitle, CardContent } from "./ui/card";
import { Badge } from "./ui/badge";
import type { Position } from "../types";

interface TradeHistoryProps {
  positions: Position[];
}

export function TradeHistory({ positions }: TradeHistoryProps) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <History className="w-4 h-4 text-[var(--color-primary)]" />
          <CardTitle className="text-sm">Trade History</CardTitle>
        </div>
        <Badge>{positions.length || 0}</Badge>
      </CardHeader>
      <CardContent className="p-0 max-h-[300px] overflow-y-auto">
        {positions.length ? (
          <div className="divide-y divide-[var(--color-border)]">
            {positions.slice().reverse().slice(0, 20).map((pos) => (
              <div key={pos.id} className="p-3 flex items-center justify-between hover:bg-[var(--color-surface-elevated)] transition-colors">
                <div className="flex items-center gap-3">
                  {pos.pnl && pos.pnl > 0 ? (
                    <CheckCircle2 className="w-4 h-4 text-[var(--color-success)]" />
                  ) : (
                    <XCircle className="w-4 h-4 text-[var(--color-danger)]" />
                  )}
                  <Badge variant={pos.outcome === "YES" ? "success" : "danger"}>{pos.outcome}</Badge>
                  <span className="text-sm">@{pos.odds.toFixed(3)}</span>
                </div>
                <p className={cn("font-mono text-sm", (pos.pnl || 0) >= 0 ? "text-[var(--color-success)]" : "text-[var(--color-danger)]")}>
                  {formatCurrency(pos.pnl || 0)}
                </p>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-8 text-center text-[var(--color-text-muted)]">
            <History className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No closed positions yet</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

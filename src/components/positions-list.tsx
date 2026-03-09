import { Wallet } from "lucide-react";
import { cn, formatCurrency } from "../lib/utils";
import { Card, CardHeader, CardTitle, CardContent } from "./ui/card";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import type { Position } from "../types";

interface PositionsListProps {
  positions: Position[];
  onClosePosition: (positionId: string) => void;
}

export function PositionsList({ positions, onClosePosition }: PositionsListProps) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Wallet className="w-4 h-4 text-[var(--color-primary)]" />
          <CardTitle className="text-sm">Open Positions</CardTitle>
        </div>
        <Badge>{positions.length || 0}</Badge>
      </CardHeader>
      <CardContent className="p-0">
        {positions.length ? (
          <div className="divide-y divide-[var(--color-border)]">
            {positions.map((pos) => (
              <div key={pos.id} className="p-3 flex items-center justify-between hover:bg-[var(--color-surface-elevated)] transition-colors">
                <div className="flex items-center gap-3">
                  <Badge variant={pos.outcome === "YES" ? "success" : "danger"}>{pos.outcome}</Badge>
                  <div>
                    <p className="font-medium text-sm">{formatCurrency(pos.amount)} @ {pos.odds.toFixed(3)}</p>
                    <p className="text-xs text-[var(--color-text-muted)]">Fee: {formatCurrency(pos.fee || 0)}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <p className={cn("font-mono text-sm", (pos.unrealizedPnl || 0) >= 0 ? "text-[var(--color-success)]" : "text-[var(--color-danger)]")}>
                      {formatCurrency(pos.unrealizedPnl || 0)}
                    </p>
                    <p className="text-xs text-[var(--color-text-muted)]">Unrealized</p>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => onClosePosition(pos.id)}>
                    Close
                  </Button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-8 text-center text-[var(--color-text-muted)]">
            <Wallet className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No open positions</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

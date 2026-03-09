import { LineChart } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "./ui/card";
import { Badge } from "./ui/badge";
import type { MarketHistory } from "../types";

interface MarketHistoryProps {
  history: MarketHistory[];
}

export function MarketHistory({ history }: MarketHistoryProps) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <LineChart className="w-4 h-4 text-[var(--color-primary)]" />
          <CardTitle className="text-sm">Market History</CardTitle>
        </div>
        <Badge>{history.length}</Badge>
      </CardHeader>
      <CardContent className="p-0 max-h-[200px] overflow-y-auto">
        {history.length ? (
          <div className="divide-y divide-[var(--color-border)]">
            {history.slice(0, 15).map((m, i) => (
              <div key={i} className="p-2 flex items-center justify-between hover:bg-[var(--color-surface-elevated)] transition-colors">
                <div className="flex items-center gap-2">
                  <Badge variant={m.result === "UP" ? "success" : "danger"}>{m.result}</Badge>
                  <span className="text-xs text-[var(--color-text-muted)]">
                    ${m.startPrice.toLocaleString()} → ${m.endPrice.toLocaleString()}
                  </span>
                </div>
                <span className="text-xs text-[var(--color-text-muted)]">
                  {new Date(m.endTime).toLocaleTimeString()}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-4 text-center text-[var(--color-text-muted)] text-sm">
            No completed markets
          </div>
        )}
      </CardContent>
    </Card>
  );
}

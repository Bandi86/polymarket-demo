import { Zap, Play, Square, RefreshCw, RotateCcw } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "./ui/card";
import { Button } from "./ui/button";

interface QuickActionsProps {
  onRunAll: () => void;
  onStopAll: () => void;
  onRefresh: () => void;
  onReset: () => void;
}

export function QuickActions({ onRunAll, onStopAll, onRefresh, onReset }: QuickActionsProps) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Zap className="w-4 h-4 text-[var(--color-primary)]" />
          <CardTitle className="text-sm">Quick Actions</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="p-4">
        <div className="grid grid-cols-2 gap-2">
          <Button variant="primary" size="sm" onClick={onRunAll} className="flex items-center gap-1">
            <Play className="w-3 h-3" />
            Run All Bots
          </Button>
          <Button variant="secondary" size="sm" onClick={onStopAll} className="flex items-center gap-1">
            <Square className="w-3 h-3" />
            Stop All
          </Button>
          <Button variant="outline" size="sm" onClick={onRefresh} className="flex items-center gap-1">
            <RefreshCw className="w-3 h-3" />
            New Market
          </Button>
          <Button variant="outline" size="sm" onClick={onReset} className="flex items-center gap-1">
            <RotateCcw className="w-3 h-3" />
            Reset All
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

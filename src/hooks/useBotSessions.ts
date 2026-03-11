import { useState, useEffect, useCallback } from "react";
import type { BotSession } from "../types";

interface UseBotSessionsOptions {
  strategy?: string;
  limit?: number;
}

export function useBotSessions(options: UseBotSessionsOptions = {}) {
  const [sessions, setSessions] = useState<BotSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSessions = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (options.strategy) params.append("strategy", options.strategy);
      if (options.limit) params.append("limit", String(options.limit));

      const res = await fetch(`/api/sessions?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to fetch sessions");
      const data = await res.json();
      setSessions(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, [options.strategy, options.limit]);

  useEffect(() => {
    fetchSessions();
    // Refresh every 10 seconds
    const interval = setInterval(fetchSessions, 10000);
    return () => clearInterval(interval);
  }, [fetchSessions]);

  return { sessions, loading, error, refetch: fetchSessions };
}
// API Endpoint for Strategy Configuration
// GET: Get strategy config
// POST: Update strategy config

import { NextRequest, NextResponse } from "next/server";
import { configManager } from "@/lib/config/runtime-config";
import type { StrategyType } from "@/types";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ name: string }> }
) {
  const { name } = await params;
  const strategy = name as StrategyType;
  const config = configManager.getStrategyConfig(strategy);

  if (!config) {
    return NextResponse.json({
      strategy,
      config: {},
      message: "No custom config, using defaults",
    });
  }

  return NextResponse.json({ strategy, config });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ name: string }> }
) {
  const { name } = await params;
  const strategy = name as StrategyType;
  const body = await request.json();

  // Validate that body contains valid threshold keys
  const validKeys = [
    "minDelta",
    "minEdge",
    "minConfidence",
    "minPrice",
    "maxPrice",
    "minTimeRemaining",
    "maxTimeRemaining",
    "signalMaxAge",
  ];

  const updates: Record<string, number> = {};
  for (const [key, value] of Object.entries(body)) {
    if (validKeys.includes(key) && typeof value === "number") {
      updates[key] = value;
    }
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json(
      { error: "No valid threshold updates provided" },
      { status: 400 }
    );
  }

  configManager.updateStrategyConfig(strategy, updates);

  return NextResponse.json({
    strategy,
    config: configManager.getStrategyConfig(strategy),
    message: "Config updated",
  });
}
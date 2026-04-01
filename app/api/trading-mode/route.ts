import { NextResponse } from "next/server";
import { botManager } from "@/lib/bot-manager";

export async function GET() {
  const mode = botManager.getTradingMode();
  return NextResponse.json({ mode });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { mode } = body;

    if (mode !== "demo" && mode !== "live") {
      return NextResponse.json(
        { error: "Invalid mode. Must be 'demo' or 'live'" },
        { status: 400 }
      );
    }

    // Check if bots are running
    const bots = botManager.getBots();
    const runningBots = bots.filter(b => b.enabled);
    if (runningBots.length > 0) {
      return NextResponse.json(
        { error: "Cannot change mode while bots are running. Stop all bots first." },
        { status: 400 }
      );
    }

    botManager.setTradingMode(mode);
    return NextResponse.json({ mode, success: true });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to update trading mode" },
      { status: 500 }
    );
  }
}
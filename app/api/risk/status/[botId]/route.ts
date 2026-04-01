import { NextResponse } from "next/server";
import { riskManager } from "@/lib/risk-manager";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ botId: string }> }
) {
  const { botId } = await params;
  const status = riskManager.getBotRiskStatus(botId);
  return NextResponse.json(status);
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ botId: string }> }
) {
  const { botId } = await params;
  riskManager.resumeBot(botId);
  return NextResponse.json({ success: true, botId });
}
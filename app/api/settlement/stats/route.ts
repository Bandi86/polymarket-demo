import { NextResponse } from "next/server";
import { getSettlementStats } from "@/lib/settlement-validator";

export async function GET() {
  const stats = getSettlementStats();
  return NextResponse.json(stats);
}
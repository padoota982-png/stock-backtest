import { NextResponse } from "next/server";
import { readFileSync } from "fs";
import { join } from "path";

export async function GET() {
  try {
    const filePath = join(process.cwd(), "..", "stock-backtest", "daily_summary.json");
    const raw = readFileSync(filePath, "utf-8");
    const data = JSON.parse(raw);
    return NextResponse.json({ data });
  } catch (e) {
    return NextResponse.json({ error: "取得失敗", data: [] }, { status: 500 });
  }
}
import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

function getTodayStr(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export async function GET() {
  try {
    // vix.jsonから当日のVIXを取得
    const vixPath = path.join(process.env.HOME || "", "stock-backtest", "vix.json");
    let vix = 20;
    if (fs.existsSync(vixPath)) {
      const vixData = JSON.parse(fs.readFileSync(vixPath, "utf-8"));
      const today = getTodayStr();
      // 直近のVIXを取得
      const keys = Object.keys(vixData).sort();
      const latestKey = keys[keys.length - 1];
      vix = vixData[today] ?? vixData[latestKey] ?? 20;
    }

    // 日経トレンド（簡易：VIXから推定）
    const nikkeiTrend = vix < 18 ? "up" : vix > 25 ? "down" : "flat";

    return NextResponse.json({
      vix,
      nikkeiTrend,
      vixSpike: vix > 30,
      nikkeiShock: vix > 35,
      forexShock: false,
    });
  } catch (e) {
    return NextResponse.json({
      vix: 20,
      nikkeiTrend: "flat",
      vixSpike: false,
      nikkeiShock: false,
      forexShock: false,
    });
  }
}

import { NextResponse } from "next/server";

const API_KEY = process.env.JQUANTS_API_KEY!;

function getLastNDays(dateStr: string, n: number): string[] {
  const dates: string[] = [];
  const end = new Date(
    dateStr.slice(0, 4) + "-" + dateStr.slice(4, 6) + "-" + dateStr.slice(6, 8)
  );

  let count = 0;
  let i = 0;
  while (count < n) {
    const d = new Date(end);
    d.setDate(d.getDate() - i);
    if (d.getDay() !== 0 && d.getDay() !== 6) {
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, "0");
      const day = String(d.getDate()).padStart(2, "0");
      dates.unshift(`${y}${m}${day}`);
      count++;
    }
    i++;
  }

  return dates;
}

function getTodayStr(): string {
  const now = new Date();
  // 日本時間に変換
  const jst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  const y = jst.getUTCFullYear();
  const m = String(jst.getUTCMonth() + 1).padStart(2, "0");
  const d = String(jst.getUTCDate()).padStart(2, "0");
  // 15時以降なら当日、それ以前なら前日扱い
  const hour = jst.getUTCHours();
  if (hour < 15) {
    // 前営業日を返す
    const prev = new Date(jst);
    prev.setUTCDate(prev.getUTCDate() - 1);
    // 土日をスキップ
    while (prev.getUTCDay() === 0 || prev.getUTCDay() === 6) {
      prev.setUTCDate(prev.getUTCDate() - 1);
    }
    return `${prev.getUTCFullYear()}${String(prev.getUTCMonth() + 1).padStart(2, "0")}${String(prev.getUTCDate()).padStart(2, "0")}`;
  }
  return `${y}${m}${d}`;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  // dateが指定されていなければ今日の日付を自動取得
  const date = searchParams.get("date") ?? getTodayStr();
  // daysパラメータで取得日数を指定可能（デフォルト25日）
  const days = parseInt(searchParams.get("days") ?? "25");

  try {
    const dates = getLastNDays(date, Math.min(days, 100)); // 最大100日
    const allData: Record<string, unknown>[] = [];

    // 並列取得で高速化
    const results = await Promise.all(
      dates.map(async (d) => {
        const url = code
          ? `https://api.jquants.com/v2/equities/bars/daily?code=${code}&date=${d}`
          : `https://api.jquants.com/v2/equities/bars/daily?date=${d}`;

        const res = await fetch(url, {
          headers: { "x-api-key": API_KEY },
        });
        const data = await res.json();
        return data.data ?? [];
      })
    );

    for (const rows of results) {
      allData.push(...rows);
    }

    return NextResponse.json({ data: allData, date, days: dates.length });
  } catch (e) {
    return NextResponse.json({ error: "取得失敗" }, { status: 500 });
  }
}
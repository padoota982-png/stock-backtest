import { NextResponse } from "next/server";

const API_KEY = process.env.JQUANTS_API_KEY!;

export async function GET() {
  try {
    const res = await fetch(
      "https://api.jquants.com/v2/equities/master",
      { headers: { "x-api-key": API_KEY } }
    );
    const data = await res.json();
    return NextResponse.json(data);
  } catch (e) {
    return NextResponse.json({ error: "取得失敗" }, { status: 500 });
  }
}

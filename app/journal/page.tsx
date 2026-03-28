"use client";

import { useEffect, useMemo, useState } from "react";

type Trade = {
  id: number;
  date: string;
  code: string;
  name: string;
  type: string;
  entry: number;
  exit: number;
  shares: number;
  pnl: number;
  pnl_pct: number;
  commission: number;
  result: string;
  memo: string;
};

type TradeForm = {
  date: string;
  code: string;
  name: string;
  type: string;
  entry: string;
  exit: string;
  shares: string;
  memo: string;
};

const STORAGE_KEY = "trade-journal";

const EMPTY_FORM: TradeForm = {
  date: "",
  code: "",
  name: "",
  type: "LONG",
  entry: "",
  exit: "",
  shares: "",
  memo: "",
};

function loadTrades(): Trade[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as Trade[]) : [];
  } catch {
    return [];
  }
}

function saveTrades(trades: Trade[]): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(trades));
}

function calcCommission(amount: number): number {
  if (amount <= 100000) return 99;
  if (amount <= 200000) return 115;
  if (amount <= 500000) return 275;
  if (amount <= 1000000) return 535;
  return 640;
}

export default function JournalPage() {
  const [trades, setTrades] = useState<Trade[]>([]);
  const [showForm, setShowForm] = useState<boolean>(false);
  const [form, setForm] = useState<TradeForm>(EMPTY_FORM);

  useEffect(() => {
    setTrades(loadTrades());
  }, []);

  const totals = useMemo(() => {
    const totalPnl = trades.reduce((sum: number, t: Trade) => sum + t.pnl, 0);
    const wins = trades.filter((t: Trade) => t.pnl > 0).length;
    const losses = trades.filter((t: Trade) => t.pnl < 0).length;
    const winRate =
      trades.length > 0 ? (wins / trades.length) * 100 : 0;

    return {
      totalPnl,
      wins,
      losses,
      winRate,
      count: trades.length,
    };
  }, [trades]);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ): void => {
    const { name, value } = e.target;
    setForm((prev: TradeForm) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>): void => {
    e.preventDefault();

    const entry = Number(form.entry);
    const exit = Number(form.exit);
    const shares = Number(form.shares);

    if (!form.date || !form.code || !form.name || !entry || !exit || !shares) {
      return;
    }

    const buyAmount = entry * shares;
    const sellAmount = exit * shares;
    const commission = calcCommission(buyAmount) + calcCommission(sellAmount);

    const gross =
      form.type === "LONG"
        ? (exit - entry) * shares
        : (entry - exit) * shares;

    const pnl = gross - commission;
    const pnl_pct = entry !== 0 ? (gross / (entry * shares)) * 100 : 0;

    const newTrade: Trade = {
      id: Date.now(),
      date: form.date,
      code: form.code,
      name: form.name,
      type: form.type,
      entry,
      exit,
      shares,
      pnl,
      pnl_pct,
      commission,
      result: pnl >= 0 ? "WIN" : "LOSS",
      memo: form.memo,
    };

    const updated = [...trades, newTrade].sort((a: Trade, b: Trade) =>
      b.date.localeCompare(a.date)
    );

    setTrades(updated);
    saveTrades(updated);
    setForm(EMPTY_FORM);
    setShowForm(false);
  };

  const handleDelete = (id: number): void => {
    const updated = trades.filter((t: Trade) => t.id !== id);
    setTrades(updated);
    saveTrades(updated);
  };

  return (
    <main className="min-h-screen bg-black text-white p-6">
      <div className="mx-auto max-w-6xl">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">トレード日誌</h1>
            <p className="mt-2 text-sm text-zinc-400">
              売買履歴の記録と振り返り
            </p>
          </div>
          <button
            onClick={() => setShowForm((prev: boolean) => !prev)}
            className="rounded-xl bg-white px-4 py-2 text-black font-semibold"
          >
            {showForm ? "閉じる" : "追加"}
          </button>
        </div>

        <div className="mb-6 grid gap-4 md:grid-cols-4">
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
            <div className="text-sm text-zinc-400">総損益</div>
            <div className="mt-2 text-2xl font-bold">
              ¥{totals.totalPnl.toLocaleString()}
            </div>
          </div>
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
            <div className="text-sm text-zinc-400">勝率</div>
            <div className="mt-2 text-2xl font-bold">
              {totals.winRate.toFixed(1)}%
            </div>
          </div>
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
            <div className="text-sm text-zinc-400">勝ち数 / 負け数</div>
            <div className="mt-2 text-2xl font-bold">
              {totals.wins} / {totals.losses}
            </div>
          </div>
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
            <div className="text-sm text-zinc-400">件数</div>
            <div className="mt-2 text-2xl font-bold">{totals.count}</div>
          </div>
        </div>

        {showForm && (
          <form
            onSubmit={handleSubmit}
            className="mb-6 rounded-2xl border border-zinc-800 bg-zinc-900 p-4"
          >
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <input
                name="date"
                type="date"
                value={form.date}
                onChange={handleChange}
                className="rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2"
              />
              <input
                name="code"
                placeholder="銘柄コード"
                value={form.code}
                onChange={handleChange}
                className="rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2"
              />
              <input
                name="name"
                placeholder="銘柄名"
                value={form.name}
                onChange={handleChange}
                className="rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2"
              />
              <select
                name="type"
                value={form.type}
                onChange={handleChange}
                className="rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2"
              >
                <option value="LONG">LONG</option>
                <option value="SHORT">SHORT</option>
              </select>
              <input
                name="entry"
                type="number"
                placeholder="エントリー"
                value={form.entry}
                onChange={handleChange}
                className="rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2"
              />
              <input
                name="exit"
                type="number"
                placeholder="決済"
                value={form.exit}
                onChange={handleChange}
                className="rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2"
              />
              <input
                name="shares"
                type="number"
                placeholder="株数"
                value={form.shares}
                onChange={handleChange}
                className="rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2"
              />
              <textarea
                name="memo"
                placeholder="メモ"
                value={form.memo}
                onChange={handleChange}
                className="rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 md:col-span-2 lg:col-span-4"
              />
            </div>

            <div className="mt-4">
              <button
                type="submit"
                className="rounded-xl bg-white px-4 py-2 text-black font-semibold"
              >
                保存
              </button>
            </div>
          </form>
        )}

        <div className="rounded-2xl border border-zinc-800 bg-zinc-900 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-zinc-950 text-zinc-400">
                <tr>
                  <th className="px-4 py-3 text-left">日付</th>
                  <th className="px-4 py-3 text-left">コード</th>
                  <th className="px-4 py-3 text-left">銘柄名</th>
                  <th className="px-4 py-3 text-left">種別</th>
                  <th className="px-4 py-3 text-right">損益</th>
                  <th className="px-4 py-3 text-right">損益率</th>
                  <th className="px-4 py-3 text-left">結果</th>
                  <th className="px-4 py-3 text-left">メモ</th>
                  <th className="px-4 py-3 text-right">操作</th>
                </tr>
              </thead>
              <tbody>
                {trades.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-4 py-6 text-center text-zinc-500">
                      まだ記録がありません
                    </td>
                  </tr>
                ) : (
                  trades.map((trade: Trade) => (
                    <tr key={trade.id} className="border-t border-zinc-800">
                      <td className="px-4 py-3">{trade.date}</td>
                      <td className="px-4 py-3">{trade.code}</td>
                      <td className="px-4 py-3">{trade.name}</td>
                      <td className="px-4 py-3">{trade.type}</td>
                      <td className="px-4 py-3 text-right">
                        ¥{trade.pnl.toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {trade.pnl_pct.toFixed(2)}%
                      </td>
                      <td className="px-4 py-3">{trade.result}</td>
                      <td className="px-4 py-3">{trade.memo}</td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => handleDelete(trade.id)}
                          className="rounded-lg border border-zinc-700 px-3 py-1"
                        >
                          削除
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </main>
  );
}

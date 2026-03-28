"use client";
import { useState, useEffect } from "react";

const STORAGE_KEY = "trade_journal";

function loadTrades() {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]");
  } catch {
    return [];
  }
}

function saveTrades(trades) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(trades));
}

const EMPTY_FORM = {
  date: new Date().toISOString().slice(0, 10),
  code: "",
  name: "",
  type: "day",
  entry: "",
  exit: "",
  shares: "",
  result: "",
  memo: "",
};

export default function JournalPage() {
  const [trades, setTrades] = useState([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [showForm, setShowForm] = useState(false);
  const [filter, setFilter] = useState("all");
  const [btResults, setBtResults] = useState([]);

  useEffect(() => {
    setTrades(loadTrades());
    fetch("/api/backtest-results")
      .then((r) => r.json())
      .then((d) => setBtResults(d.data ?? []))
      .catch(() => {});
  }, []);

  const handleAdd = () => {
    if (!form.code || !form.entry || !form.exit || !form.shares) return;
    const entry = parseFloat(form.entry);
    const exit = parseFloat(form.exit);
    const shares = parseInt(form.shares);
    const pnl = (exit - entry) * shares;
    const pnlPct = ((exit - entry) / entry * 100);
    // 楽天証券手数料
    const commission = calcCommission(entry * shares) + calcCommission(exit * shares);
    const pnlNet = pnl - commission;
    const result = pnlNet >= 0 ? "WIN" : "LOSS";

    const newTrade = {
      id: Date.now(),
      date: form.date,
      code: form.code,
      name: form.name,
      type: form.type,
      entry,
      exit,
      shares,
      pnl: Math.round(pnlNet),
      pnl_pct: parseFloat(pnlPct.toFixed(2)),
      commission,
      result,
      memo: form.memo,
    };

    const updated = [...trades, newTrade].sort((a, b) => b.date.localeCompare(a.date));
    setTrades(updated);
    saveTrades(updated);
    setForm(EMPTY_FORM);
    setShowForm(false);
  };

  const handleDelete = (id) => {
    const updated = trades.filter((t) => t.id !== id);
    setTrades(updated);
    saveTrades(updated);
  };

  function calcCommission(amount) {
    if (amount <= 100000) return 99;
    if (amount <= 200000) return 115;
    if (amount <= 500000) return 275;
    if (amount <= 1000000) return 535;
    return 1013;
  }

  const filtered = trades.filter((t) => {
    if (filter === "day") return t.type === "day";
    if (filter === "swing") return t.type === "swing";
    if (filter === "win") return t.result === "WIN";
    if (filter === "loss") return t.result === "LOSS";
    return true;
  });

  const total = trades.length;
  const wins = trades.filter((t) => t.result === "WIN").length;
  const winRate = total > 0 ? (wins / total * 100).toFixed(1) : 0;
  const totalPnl = trades.reduce((a, b) => a + b.pnl, 0);

  // バックテストとの比較
  const btTotal = btResults.length;
  const btWins = btResults.filter((r) => r.result === "WIN").length;
  const btWinRate = btTotal > 0 ? (btWins / btTotal * 100).toFixed(1) : 0;
  const btPnlPct = 104.9; // 確定値

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 font-mono">
      {/* ヘッダー */}
      <header className="border-b border-zinc-800 px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <a href="/" className="text-zinc-600 hover:text-zinc-300 text-xs">← スキャナー</a>
          <span className="text-zinc-800">|</span>
          <a href="/backtest" className="text-zinc-600 hover:text-zinc-300 text-xs">バックテスト</a>
          <span className="text-zinc-800">|</span>
          <span className="text-sm font-bold tracking-widest">TRADE JOURNAL</span>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="px-4 py-1.5 text-xs bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/30 transition-colors"
        >
          + トレード記録
        </button>
      </header>

      <div className="px-6 py-4">
        {/* 入力フォーム */}
        {showForm && (
          <div className="border border-zinc-700 bg-zinc-900 p-4 mb-6">
            <div className="text-xs text-zinc-500 mb-3 tracking-wider">新規トレード記録</div>
            <div className="grid grid-cols-4 gap-3 mb-3">
              <div>
                <div className="text-xs text-zinc-600 mb-1">日付</div>
                <input
                  type="date"
                  value={form.date}
                  onChange={(e) => setForm({ ...form, date: e.target.value })}
                  className="w-full bg-zinc-800 border border-zinc-700 px-2 py-1.5 text-xs text-zinc-200"
                />
              </div>
              <div>
                <div className="text-xs text-zinc-600 mb-1">銘柄コード</div>
                <input
                  type="text"
                  value={form.code}
                  onChange={(e) => setForm({ ...form, code: e.target.value })}
                  placeholder="7203"
                  className="w-full bg-zinc-800 border border-zinc-700 px-2 py-1.5 text-xs text-zinc-200"
                />
              </div>
              <div>
                <div className="text-xs text-zinc-600 mb-1">銘柄名</div>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="トヨタ自動車"
                  className="w-full bg-zinc-800 border border-zinc-700 px-2 py-1.5 text-xs text-zinc-200"
                />
              </div>
              <div>
                <div className="text-xs text-zinc-600 mb-1">種別</div>
                <select
                  value={form.type}
                  onChange={(e) => setForm({ ...form, type: e.target.value })}
                  className="w-full bg-zinc-800 border border-zinc-700 px-2 py-1.5 text-xs text-zinc-200"
                >
                  <option value="day">デイトレ</option>
                  <option value="swing">スイング</option>
                </select>
              </div>
            </div>
            <div className="grid grid-cols-4 gap-3 mb-3">
              <div>
                <div className="text-xs text-zinc-600 mb-1">買値（円）</div>
                <input
                  type="number"
                  value={form.entry}
                  onChange={(e) => setForm({ ...form, entry: e.target.value })}
                  placeholder="3500"
                  className="w-full bg-zinc-800 border border-zinc-700 px-2 py-1.5 text-xs text-zinc-200"
                />
              </div>
              <div>
                <div className="text-xs text-zinc-600 mb-1">売値（円）</div>
                <input
                  type="number"
                  value={form.exit}
                  onChange={(e) => setForm({ ...form, exit: e.target.value })}
                  placeholder="3600"
                  className="w-full bg-zinc-800 border border-zinc-700 px-2 py-1.5 text-xs text-zinc-200"
                />
              </div>
              <div>
                <div className="text-xs text-zinc-600 mb-1">株数</div>
                <input
                  type="number"
                  value={form.shares}
                  onChange={(e) => setForm({ ...form, shares: e.target.value })}
                  placeholder="100"
                  className="w-full bg-zinc-800 border border-zinc-700 px-2 py-1.5 text-xs text-zinc-200"
                />
              </div>
              <div>
                <div className="text-xs text-zinc-600 mb-1">メモ</div>
                <input
                  type="text"
                  value={form.memo}
                  onChange={(e) => setForm({ ...form, memo: e.target.value })}
                  placeholder="シグナル通り実行"
                  className="w-full bg-zinc-800 border border-zinc-700 px-2 py-1.5 text-xs text-zinc-200"
                />
              </div>
            </div>
            {form.entry && form.exit && form.shares && (
              <div className="text-xs text-zinc-500 mb-3">
                損益予測：
                <span className={parseFloat(form.exit) >= parseFloat(form.entry) ? "text-emerald-400" : "text-red-400"}>
                  ¥{Math.round((parseFloat(form.exit) - parseFloat(form.entry)) * parseInt(form.shares) - calcCommission(parseFloat(form.entry) * parseInt(form.shares)) - calcCommission(parseFloat(form.exit) * parseInt(form.shares))).toLocaleString()}
                </span>
                （手数料込み）
              </div>
            )}
            <div className="flex gap-2">
              <button
                onClick={handleAdd}
                className="px-4 py-1.5 text-xs bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/30"
              >
                記録する
              </button>
              <button
                onClick={() => setShowForm(false)}
                className="px-4 py-1.5 text-xs text-zinc-500 border border-zinc-700 hover:text-zinc-300"
              >
                キャンセル
              </button>
            </div>
          </div>
        )}

        {/* バックテストとの比較 */}
        <div className="grid grid-cols-2 gap-3 mb-6">
          <div className="border border-zinc-700 p-4">
            <div className="text-xs text-zinc-500 mb-3 tracking-wider">📊 バックテスト（参考値）</div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <div className="text-xs text-zinc-600">損益</div>
                <div className="text-xl font-bold text-emerald-400">+{btPnlPct}%</div>
              </div>
              <div>
                <div className="text-xs text-zinc-600">勝率</div>
                <div className="text-xl font-bold text-zinc-200">{btWinRate}%</div>
              </div>
              <div>
                <div className="text-xs text-zinc-600">件数</div>
                <div className="text-xl font-bold text-zinc-200">{btTotal}件</div>
              </div>
            </div>
          </div>

          <div className="border border-emerald-500/20 bg-emerald-500/5 p-4">
            <div className="text-xs text-emerald-400 mb-3 tracking-wider">🎯 実トレード成績</div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <div className="text-xs text-zinc-600">損益合計</div>
                <div className={`text-xl font-bold ${totalPnl >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                  {totalPnl >= 0 ? "+" : ""}¥{totalPnl.toLocaleString()}
                </div>
              </div>
              <div>
                <div className="text-xs text-zinc-600">勝率</div>
                <div className={`text-xl font-bold ${parseFloat(winRate) >= 46 ? "text-emerald-400" : "text-yellow-400"}`}>
                  {winRate}%
                </div>
              </div>
              <div>
                <div className="text-xs text-zinc-600">件数</div>
                <div className="text-xl font-bold text-zinc-200">{total}件</div>
              </div>
            </div>
            {total > 0 && (
              <div className="mt-2 text-xs text-zinc-600">
                {wins}勝 / {total - wins}敗
              </div>
            )}
          </div>
        </div>

        {/* フィルター */}
        <div className="flex gap-2 mb-4">
          {[
            { key: "all", label: "すべて" },
            { key: "day", label: "デイトレ" },
            { key: "swing", label: "スイング" },
            { key: "win", label: "WIN" },
            { key: "loss", label: "LOSS" },
          ].map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`px-4 py-1.5 text-xs tracking-wider transition-all ${
                filter === f.key
                  ? "bg-zinc-100 text-zinc-900 font-bold"
                  : "text-zinc-500 hover:text-zinc-300 border border-zinc-800"
              }`}
            >
              {f.label}
            </button>
          ))}
          <span className="text-xs text-zinc-600 self-center ml-2">{filtered.length}件</span>
        </div>

        {/* トレード一覧 */}
        {filtered.length === 0 ? (
          <div className="border border-zinc-800 p-8 text-center text-zinc-600 text-sm">
            まだトレード記録がありません。「+ トレード記録」から追加してください。
          </div>
        ) : (
          <div className="border border-zinc-800">
            <div className="grid grid-cols-9 gap-2 px-4 py-2 border-b border-zinc-800 text-xs text-zinc-600">
              <div>日付</div>
              <div>コード</div>
              <div>銘柄名</div>
              <div>種別</div>
              <div>買値</div>
              <div>売値</div>
              <div>損益%</div>
              <div>損益額</div>
              <div>結果</div>
            </div>
            {filtered.map((t) => (
              <div
                key={t.id}
                className={`grid grid-cols-9 gap-2 px-4 py-2 border-b border-zinc-800/40 text-xs hover:bg-zinc-900 group ${
                  t.result === "WIN" ? "border-l-2 border-l-emerald-500/30" : "border-l-2 border-l-red-500/30"
                }`}
              >
                <div className="text-zinc-500">{t.date}</div>
                <div className="text-zinc-300 font-bold">{t.code}</div>
                <div className="text-zinc-400 truncate">{t.name || "-"}</div>
                <div className={t.type === "day" ? "text-blue-400" : "text-purple-400"}>
                  {t.type === "day" ? "デイ" : "SW"}
                </div>
                <div className="text-zinc-400">¥{t.entry?.toLocaleString()}</div>
                <div className="text-zinc-400">¥{t.exit?.toLocaleString()}</div>
                <div className={t.pnl_pct >= 0 ? "text-emerald-400" : "text-red-400"}>
                  {t.pnl_pct >= 0 ? "+" : ""}{t.pnl_pct}%
                </div>
                <div className={t.pnl >= 0 ? "text-emerald-400" : "text-red-400"}>
                  {t.pnl >= 0 ? "+" : ""}¥{t.pnl?.toLocaleString()}
                </div>
                <div className="flex items-center gap-2">
                  <span className={`font-bold ${t.result === "WIN" ? "text-emerald-400" : "text-red-400"}`}>
                    {t.result}
                  </span>
                  <button
                    onClick={() => handleDelete(t.id)}
                    className="opacity-0 group-hover:opacity-100 text-zinc-600 hover:text-red-400 transition-all"
                  >
                    ×
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
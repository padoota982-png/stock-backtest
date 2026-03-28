"use client";
import { useMemo, useState, useEffect } from "react";

const DAYTRADE_CONFIG = {
  stable: {
    label: "安定モード", badge: "🟢",
    symbols: ["6920", "6857"],
    stop_atr: 1.0, rr: 2.5, max_entries: 2, vix_max: 20,
    stats: { return: "+85.1%", winrate: "61.7%", ev: "+0.486%", max_dd: "-13.3%", max_streak: "5連敗", period: "60日" },
    risk: "資金の0.5〜1%/トレード",
  },
  aggressive: {
    label: "攻めモード", badge: "🔥",
    symbols: ["6920", "6857", "8035"],
    stop_atr: 1.0, rr: 2.5, max_entries: 2, vix_max: 20,
    stats: { return: "+139.1%", winrate: "67.8%", ev: "+0.466%", max_dd: "-16.6%", max_streak: "7連敗", period: "60日" },
    risk: "資金の0.5%/トレード",
  },
};

const STOCK_PRIORITY: Record<string, { rank: string; label: string; color: string }> = {
  "6920": { rank: "S", label: "最強",   color: "text-red-400" },
  "6857": { rank: "A", label: "安定",   color: "text-yellow-400" },
  "8035": { rank: "B", label: "補助",   color: "text-blue-400" },
};

const MOCK_MARKET = { vix: 18, nikkeiTrend: "up", vixSpike: false, nikkeiShock: false, forexShock: false };

function buildDaytradeSignal(code: string, name: string, prices: any[]) {
  if (!prices || prices.length === 0) return null;
  const sorted = [...prices].sort((a, b) => a.Date.localeCompare(b.Date));
  const latest = sorted[sorted.length - 1];
  if (!latest.C || !latest.O) return null;

  const close = latest.C, open = latest.O, vol = latest.Vo ?? 1000000;
  const closes = sorted.map((p: any) => p.C).filter(Boolean);
  const ma5  = closes.length >= 5  ? closes.slice(-5).reduce((a: number,b: number)=>a+b,0)/5   : close;
  const ma25 = closes.length >= 25 ? closes.slice(-25).reduce((a: number,b: number)=>a+b,0)/25 : close;
  const ma5p = closes.length >= 6  ? closes.slice(-6,-1).reduce((a: number,b: number)=>a+b,0)/5 : ma5;
  const ma5slope = ma5 - ma5p;
  const atrs = sorted.map((p: any) => (p.H??p.C)-(p.L??p.C)).filter(Boolean);
  const atr  = atrs.length > 0 ? atrs.slice(-14).reduce((a: number,b: number)=>a+b,0)/Math.min(14,atrs.length) : close*0.02;
  const vols = sorted.map((p: any) => p.Vo).filter(Boolean);
  const avgVol = vols.length > 0 ? vols.reduce((a: number,b: number)=>a+b,0)/vols.length : vol;
  const volRatio = vol / avgVol;
  const prevHigh = sorted.length >= 2 ? sorted[sorted.length-2].H ?? close : close;
  const high20   = Math.max(...sorted.slice(-20).map((p: any) => p.H ?? p.C).filter(Boolean));
  const changePct = open > 0 ? parseFloat((((close-open)/open)*100).toFixed(2)) : 0;

  let score = 0;
  const signals: string[] = [];
  if (volRatio >= 2.5) { score += 25; signals.push(`出来高${volRatio.toFixed(1)}倍`); }
  const rh = sorted.slice(-6).map((p: any) => p.H??p.C);
  const rl = sorted.slice(-6).map((p: any) => p.L??p.C);
  if (rh.every((h: number,i: number)=>i===0||h>=rh[i-1]) && rl.every((l: number,i: number)=>i===0||l>=rl[i-1])) { score += 25; signals.push("高値・安値切り上げ"); }
  if (close > prevHigh) { score += 30; signals.push("前日高値突破"); }
  if (close > high20 * 1.001) { score += 30; signals.push("20日高値突破"); }
  if (sorted.slice(-6).filter((p: any) => p.C > p.O).length >= 4) { score += 15; signals.push("陽線優勢"); }
  if (ma5 > ma25 && ma5slope > 0) { score += 20; signals.push("MA5>MA25↑"); }

  const entry = Math.round(close);
  const stop  = Math.round(entry - atr * 1.0);
  const target = Math.round(entry + atr * 2.5);
  const rr = entry > stop ? parseFloat(((target-entry)/(entry-stop)).toFixed(1)) : 2.5;
  const signalLevel = score >= 80 ? "strong" : score >= 60 ? "good" : score >= 40 ? "watch" : "none";

  return {
    code, name, price: close, changePct, volume: vol, avgVolume: Math.round(avgVol),
    volRatio: parseFloat(volRatio.toFixed(1)), ma5: Math.round(ma5), ma25: Math.round(ma25),
    ma5slope: parseFloat(ma5slope.toFixed(1)), atr: Math.round(atr), prevHigh: Math.round(prevHigh),
    score, signals, signalLevel, entry, stop, target, rr,
    aboveMA5: close > ma5, aboveMA25: close > ma25,
    trendUp: ma5 > ma25 && ma5slope > 0,
  };
}

const SIGNAL_CONFIG: Record<string, any> = {
  strong: { label: "🔥 強シグナル",   sublabel: "エントリーOK",  color: "text-red-400",    bg: "bg-red-500/10",    border: "border-red-500/30",    dot: "bg-red-400" },
  good:   { label: "⚠️ 中シグナル",   sublabel: "様子見",        color: "text-yellow-400", bg: "bg-yellow-500/10", border: "border-yellow-500/30", dot: "bg-yellow-400" },
  watch:  { label: "❌ 弱シグナル",   sublabel: "触るな",        color: "text-zinc-500",   bg: "bg-zinc-800/50",   border: "border-zinc-700",      dot: "bg-zinc-500" },
  none:   { label: "❌ シグナルなし", sublabel: "対象外",        color: "text-zinc-700",   bg: "bg-zinc-900",      border: "border-zinc-800",      dot: "bg-zinc-800" },
};

// ─── 今日の戦略判定 ──────────────────────────────────────────────────────────
function calcTodayStrategy(signals: any[], marketEnv: any, config: any) {
  const vixOk = (marketEnv.vix ?? 20) <= config.vix_max;
  const topSignal = signals[0];
  const anyStrong = signals.some(s => s.signalLevel === "strong" || s.signalLevel === "good");
  const allWeak   = signals.every(s => s.signalLevel === "none" || s.signalLevel === "watch");

  // 取引可否判定
  if (!vixOk) {
    return {
      action: "禁止",
      color: "text-red-400",
      bg: "bg-red-500/10",
      border: "border-red-500/30",
      icon: "🚫",
      title: "取引禁止",
      reasons: [
        `VIX ${marketEnv.vix ?? "?"} — 基準値（${config.vix_max}）超過`,
        "高ボラ環境はエッジが消える",
        "勝率崩壊ゾーン",
      ],
      instruction: "今日はエントリーしない",
      targets: [],
    };
  }

  if (allWeak) {
    return {
      action: "見送り",
      color: "text-yellow-400",
      bg: "bg-yellow-500/10",
      border: "border-yellow-500/30",
      icon: "⚠️",
      title: "見送り推奨",
      reasons: [
        "全銘柄シグナル弱い",
        "エントリー条件未達",
        "無理に入らない",
      ],
      instruction: "条件が揃うまで待つ",
      targets: [],
    };
  }

  if (anyStrong) {
    const strongStocks = signals.filter(s => s.signalLevel === "strong" || s.signalLevel === "good");
    return {
      action: "エントリー可",
      color: "text-emerald-400",
      bg: "bg-emerald-500/10",
      border: "border-emerald-500/30",
      icon: "✅",
      title: "エントリー可",
      reasons: [
        `VIX ${marketEnv.vix ?? 20} — 良好`,
        `${strongStocks.map(s=>s.name).join("・")} シグナル点灯`,
        `直近EV ${config.stats.ev}`,
      ],
      instruction: `${strongStocks[0]?.name}からエントリー`,
      targets: strongStocks.map(s => s.code),
    };
  }

  return {
    action: "様子見",
    color: "text-blue-400",
    bg: "bg-blue-500/10",
    border: "border-blue-500/30",
    icon: "👀",
    title: "様子見",
    reasons: [
      `VIX ${marketEnv.vix ?? 20} — 許容範囲`,
      "シグナル中程度",
      "強い確信なし",
    ],
    instruction: "強いシグナルが出るまで待つ",
    targets: [],
  };
}

// ─── 優位性説明 ───────────────────────────────────────────────────────────────
function calcAdvantage(signals: any[], marketEnv: any) {
  const vix = marketEnv.vix ?? 20;
  const pros: string[] = [];
  const cons: string[] = [];

  if (vix < 18)  pros.push(`VIX ${vix} — 低ボラ（取引有利）`);
  if (vix > 20)  cons.push(`VIX ${vix} — 高ボラ（リスク高）`);
  if (marketEnv.nikkeiTrend === "up")   pros.push("日経上昇トレンド");
  if (marketEnv.nikkeiTrend === "down") cons.push("日経下落トレンド");

  for (const s of signals) {
    if (s.trendUp)          pros.push(`${s.name} — 上昇トレンド継続`);
    if (s.volRatio >= 2.5)  pros.push(`${s.name} — 出来高急増`);
    if (s.price > s.prevHigh) pros.push(`${s.name} — 前日高値突破`);
    if (!s.trendUp)         cons.push(`${s.name} — トレンドなし`);
  }

  const isPositive = pros.length > cons.length;
  return { pros, cons, isPositive };
}

export default function Page() {
  const [mode, setMode]                   = useState<"stable"|"aggressive">("stable");
  const [selectedCode, setSelectedCode]   = useState("");
  const [signals, setSignals]             = useState<any[]>([]);
  const [marketEnv, setMarketEnv]         = useState<typeof MOCK_MARKET>(MOCK_MARKET);
  const [monitorStatus, setMonitorStatus] = useState<string>("running");
  const [loading, setLoading]             = useState(true);

  const config = DAYTRADE_CONFIG[mode];

  useEffect(() => {
    setLoading(true);
    Promise.all([
      fetch(`/api/prices?date=${new Date().toISOString().slice(0,10).replace(/-/g,'')}`).then(r=>r.json()).catch(()=>({ data: [] })),
      fetch('/api/market').then(r=>r.json()).then((d: any)=>d.vix ? d : MOCK_MARKET).catch(()=>MOCK_MARKET),
    ]).then(([priceData, marketData]) => {
      setMarketEnv({...MOCK_MARKET, ...marketData});
      const rawPrices = priceData.data ?? [];
      const map = new Map<string, any[]>();
      for (const p of rawPrices) {
        if (!p.C) continue;
        const c4 = String(p.Code).slice(0,4);
        if (!map.has(c4)) map.set(c4, []);
        map.get(c4)!.push(p);
      }
      const names: Record<string,string> = { "6920":"レーザーテック","6857":"アドバンテスト","8035":"東京エレクトロン" };
      const built = ["6920","6857","8035"].map(code => buildDaytradeSignal(code, names[code], map.get(code) ?? [])).filter(Boolean);
      setSignals(built);
      setSelectedCode(built[0]?.code ?? "6920");
      setLoading(false);
    });
  }, []);

  const activeSignals = useMemo(() => signals.filter(s => config.symbols.includes(s.code)).sort((a,b)=>b.score-a.score), [signals, mode]);
  const selected  = activeSignals.find(s=>s.code===selectedCode) ?? activeSignals[0];
  const strategy  = useMemo(() => calcTodayStrategy(activeSignals, marketEnv, config), [activeSignals, marketEnv, mode]);
  const advantage = useMemo(() => calcAdvantage(activeSignals, marketEnv), [activeSignals, marketEnv]);
  const vixOk     = (marketEnv.vix ?? 20) <= config.vix_max;

  const MONITOR_LABELS: Record<string,any> = {
    running:      { badge: "🟢 通常",     color: "text-emerald-400", sub: "問題なし" },
    lot_reduced:  { badge: "🟡 注意",     color: "text-yellow-400",  sub: "ロット半減中" },
    stock_stopped:{ badge: "🟠 一部停止", color: "text-orange-400",  sub: "銘柄停止中" },
    all_stopped:  { badge: "🔴 停止",     color: "text-red-400",     sub: "EV崩壊" },
  };
  const monitor = MONITOR_LABELS[monitorStatus];

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 font-mono">
      {/* ヘッダー */}
      <header className="border-b border-zinc-800 px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-sm font-bold tracking-widest">DAYTRADE SCANNER</span>
          <span className="text-xs text-zinc-600">JP EQUITY</span>
        </div>
        <div className="flex items-center gap-4 text-xs text-zinc-500">
          <span>VIX <span className={(marketEnv.vix??20) > 20 ? "text-red-400" : (marketEnv.vix??20) < 15 ? "text-emerald-400" : "text-yellow-400"}>{marketEnv.vix ?? 20}</span></span>
          <span>日経 <span className={marketEnv.nikkeiTrend==="up"?"text-emerald-400":marketEnv.nikkeiTrend==="down"?"text-red-400":"text-yellow-400"}>{marketEnv.nikkeiTrend==="up"?"↑上昇":marketEnv.nikkeiTrend==="down"?"↓下落":"→横ばい"}</span></span>
          <span className={monitor.color}>{monitor.badge} <span className="text-zinc-600">{monitor.sub}</span></span>
          <a href="/backtest" className="text-zinc-600 hover:text-zinc-300">バックテスト</a>
          <a href="/journal"  className="text-zinc-600 hover:text-zinc-300">ジャーナル</a>
        </div>
      </header>

      {/* モード切替 */}
      <div className="px-6 pt-4 flex items-center gap-3">
        {(["stable","aggressive"] as const).map(m => {
          const c = DAYTRADE_CONFIG[m];
          return (
            <button key={m} onClick={()=>setMode(m)}
              className={`px-5 py-2 text-xs tracking-wider transition-all border ${mode===m?"bg-zinc-100 text-zinc-900 font-bold border-zinc-100":"text-zinc-500 border-zinc-800 hover:text-zinc-300"}`}>
              {c.badge} {c.label}
            </button>
          );
        })}
        <div className="ml-auto flex items-center gap-2 text-xs text-zinc-600">
          監視:
          {Object.keys(MONITOR_LABELS).map(s => (
            <button key={s} onClick={()=>setMonitorStatus(s)}
              className={`px-2 py-1 border transition-all ${monitorStatus===s?"border-zinc-400 text-zinc-200":"border-zinc-800 hover:border-zinc-600"}`}>
              {MONITOR_LABELS[s].badge}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64 text-zinc-600 text-sm animate-pulse">シグナル計算中...</div>
      ) : (
        <div className="flex h-[calc(100vh-108px)]">

          {/* 左パネル */}
          <div className="w-72 border-r border-zinc-800 overflow-y-auto flex-shrink-0">

            {/* ① 今日の戦略（最重要） */}
            <div className={`mx-3 mt-3 p-3 border ${strategy.border} ${strategy.bg}`}>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-lg">{strategy.icon}</span>
                <span className={`text-sm font-bold ${strategy.color}`}>{strategy.title}</span>
              </div>
              <div className="space-y-1 mb-3">
                {strategy.reasons.map((r,i) => (
                  <div key={i} className="text-xs text-zinc-400">• {r}</div>
                ))}
              </div>
              <div className={`text-xs font-bold border-t pt-2 ${strategy.border} ${strategy.color}`}>
                → {strategy.instruction}
              </div>
            </div>

            {/* ② 優位性 */}
            <div className="mx-3 mt-2 p-3 border border-zinc-800">
              <div className="text-xs text-zinc-500 mb-2">{advantage.isPositive ? "📈 現在の優位性" : "📉 優位性なし"}</div>
              {advantage.pros.map((p,i) => <div key={i} className="text-xs text-emerald-400">✓ {p}</div>)}
              {advantage.cons.map((c,i) => <div key={i} className="text-xs text-red-400">✗ {c}</div>)}
            </div>

            {/* バックテスト実績 */}
            <div className="px-4 py-2 border-b border-t border-zinc-800 mt-2 bg-zinc-900/50">
              <div className="text-xs text-zinc-500 mb-1">{config.label} 実績</div>
              <div className="grid grid-cols-3 gap-1 text-xs">
                <div><span className="text-zinc-600">損益 </span><span className="text-emerald-400 font-bold">{config.stats.return}</span></div>
                <div><span className="text-zinc-600">勝率 </span><span className="text-zinc-300">{config.stats.winrate}</span></div>
                <div><span className="text-zinc-600">EV </span><span className="text-blue-400">{config.stats.ev}</span></div>
                <div><span className="text-zinc-600">DD </span><span className="text-red-400">{config.stats.max_dd}</span></div>
                <div><span className="text-zinc-600">連敗 </span><span className="text-zinc-400">{config.stats.max_streak}</span></div>
                <div><span className="text-zinc-600">期間 </span><span className="text-zinc-500">{config.stats.period}</span></div>
              </div>
            </div>

            {/* ③ 銘柄リスト（優先度付き） */}
            {activeSignals.map((s, i) => {
              const cfg = SIGNAL_CONFIG[s.signalLevel];
              const prio = STOCK_PRIORITY[s.code];
              const isSelected = s.code === selectedCode;
              const isTarget = strategy.targets.includes(s.code);
              return (
                <div key={s.code} onClick={()=>setSelectedCode(s.code)}
                  className={`px-4 py-3 border-b border-zinc-800/60 cursor-pointer transition-colors ${isSelected?"bg-zinc-800":"hover:bg-zinc-900"} ${isTarget?"ring-1 ring-inset ring-emerald-500/30":""}`}>
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <span className={`text-xs font-bold px-1 border ${prio.color} border-current`}>{prio.rank}</span>
                      <span className="text-xs text-zinc-500">{s.code}</span>
                      <span className="text-xs font-bold">{s.name}</span>
                      {isTarget && <span className="text-xs text-emerald-400">← 今日</span>}
                    </div>
                  </div>
                  <div className="flex items-center justify-between pl-8">
                    <span className="text-xs text-zinc-500">¥{s.price.toLocaleString()}</span>
                    <div className="flex items-center gap-2">
                      <span className={`text-xs ${s.changePct>=0?"text-emerald-400":"text-red-400"}`}>{s.changePct>=0?"+":""}{s.changePct}%</span>
                      <span className={`text-xs font-bold ${cfg.color}`}>{cfg.sublabel}</span>
                      <span className="text-xs text-zinc-600">{s.score}pt</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* 右：詳細 */}
          {selected && (() => {
            const cfg = SIGNAL_CONFIG[selected.signalLevel];
            const prio = STOCK_PRIORITY[selected.code];
            return (
              <div className="flex-1 overflow-y-auto px-6 py-4">
                {/* ヘッダー */}
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <div className="flex items-center gap-3 mb-1">
                      <span className={`text-sm font-bold px-2 py-0.5 border ${prio.color} border-current`}>{prio.rank}ランク — {prio.label}</span>
                      <span className="text-xs text-zinc-600">{selected.code}</span>
                    </div>
                    <h1 className="text-xl font-bold">{selected.name}</h1>
                  </div>
                  <div className="flex items-center gap-3">
                    <a href={`https://www.tradingview.com/chart/?symbol=TSE%3A${selected.code}`} target="_blank" rel="noopener noreferrer"
                      className="px-3 py-1.5 text-xs border border-blue-500/40 text-blue-400 hover:bg-blue-500/10 transition-colors">
                      📈 チャート
                    </a>
                    <div className={`px-4 py-2 text-sm font-bold border ${cfg.color} ${cfg.bg} ${cfg.border}`}>
                      {cfg.label}
                      <div className="text-xs font-normal opacity-70">{cfg.sublabel}</div>
                    </div>
                  </div>
                </div>

                {/* 価格・スコア */}
                <div className="grid grid-cols-2 gap-3 mb-4">
                  <div className="border border-zinc-800 p-3">
                    <div className="text-xs text-zinc-500 mb-1">現在値</div>
                    <div className="text-2xl font-bold">¥{selected.price.toLocaleString()}</div>
                    <div className={`text-sm mt-1 ${selected.changePct>=0?"text-emerald-400":"text-red-400"}`}>
                      {selected.changePct>=0?"▲":"▼"} {Math.abs(selected.changePct)}%
                    </div>
                  </div>
                  <div className="border border-zinc-800 p-3">
                    <div className="text-xs text-zinc-500 mb-1">シグナル判定</div>
                    <div className={`text-xl font-bold ${cfg.color}`}>{cfg.label}</div>
                    <div className="text-xs text-zinc-500 mt-1">{selected.score}pt / 145pt</div>
                    <div className="w-full bg-zinc-800 h-1 mt-1">
                      <div className={`h-1 ${selected.signalLevel==="strong"?"bg-red-400":selected.signalLevel==="good"?"bg-yellow-400":"bg-zinc-500"}`}
                        style={{width:`${Math.min(100,selected.score/145*100)}%`}} />
                    </div>
                  </div>
                </div>

                {/* エントリー条件 */}
                <div className="border border-blue-500/20 bg-blue-500/5 p-3 mb-4">
                  <div className="text-xs text-blue-400 mb-2 font-bold">📋 エントリー条件チェック</div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    {[
                      { label:`出来高急増（${selected.volRatio.toFixed(1)}倍/必要2.5倍）`, ok: selected.volRatio>=2.5 },
                      { label:`MA5(${selected.ma5.toLocaleString()})>MA25(${selected.ma25.toLocaleString()})↑`, ok: selected.aboveMA5&&selected.aboveMA25&&selected.ma5slope>0 },
                      { label:`前日高値突破（¥${selected.prevHigh.toLocaleString()}）`, ok: selected.price>selected.prevHigh },
                      { label:`VIX ${marketEnv.vix??20}（基準${config.vix_max}以下）`, ok: vixOk },
                    ].map((item,i) => (
                      <div key={i} className="flex items-center gap-2">
                        <span className={item.ok?"text-emerald-400":"text-zinc-600"}>{item.ok?"✅":"○"}</span>
                        <span className={item.ok?"text-zinc-300":"text-zinc-600"}>{item.label}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* 3値 */}
                <div className="grid grid-cols-3 gap-3 mb-4">
                  <div className="border border-zinc-800 p-3">
                    <div className="text-xs text-zinc-500 mb-1">エントリー</div>
                    <div className="text-lg font-bold text-blue-400">¥{selected.entry.toLocaleString()}</div>
                    <div className="text-xs text-zinc-600 mt-1">翌日始値（成行）</div>
                  </div>
                  <div className="border border-emerald-500/20 p-3">
                    <div className="text-xs text-zinc-500 mb-1">利確（TP）</div>
                    <div className="text-lg font-bold text-emerald-400">¥{selected.target.toLocaleString()}</div>
                    <div className="text-xs text-zinc-600 mt-1">ATR×2.5（¥{selected.atr.toLocaleString()}）</div>
                  </div>
                  <div className="border border-red-500/20 p-3">
                    <div className="text-xs text-zinc-500 mb-1">損切り（SL）</div>
                    <div className="text-lg font-bold text-red-400">¥{selected.stop.toLocaleString()}</div>
                    <div className="text-xs text-zinc-600 mt-1">ATR×1.0（必ず守る）</div>
                  </div>
                </div>

                {/* 指標 */}
                <div className="grid grid-cols-4 gap-3 mb-4">
                  <div className="border border-zinc-800 p-3">
                    <div className="text-xs text-zinc-500 mb-1">RR比</div>
                    <div className={`text-lg font-bold ${selected.rr>=2?"text-emerald-400":"text-yellow-400"}`}>1:{selected.rr.toFixed(1)}</div>
                  </div>
                  <div className="border border-zinc-800 p-3">
                    <div className="text-xs text-zinc-500 mb-1">出来高比</div>
                    <div className={`text-lg font-bold ${selected.volRatio>=2.5?"text-emerald-400":"text-zinc-400"}`}>{selected.volRatio.toFixed(1)}倍</div>
                  </div>
                  <div className="border border-zinc-800 p-3">
                    <div className="text-xs text-zinc-500 mb-1">MA5</div>
                    <div className={`text-sm font-bold ${selected.aboveMA5?"text-emerald-400":"text-red-400"}`}>
                      {selected.aboveMA5?"↑上":"↓下"}<span className="text-xs text-zinc-600 ml-1">¥{selected.ma5.toLocaleString()}</span>
                    </div>
                  </div>
                  <div className="border border-zinc-800 p-3">
                    <div className="text-xs text-zinc-500 mb-1">MA25</div>
                    <div className={`text-sm font-bold ${selected.aboveMA25?"text-emerald-400":"text-red-400"}`}>
                      {selected.aboveMA25?"↑上":"↓下"}<span className="text-xs text-zinc-600 ml-1">¥{selected.ma25.toLocaleString()}</span>
                    </div>
                  </div>
                </div>

                {/* シグナル根拠 */}
                <div className="border border-zinc-800 p-3 mb-4">
                  <div className="text-xs text-zinc-500 mb-3">シグナル根拠</div>
                  {[
                    { label:"出来高急増",      active:selected.volRatio>=2.5,                         note:`${selected.volRatio.toFixed(1)}倍（基準2.5倍）`, pts:25 },
                    { label:"高値・安値切上げ", active:selected.signals.includes("高値・安値切り上げ"), note:"直近6本",                                        pts:25 },
                    { label:"前日高値突破",     active:selected.price>selected.prevHigh,               note:`¥${selected.prevHigh.toLocaleString()}`,          pts:30 },
                    { label:"20日高値突破",     active:selected.signals.some((s:string)=>s.includes("20日")), note:"直近最高値超え",                           pts:30 },
                    { label:"陽線優勢",         active:selected.signals.includes("陽線優勢"),           note:"直近6本中4本以上",                               pts:15 },
                    { label:"MAトレンド",       active:selected.aboveMA5&&selected.ma5slope>0,          note:"MA5>MA25↑",                                      pts:20 },
                  ].map(row => (
                    <div key={row.label} className="flex items-center justify-between py-1.5 border-b border-zinc-800/50 last:border-0">
                      <div className="flex items-center gap-2">
                        <span className={row.active?"text-emerald-400":"text-zinc-700"}>{row.active?"✅":"○"}</span>
                        <span className={`text-xs ${row.active?"text-zinc-300":"text-zinc-600"}`}>{row.label}</span>
                        <span className="text-xs text-zinc-600">{row.note}</span>
                      </div>
                      <span className={`text-sm font-bold ${row.active?"text-zinc-300":"text-zinc-700"}`}>{row.active?`+${row.pts}`:"-"}</span>
                    </div>
                  ))}
                  <div className="flex items-center justify-between pt-3">
                    <span className="text-xs text-zinc-500">TOTAL</span>
                    <span className={`text-lg font-bold ${cfg.color}`}>{selected.score}pt</span>
                  </div>
                </div>

                {/* リスク管理 */}
                <div className="border border-zinc-700/50 bg-zinc-900/50 p-3">
                  <div className="text-xs text-zinc-500 mb-2">⚠️ リスク管理</div>
                  <div className="grid grid-cols-3 gap-2 text-xs">
                    <div><div className="text-zinc-600">推奨ロット</div><div className="text-zinc-300 font-bold">{config.risk}</div></div>
                    <div><div className="text-zinc-600">想定利益</div><div className="text-emerald-400 font-bold">+{(((selected.target-selected.entry)/selected.entry)*100).toFixed(1)}%</div></div>
                    <div><div className="text-zinc-600">想定損失</div><div className="text-red-400 font-bold">-{(((selected.entry-selected.stop)/selected.entry)*100).toFixed(1)}%</div></div>
                  </div>
                </div>
              </div>
            );
          })()}
        </div>
      )}
    </div>
  );
}

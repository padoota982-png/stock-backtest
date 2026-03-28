# ===== デモサイト表示テキスト =====
# stock-app の各コンポーネントにそのまま使える文言

# ===== モード説明 =====

STABLE_MODE = {
    "label": "安定モード",
    "badge": "🟢 稼働中",
    "stocks": ["6920 レーザーテック", "6857 アドバンテスト"],
    "strategy": "EV重視・DD抑制",
    "description": "主力2銘柄に絞り、リスク監視付きで安定運用。勝率・期待値を最優先。",
    "stats": {
        "return":   "+85.1%",
        "winrate":  "61.7%",
        "ev":       "+0.486%",
        "max_dd":   "-13.3%",
        "max_streak": "5連敗",
        "trades":   "60件 / 60日",
    },
    "risk": "1トレードあたり資金の0.5〜1%推奨",
    "monthly": {
        "2025-12": {"trades": 8,  "winrate": "25.0%", "pnl": "-117,602円", "status": "❌"},
        "2026-01": {"trades": 28, "winrate": "64.3%", "pnl": "+356,046円", "status": "✅"},
        "2026-02": {"trades": 22, "winrate": "68.2%", "pnl": "+506,987円", "status": "✅"},
        "2026-03": {"trades": 2,  "winrate": "100.0%","pnl": "+105,564円", "status": "✅"},
    }
}

AGGRESSIVE_MODE = {
    "label": "攻めモード",
    "badge": "🔥 稼働中",
    "stocks": ["6920 レーザーテック", "6857 アドバンテスト", "8035 東京エレクトロン"],
    "strategy": "収益最大化・リスク許容",
    "description": "主力3銘柄で収益を最大化。DDは深くなるが月次では安定。強気相場向き。",
    "stats": {
        "return":   "+139.1%",
        "winrate":  "67.8%",
        "ev":       "+0.466%",
        "max_dd":   "-16.6%",
        "max_streak": "7連敗",
        "trades":   "90件 / 60日",
    },
    "risk": "1トレードあたり資金の0.5%推奨（DDが深いため）",
    "monthly": {
        "2025-12": {"trades": 12, "winrate": "41.7%", "pnl": "-93,879円",  "status": "❌"},
        "2026-01": {"trades": 42, "winrate": "69.0%", "pnl": "+585,873円", "status": "✅"},
        "2026-02": {"trades": 33, "winrate": "72.7%", "pnl": "+775,141円", "status": "✅"},
        "2026-03": {"trades": 3,  "winrate": "100.0%","pnl": "+124,198円", "status": "✅"},
    }
}

# ===== 監視ステータス表示 =====

MONITOR_STATUS = {
    "running": {
        "badge":   "🟢 通常稼働",
        "message": "全銘柄正常稼働中",
        "detail":  "EV・勝率・DD すべて基準内",
    },
    "lot_reduced": {
        "badge":   "🟡 ロット半減中",
        "message": "勝率低下を検知・様子見",
        "detail":  "直近勝率が48%を下回りました。ロットを半減して継続中。",
    },
    "stock_pending": {
        "badge":   "🔵 銘柄確認中",
        "message": "{code} 翌日価格確認待ち",
        "detail":  "EV低下を検知。翌日の価格アクションで停止するか判断します。",
    },
    "stock_stopped": {
        "badge":   "🟠 一部銘柄停止",
        "message": "{code} 一時停止中（{days}日）",
        "detail":  "EV低下が継続。{cooldown}営業日後に自動復帰予定。",
    },
    "all_stopped": {
        "badge":   "🔴 全停止中",
        "message": "複合リスク検知・取引停止",
        "detail":  "EV・勝率・DDが同時に悪化。{cooldown}営業日後に自動再開予定。",
    },
    "resumed": {
        "badge":   "🟢 再開",
        "message": "取引再開・メトリクスリセット",
        "detail":  "停止期間終了。新規データで監視を再スタートします。",
    },
}

# ===== 実運用チェックリスト =====

LIVE_CHECKLIST = {
    "ev_ok":       {"label": "期待値 > +0.3%",    "threshold": 0.3,   "current": 0.486},
    "wr_ok":       {"label": "勝率 > 60%",         "threshold": 60.0,  "current": 61.7},
    "dd_ok":       {"label": "最大DD < -15%",      "threshold": -15.0, "current": -13.3},
    "streak_ok":   {"label": "最大連敗 < 7回",     "threshold": 7,     "current": 5},
}

# ===== シグナル表示テキスト（毎日更新想定）=====

SIGNAL_TEMPLATE = """
【本日のシグナル】{date}

モード: {mode}
対象銘柄: {stocks}
VIX: {vix}（基準: 20以下）
監視状態: {monitor_status}

エントリー条件:
  ✅ 出来高急増（直近平均の2.5倍以上）
  ✅ 高値・安値の切り上げ
  ✅ 前日高値突破
  ✅ 陽線優勢

利確/損切:
  損切り: ATR × 1.0 下
  利確:   ATR × 2.5 上
  トレーリング: +1ATRで建値移動

推奨ロット: 資金の{lot_pct}%
"""

# ===== React コンポーネント用 JSON =====
import json

SITE_CONFIG = {
    "modes": {
        "stable":     STABLE_MODE,
        "aggressive": AGGRESSIVE_MODE,
    },
    "monitor": MONITOR_STATUS,
    "checklist": LIVE_CHECKLIST,
    "params": {
        "stable": {
            "symbols":      ["6920", "6857"],
            "stop_atr":     1.0,
            "rr":           2.5,
            "max_entries":  2,
            "vix_max":      20,
            "use_trailing": True,
        },
        "aggressive": {
            "symbols":      ["6920", "6857", "8035"],
            "stop_atr":     1.0,
            "rr":           2.5,
            "max_entries":  2,
            "vix_max":      20,
            "use_trailing": True,
        },
    },
    "risk_monitor": {
        "ev_stop":            -0.15,
        "winrate_stop":        0.45,
        "dd_stop":            -0.12,
        "cooldown_days":       3,
        "cancel_stop_return":  1.5,
        "stock_ev_stop_main": -0.25,
    }
}

if __name__ == "__main__":
    print(json.dumps(SITE_CONFIG, ensure_ascii=False, indent=2))
    print("\n===== 安定モード サマリー =====")
    print(f"銘柄: {', '.join(STABLE_MODE['stocks'])}")
    print(f"損益: {STABLE_MODE['stats']['return']}")
    print(f"勝率: {STABLE_MODE['stats']['winrate']}")
    print(f"EV:   {STABLE_MODE['stats']['ev']}")
    print(f"DD:   {STABLE_MODE['stats']['max_dd']}")

    print("\n===== 攻めモード サマリー =====")
    print(f"銘柄: {', '.join(AGGRESSIVE_MODE['stocks'])}")
    print(f"損益: {AGGRESSIVE_MODE['stats']['return']}")
    print(f"勝率: {AGGRESSIVE_MODE['stats']['winrate']}")
    print(f"EV:   {AGGRESSIVE_MODE['stats']['ev']}")
    print(f"DD:   {AGGRESSIVE_MODE['stats']['max_dd']}")

    print("\n===== 監視ステータス一覧 =====")
    for key, val in MONITOR_STATUS.items():
        print(f"  {val['badge']:20s} → {val['message']}")
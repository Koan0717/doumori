export const CONFIG = {
  // 色違い判定確率 (0.5% = 0.005)
  SHINY_CHANCE: 0.005,

  // VC・チャットによるチケット獲得ルール
  TICKET_REQUIRED_SECONDS: 3600, // 1時間 = 3600秒

  // exchange (通貨交換) のデフォルトレート
  EXCHANGE_RATES: {
    MANYBOT_PER_TICKET: 500, // manybotコイン500 = チケット1枚
  },

  // 道具購入価格 (チケット数)
  ITEM_PRICES: {
    fishing_rod: 1,
    bug_net: 1,
  },

  // 限定コンプリートキー・ロール設定
  COMPLETION_ROLES: {
    fish: {
      name: "🎣 金のつりざお",
      color: "#FFD700", // ゴールド
    },
    bug: {
      name: "🦋 金の虫取り網",
      color: "#FFD700", // ゴールド
    },
  },

  // 売却額ベース (レア度別 manybotコイン換算)
  SELL_PRICES: {
    COMMON: 100,
    UNCOMMON: 300,
    RARE: 800,
    SUPER_RARE: 2500,
    LEGENDARY: 10000,
    SHINY_MULTIPLIER: 5, // 金色/色違いは5倍の価値
  },
};

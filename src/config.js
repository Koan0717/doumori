export const CONFIG = {
  // 色違い判定確率 (0.5% = 0.005)
  SHINY_CHANCE: 0.005,

  // VC・チャットによるチケット獲得ルール
  TICKET_REQUIRED_SECONDS: 3600, // 1時間 = 3600秒

  // exchange (通貨交換) のデフォルトレート
  EXCHANGE_RATES: {
    MANYBOT_PER_TICKET: 500, // 500ベル = チケット1枚 (旧仕様互換)
    MILES_PER_TICKET: 100,   // 100マイル = チケット1枚 (マイル購入)
  },

  // 通貨名
  CURRENCY_NAME: "ベル",

  // 道具購入価格 (チケット数)
  ITEM_PRICES: {
    fishing_rod: 1,
    bug_net: 1,
  },

  // 限定コンプリートキー・ロール設定
  COMPLETION_ROLES: {
    fish: {
      name: "🎣 金のつりざお",
      color: "#FFD700",
    },
    bug: {
      name: "🦋 金の虫取り網",
      color: "#FFD700",
    },
  },

  // 売却額ベース (レア度別 ベル換算)
  SELL_PRICES: {
    COMMON: 100,
    UNCOMMON: 300,
    RARE: 800,
    SUPER_RARE: 2500,
    LEGENDARY: 10000,
    SHINY_MULTIPLIER: 5,
  },

  // 🌟 ステップアップ階級設定 (レベル, 階級名, 必要マイル, カラー)
  RANKS: [
    { level: 1, name: "🌱 新規住民", requiredMiles: 0, color: "#A8E6CF" },
    { level: 2, name: "🥉 見習い住民", requiredMiles: 300, color: "#CD7F32" },
    { level: 3, name: "🥈 一人前住民", requiredMiles: 800, color: "#C0C0C0" },
    { level: 4, name: "🥇 ベテラン住民", requiredMiles: 1500, color: "#FFD700" },
    { level: 5, name: "👑 名誉マスター住民", requiredMiles: 3000, color: "#9B59B6" },
  ],

  // DIY作業台 (イベント開催) の報酬マイル & クールダウン (7日間)
  DIY_EVENT_REWARD_MILES: 150,
  DIY_COOLDOWN_DAYS: 7,

  // ランク別 デイリーミッション テンプレート
  DAILY_MISSIONS: {
    1: [
      { desc: "VCに通算30分以上参加する", miles: 30 },
      { desc: "挨拶メッセージを雑談チャンネルで3回送信する", miles: 20 },
      { desc: "`/釣り` で魚を1匹以上釣り上げる", miles: 30 },
    ],
    2: [
      { desc: "VCに通算1時間以上参加する", miles: 50 },
      { desc: "`/虫捕り` で虫を2匹以上捕まえる", miles: 40 },
      { desc: "メンバーとチャットで10回以上発言する", miles: 40 },
    ],
    3: [
      { desc: "VCで他のメンバーと通算2時間以上交流する", miles: 70 },
      { desc: "`/両替` または `/売却` を1回実行する", miles: 50 },
      { desc: "レア度RARE以上の生き物を1匹捕獲する", miles: 80 },
    ],
    4: [
      { desc: "VCに通算3時間以上滞在する", miles: 100 },
      { desc: "図鑑でまだ持っていない生き物を新しく1匹捕まえる", miles: 120 },
      { desc: "イベントまたはDIY作業台に参加・告知する", miles: 100 },
    ],
    5: [
      { desc: "サーバー内で他の住民の質問に答えたり交流を促進する", miles: 150 },
      { desc: "SUPER_RARE以上の生き物を捕獲するか図鑑完成率を伸ばす", miles: 200 },
      { desc: "通算4時間以上VCで浮上する", miles: 150 },
    ],
  },
};

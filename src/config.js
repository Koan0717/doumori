export const CONFIG = {
  // 色違い判定確率 (0.5% = 0.005)
  SHINY_CHANCE: 0.005,

  // VC・チャットによるチケット獲得ルール
  TICKET_REQUIRED_SECONDS: 3600, // 1時間 = 3600秒

  // exchange (通貨交換) のデフォルトレート
  EXCHANGE_RATES: {
    MANYBOT_PER_TICKET: 500, // 500ベル = チケット1枚
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

  // 🌟 ステップアップ階級設定 (レベル, 階級名, 必要マイル, カラー, デフォルトロール名)
  RANKS: [
    { level: 1, name: "🌱 新規住人", requiredMiles: 0, color: "#A8E6CF", roleName: "新規住人" },
    { level: 2, name: "🏠 住人", requiredMiles: 4000, color: "#3498DB", roleName: "住人" },
    { level: 3, name: "☕ 常連住人", requiredMiles: 15000, color: "#E67E22", roleName: "常連住人" },
    { level: 4, name: "🌟 人気住人", requiredMiles: 45000, color: "#FFD700", roleName: "人気住人" },
  ],

  // DIY作業台 (イベント開催) の報酬マイル & クールダウン (7日間)
  DIY_EVENT_REWARD_MILES: 150,
  DIY_COOLDOWN_DAYS: 7,

  // 1日あたりのミッション受注枠数
  DAILY_MISSION_SLOT_COUNT: 3,
  // 1ミッションあたりの基本報酬マイル
  DEFAULT_MISSION_REWARD_MILES: 100,

  // ランク別 デイリーミッション デフォルトテンプレート (1ミッション100マイル)
  DAILY_MISSIONS: {
    0: [
      { title: "VC交流", desc: "VCに通算30分以上参加する", miles: 100 },
      { title: "あいさつ", desc: "雑談チャンネルであいさつや会話を3回以上送信する", miles: 100 },
      { title: "魚釣り", desc: "`/釣り` で魚を1匹以上釣り上げる", miles: 100 },
      { title: "虫捕り", desc: "`/虫捕り` で虫を1匹以上捕まえる", miles: 100 },
      { title: "ショップ利用", desc: "`/ショップ` または `/両替` を1回利用する", miles: 100 },
      { title: "生き物売却", desc: "`/売却` で重複した生き物を売却してベルにする", miles: 100 },
      { title: "VC長時間滞在", desc: "VCに通算1時間以上参加してメンバーと交流する", miles: 100 },
      { title: "レア捕獲", desc: "レア度RARE以上の生き物を1匹捕獲する", miles: 100 },
      { title: "図鑑確認", desc: "`/魚図鑑` または `/虫図鑑` を確認してコレクションを増やす", miles: 100 },
      { title: "イベント参加", desc: "DIY作業台イベントや鯖内イベントに参加する", miles: 100 },
    ],
  },
};

/**
 * メンバーのロール一覧から「新規住人 / 住人 / 常連住人 / 人気住人」を検出して階級情報を解決
 */
export function resolveRankFromMember(member, defaultRankLevel = 1) {
  if (member && member.roles && member.roles.cache) {
    const roleNames = typeof member.roles.cache.map === "function"
      ? member.roles.cache.map((r) => r.name)
      : Array.from(member.roles.cache.values()).map((r) => r.name);

    // 1. 人気住人ロール判定 (Level 4)
    const popularRole = roleNames.find((name) => name.includes("人気住人") || name.includes("人気住民"));
    if (popularRole) {
      return { level: 4, name: "🌟 人気住人", roleName: popularRole, color: "#FFD700" };
    }

    // 2. 常連住人ロール判定 (Level 3)
    const regularRole = roleNames.find((name) => name.includes("常連住人") || name.includes("常連住民"));
    if (regularRole) {
      return { level: 3, name: "☕ 常連住人", roleName: regularRole, color: "#E67E22" };
    }

    // 3. 住人ロール判定 (Level 2: 「新規」「常連」「人気」を含まない単体の住人/住人ロール)
    const citizenRole = roleNames.find(
      (name) =>
        (name.includes("住人") || name.includes("住民")) &&
        !name.includes("新規") &&
        !name.includes("常連") &&
        !name.includes("人気")
    );
    if (citizenRole) {
      return { level: 2, name: "🏠 住人", roleName: citizenRole, color: "#3498DB" };
    }

    // 4. 新規住人ロール判定 (Level 1)
    const rookieRole = roleNames.find((name) => name.includes("新規住人") || name.includes("新規住民"));
    if (rookieRole) {
      return { level: 1, name: "🌱 新規住人", roleName: rookieRole, color: "#A8E6CF" };
    }
  }

  // ロールで判定できない場合は defaultRankLevel に応じた階級を返す
  const rankConfig =
    CONFIG.RANKS.find((r) => r.level === defaultRankLevel) || CONFIG.RANKS[0];
  return {
    level: rankConfig.level,
    name: rankConfig.name,
    roleName: rankConfig.name,
    color: rankConfig.color,
  };
}

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
    { level: 1, name: "🌱 新規住人", requiredMiles: 0, color: "#A8E6CF" },
    { level: 2, name: "🏠 住人", requiredMiles: 300, color: "#3498DB" },
    { level: 3, name: "☕ 常連住人", requiredMiles: 800, color: "#E67E22" },
    { level: 4, name: "🌟 人気住人", requiredMiles: 1500, color: "#FFD700" },
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
  },
};

/**
 * メンバーのロール一覧から「新規住人 / 住人 / 常連住人 / 人気住人」を検出して階級情報を解決
 */
export function resolveRankFromMember(member, defaultRankLevel = 1) {
  if (member && member.roles && member.roles.cache) {
    const roleNames = member.roles.cache.map((r) => r.name);

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

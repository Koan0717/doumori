export const CONFIG = {
  // 色違い判定確率 (0.5% = 0.005)
  SHINY_CHANCE: 0.005,

  // VC・チャットによるチケット獲得ルール
  TICKET_REQUIRED_SECONDS: 3600, // 1時間 = 3600秒

  // exchange (両替・チケット購入) のレート
  EXCHANGE_RATES: {
    MILES_PER_TICKET: 100, // 100マイル = チケット1枚
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

  // ランク別 デイリーミッション デフォルトテンプレート (30種)
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
      { title: "朝のあいさつ", desc: "朝または昼の時間帯に雑談チャンネルでメッセージを送信する", miles: 100 },
      { title: "夜の団らん", desc: "夜20時以降にVCまたはチャットでメンバーと会話する", miles: 100 },
      { title: "大物釣り上げ", desc: "`/釣り` で魚を3匹以上釣り上げる", miles: 100 },
      { title: "昆虫ハンター", desc: "`/虫捕り` で虫を3匹以上捕獲する", miles: 100 },
      { title: "住民カード確認", desc: "`/住民カード` で現在のマイルやランクを確認する", miles: 100 },
      { title: "リアクション送信", desc: "サーバー内のメッセージにスタンプやリアクションを3回以上つける", miles: 100 },
      { title: "マイル残高チェック", desc: "`/マイル` で次のランク昇格までの必要ポイントを確認する", miles: 100 },
      { title: "ランキング閲覧", desc: "`/ランキング` で図鑑収集ランキングを確認する", miles: 100 },
      { title: "自己紹介・プロフィール", desc: "`/プロフィール` で自分のステータスを確認する", miles: 100 },
      { title: "道具補充", desc: "`/ショップ` でつりざおまたは虫取り網を新調する", miles: 100 },
      { title: "新人歓迎", desc: "新しく参加したメンバーにあいさつやリアクションを送る", miles: 100 },
      { title: "音楽・動画鑑賞VC", desc: "VCでメンバーと一緒に音楽や画面共有を楽しむ", miles: 100 },
      { title: "ゲーム交流", desc: "メンバーと一緒にゲームを遊ぶか配信を視聴する", miles: 100 },
      { title: "両替体験", desc: "`/両替` でベルとマイル・チケットを交換する", miles: 100 },
      { title: "ヘルプ確認", desc: "`/ヘルプ` でBotのコマンド一覧や遊び方を確認する", miles: 100 },
      { title: "DIY作業台利用", desc: "`/DIY作業台` でイベント開催または告知を行う", miles: 100 },
      { title: "生き物まとめ売り", desc: "重複した生き物を2匹以上まとめて売却する", miles: 100 },
      { title: "VCメンバー招待", desc: "VCチャンネルで他のメンバーに声をかけて一緒に話す", miles: 100 },
      { title: "色違い生き物探索", desc: "`/釣り` または `/虫捕り` でレア・色違いの生き物を探す", miles: 100 },
      { title: "デイリー完全制覇", desc: "本日の他のミッションを達成して報告を完了する", miles: 100 },
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

    // 3. 新規住人ロール判定 (Level 1)
    // ※サーバーのデフォルト役職として「住民」が付与されている場合でも、「新規住人/新規住民」を持っていれば Level 1 (新規住人) として判定
    const rookieRole = roleNames.find((name) => name.includes("新規住人") || name.includes("新規住民"));
    if (rookieRole) {
      return { level: 1, name: "🌱 新規住人", roleName: rookieRole, color: "#A8E6CF" };
    }

    // 4. 住人ロール判定 (Level 2: 「新規」「常連」「人気」を含まない、階級ロールとしての住人/住民)
    const citizenRole = roleNames.find((name) => {
      const clean = name.trim();
      if (clean.includes("新規") || clean.includes("常連") || clean.includes("人気")) {
        return false;
      }
      if (!clean.includes("住人") && !clean.includes("住民")) {
        return false;
      }
      // 絵文字や記号を除去した名前で判定
      const stripped = clean.replace(/^[^\p{L}\p{N}]+/u, "").trim();
      return (
        stripped === "住人" ||
        stripped === "住民" ||
        stripped === "住人ロール" ||
        stripped === "住民ロール" ||
        clean === "🏠 住人" ||
        clean === "🏠 住民" ||
        clean === "住人" ||
        clean === "住民"
      );
    });
    if (citizenRole) {
      return { level: 2, name: "🏠 住人", roleName: citizenRole, color: "#3498DB" };
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

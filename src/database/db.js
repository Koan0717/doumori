import pg from "pg";
import dotenv from "dotenv";
import { CONFIG, resolveRankFromMember } from "../config.js";

dotenv.config();

const { Pool } = pg;

// Doumori専用 Supabase / PostgreSQL DB
const doumoriDbUrl = process.env.DOUMORI_DATABASE_URL || process.env.DATABASE_URL;

// Manybot専用 Supabase / PostgreSQL DB
const manybotDbUrl = process.env.MANYBOT_DATABASE_URL;

if (!doumoriDbUrl) {
  console.warn("⚠️ DOUMORI_DATABASE_URL (または DATABASE_URL) が設定されていません。");
}

const getSslOption = (url) => {
  if (!url) return false;
  if (url.includes("supabase") || url.includes("postgres.database.azure.com") || url.includes("render.com") || url.includes("neon.tech")) {
    return { rejectUnauthorized: false };
  }
  return false;
};

export const doumoriPool = new Pool({
  connectionString: doumoriDbUrl,
  ssl: getSslOption(doumoriDbUrl),
  connectionTimeoutMillis: 8000,
  idleTimeoutMillis: 30000,
  max: 10,
});

// Manybot DB接続 (設定されている場合のみ分離接続)
export const manybotPool = manybotDbUrl
  ? new Pool({
      connectionString: manybotDbUrl,
      ssl: getSslOption(manybotDbUrl),
      connectionTimeoutMillis: 8000,
      idleTimeoutMillis: 30000,
      max: 10,
    })
  : doumoriPool;

/**
 * データベースのテーブルスキーマを自動作成・初期化
 */
export async function initDatabase() {
  let client;
  try {
    client = await doumoriPool.connect();
    // 1. どうぶつの森Bot専用ユーザーデータ
    await client.query(`
      CREATE TABLE IF NOT EXISTS doumori_users (
        guild_id BIGINT,
        user_id BIGINT,
        tickets INTEGER DEFAULT 0,
        coins INTEGER DEFAULT 0,
        vc_total_seconds INTEGER DEFAULT 0,
        vc_unclaimed_seconds INTEGER DEFAULT 0,
        chat_message_count INTEGER DEFAULT 0,
        PRIMARY KEY (guild_id, user_id)
      );
    `);

    // 2. インベントリ (道具所持数)
    await client.query(`
      CREATE TABLE IF NOT EXISTS doumori_inventory (
        guild_id BIGINT,
        user_id BIGINT,
        item_id TEXT,
        quantity INTEGER DEFAULT 0,
        PRIMARY KEY (guild_id, user_id, item_id)
      );
    `);

    // 3. 図鑑コレクション
    await client.query(`
      CREATE TABLE IF NOT EXISTS doumori_collection (
        guild_id BIGINT,
        user_id BIGINT,
        category TEXT,
        creature_id TEXT,
        count INTEGER DEFAULT 1,
        has_shiny BOOLEAN DEFAULT FALSE,
        first_caught_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (guild_id, user_id, category, creature_id)
      );
    `);

    // 4. マイルポイント＆ランクテーブル
    await client.query(`
      CREATE TABLE IF NOT EXISTS doumori_miles (
        guild_id BIGINT,
        user_id BIGINT,
        miles INTEGER DEFAULT 0,
        rank_level INTEGER DEFAULT 1,
        mission_count INTEGER DEFAULT 0,
        total_mission_count INTEGER DEFAULT 0,
        last_diy_at TIMESTAMP,
        PRIMARY KEY (guild_id, user_id)
      );
    `);

    // 既存テーブルへのカラム追加（安全なマイグレーション）
    await client.query("ALTER TABLE doumori_miles ADD COLUMN IF NOT EXISTS mission_count INTEGER DEFAULT 0").catch(() => {});
    await client.query("ALTER TABLE doumori_miles ADD COLUMN IF NOT EXISTS total_mission_count INTEGER DEFAULT 0").catch(() => {});

    // 5. デイリーミッションテーブル
    await client.query(`
      CREATE TABLE IF NOT EXISTS doumori_daily_missions (
        guild_id BIGINT,
        user_id BIGINT,
        date_key TEXT,
        mission_desc TEXT,
        reward_miles INTEGER DEFAULT 30,
        status TEXT DEFAULT 'pending',
        proof_url TEXT,
        PRIMARY KEY (guild_id, user_id, date_key)
      );
    `);

    // 6. ミッション承認・処理履歴ログテーブル
    await client.query(`
      CREATE TABLE IF NOT EXISTS doumori_mission_logs (
        id SERIAL PRIMARY KEY,
        guild_id BIGINT,
        user_id BIGINT,
        staff_id BIGINT,
        mission_desc TEXT,
        reward_miles INTEGER DEFAULT 100,
        mission_count INTEGER DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 7. マイル手動付与・没収ログテーブル (管理者用)
    await client.query(`
      CREATE TABLE IF NOT EXISTS doumori_mile_logs (
        id SERIAL PRIMARY KEY,
        guild_id BIGINT,
        user_id BIGINT,
        admin_id BIGINT,
        amount INTEGER,
        action TEXT,
        reason TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    console.log("✅ doumori データベーススキーマ（マイル・ミッション・履歴ログ含む）の初期化が完了しました。");
  } catch (error) {
    console.error("❌ doumori データベース初期化エラー:", error);
  } finally {
    if (client) client.release();
  }

  // Manybot DB側にも users テーブルの全カラム確保
  let mbClient;
  try {
    mbClient = await manybotPool.connect();

    // テーブル作成
    await mbClient.query(`
      CREATE TABLE IF NOT EXISTS users (
        guild_id BIGINT,
        user_id BIGINT,
        balance INTEGER DEFAULT 0,
        last_daily TIMESTAMP,
        chinchiro_count INTEGER DEFAULT 0,
        chinchiro_last_date TEXT,
        chinchiro_daily_bet INTEGER DEFAULT 0,
        tc_xp INTEGER DEFAULT 0,
        tc_level INTEGER DEFAULT 1,
        vc_xp INTEGER DEFAULT 0,
        vc_level INTEGER DEFAULT 1,
        evaluation_vc_time INTEGER DEFAULT 0,
        initial_issued BOOLEAN DEFAULT FALSE,
        event_points INTEGER DEFAULT 0,
        PRIMARY KEY (guild_id, user_id)
      );
    `);

    // manybotが必要とするすべての欠落カラムの安全補強 (ALTER TABLE)
    const columnsToEnsure = [
      "ALTER TABLE users ADD COLUMN IF NOT EXISTS guild_id BIGINT",
      "ALTER TABLE users ADD COLUMN IF NOT EXISTS balance INTEGER DEFAULT 0",
      "ALTER TABLE users ADD COLUMN IF NOT EXISTS last_daily TIMESTAMP",
      "ALTER TABLE users ADD COLUMN IF NOT EXISTS chinchiro_count INTEGER DEFAULT 0",
      "ALTER TABLE users ADD COLUMN IF NOT EXISTS chinchiro_last_date TEXT",
      "ALTER TABLE users ADD COLUMN IF NOT EXISTS chinchiro_daily_bet INTEGER DEFAULT 0",
      "ALTER TABLE users ADD COLUMN IF NOT EXISTS tc_xp INTEGER DEFAULT 0",
      "ALTER TABLE users ADD COLUMN IF NOT EXISTS tc_level INTEGER DEFAULT 1",
      "ALTER TABLE users ADD COLUMN IF NOT EXISTS vc_xp INTEGER DEFAULT 0",
      "ALTER TABLE users ADD COLUMN IF NOT EXISTS vc_level INTEGER DEFAULT 1",
      "ALTER TABLE users ADD COLUMN IF NOT EXISTS evaluation_vc_time INTEGER DEFAULT 0",
      "ALTER TABLE users ADD COLUMN IF NOT EXISTS initial_issued BOOLEAN DEFAULT FALSE",
      "ALTER TABLE users ADD COLUMN IF NOT EXISTS event_points INTEGER DEFAULT 0",
    ];

    for (const colQuery of columnsToEnsure) {
      await mbClient.query(colQuery).catch((err) => console.warn(`Migration warning: ${err.message}`));
    }

    console.log("✅ manybot データベース（usersテーブル・完全全カラム）の確認・補強が完了しました。");
  } catch (err) {
    console.error("❌ manybot DB初期化確認エラー:", err);
  } finally {
    if (mbClient) mbClient.release();
  }
}

/**
 * Doumoriユーザー情報の取得または初期化
 */
export async function getUser(guildId, userId) {
  const res = await doumoriPool.query(
    "SELECT * FROM doumori_users WHERE guild_id = $1 AND user_id = $2",
    [guildId, userId]
  );
  if (res.rows.length === 0) {
    const insertRes = await doumoriPool.query(
      "INSERT INTO doumori_users (guild_id, user_id) VALUES ($1, $2) RETURNING *",
      [guildId, userId]
    );
    return insertRes.rows[0];
  }
  return res.rows[0];
}

/**
 * マイルポイント & ランクデータの取得または初期化
 */
export async function getUserMiles(guildId, userId) {
  const res = await doumoriPool.query(
    "SELECT * FROM doumori_miles WHERE guild_id = $1 AND user_id = $2",
    [guildId, userId]
  );
  if (res.rows.length === 0) {
    const insertRes = await doumoriPool.query(
      "INSERT INTO doumori_miles (guild_id, user_id, miles, rank_level) VALUES ($1, $2, 0, 1) RETURNING *",
      [guildId, userId]
    );
    return insertRes.rows[0];
  }
  return res.rows[0];
}

/**
 * マイルポイントの加算/消費
 */
export async function addMiles(guildId, userId, amount) {
  const res = await doumoriPool.query(
    `INSERT INTO doumori_miles (guild_id, user_id, miles)
     VALUES ($1, $2, $3)
     ON CONFLICT (guild_id, user_id)
     DO UPDATE SET miles = doumori_miles.miles + $3
     RETURNING miles`,
    [guildId, userId, amount]
  );
  return res.rows[0].miles;
}

/**
 * ランクレベルの設定
 */
export async function setRankLevel(guildId, userId, newRankLevel) {
  await doumoriPool.query(
    `INSERT INTO doumori_miles (guild_id, user_id, rank_level)
     VALUES ($1, $2, $3)
     ON CONFLICT (guild_id, user_id)
     DO UPDATE SET rank_level = $3`,
    [guildId, userId, newRankLevel]
  );
}

/**
 * DIY作業台（イベント）最終実行日時の更新
 */
export async function updateLastDiyAt(guildId, userId) {
  await doumoriPool.query(
    `INSERT INTO doumori_miles (guild_id, user_id, last_diy_at)
     VALUES ($1, $2, CURRENT_TIMESTAMP)
     ON CONFLICT (guild_id, user_id)
     DO UPDATE SET last_diy_at = CURRENT_TIMESTAMP`,
    [guildId, userId]
  );
}

/**
 * デイリーミッションの取得または自動生成
 */
export async function getOrCreateDailyMission(guildId, userId, rankLevel) {
  // 本日の日付キー (JST: YYYY-MM-DD)
  const todayStr = new Date(Date.now() + 9 * 3600 * 1000).toISOString().split("T")[0];

  const res = await doumoriPool.query(
    "SELECT * FROM doumori_daily_missions WHERE guild_id = $1 AND user_id = $2 AND date_key = $3",
    [guildId, userId, todayStr]
  );

  if (res.rows.length > 0) {
    return res.rows[0];
  }

  // ランクに応じたミッションリストからランダム抽選
  const templates = CONFIG.DAILY_MISSIONS[rankLevel] || CONFIG.DAILY_MISSIONS[1];
  const selected = templates[Math.floor(Math.random() * templates.length)];

  const insertRes = await doumoriPool.query(
    `INSERT INTO doumori_daily_missions (guild_id, user_id, date_key, mission_desc, reward_miles, status)
     VALUES ($1, $2, $3, $4, $5, 'pending')
     RETURNING *`,
    [guildId, userId, todayStr, selected.desc, selected.miles]
  );

  return insertRes.rows[0];
}

/**
 * デイリーミッションの報告送信
 */
export async function submitMissionReport(guildId, userId, dateKey, proofUrl) {
  await doumoriPool.query(
    `UPDATE doumori_daily_missions
     SET status = 'submitted', proof_url = $1
     WHERE guild_id = $2 AND user_id = $3 AND date_key = $4`,
    [proofUrl, guildId, userId, dateKey]
  );
}

/**
 * 住民カード用データの総合取得（ロール情報を優先反映）
 */
export async function getResidentCardData(guildId, userId, member = null) {
  const milesData = await getUserMiles(guildId, userId);
  const doumoriUser = await getUser(guildId, userId);
  const bells = await getManybotBalance(guildId, userId);

  const rankInfo = resolveRankFromMember(member, milesData.rank_level);

  return {
    guildId,
    userId,
    miles: milesData.miles || 0,
    rankLevel: rankInfo.level,
    rankName: rankInfo.name,
    rankRoleName: rankInfo.roleName,
    rankColor: rankInfo.color,
    missionCount: milesData.mission_count || 0,
    totalMissionCount: milesData.total_mission_count || 0,
    tickets: doumoriUser.tickets || 0,
    bells: bells || 0,
  };
}

/**
 * デイリーミッションの承認 ＆ マイル付与 ＆ 住民カードカウント自動更新 ＆ 履歴保存
 */
export async function approveMissionReport(guildId, userId, dateKey, staffId = null, countMultiplier = 1, member = null) {
  const res = await doumoriPool.query(
    "SELECT * FROM doumori_daily_missions WHERE guild_id = $1 AND user_id = $2 AND date_key = $3",
    [guildId, userId, dateKey]
  );

  if (res.rows.length === 0 || res.rows[0].status === "approved") {
    return null;
  }

  const mission = res.rows[0];
  const count = Math.max(1, parseInt(countMultiplier, 10) || 1);
  const totalRewardMiles = (mission.reward_miles || 30) * count;

  // ステータスを達成済みに更新
  await doumoriPool.query(
    "UPDATE doumori_daily_missions SET status = 'approved' WHERE guild_id = $1 AND user_id = $2 AND date_key = $3",
    [guildId, userId, dateKey]
  );

  // マイル加算 ＆ 階級ミッション回数 ＆ 累計ミッション回数の加算
  const updateRes = await doumoriPool.query(
    `INSERT INTO doumori_miles (guild_id, user_id, miles, rank_level, mission_count, total_mission_count)
     VALUES ($1, $2, $3, 1, $4, $4)
     ON CONFLICT (guild_id, user_id)
     DO UPDATE SET
       miles = doumori_miles.miles + $3,
       mission_count = COALESCE(doumori_miles.mission_count, 0) + $4,
       total_mission_count = COALESCE(doumori_miles.total_mission_count, 0) + $4
     RETURNING miles, rank_level, mission_count, total_mission_count`,
    [guildId, userId, totalRewardMiles, count]
  );

  const updatedMiles = updateRes.rows[0];

  // 処理履歴（ログ）をDBに保存
  await doumoriPool.query(
    `INSERT INTO doumori_mission_logs (guild_id, user_id, staff_id, mission_desc, reward_miles, mission_count)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [guildId, userId, staffId, mission.mission_desc, totalRewardMiles, count]
  ).catch((err) => console.error("❌ Mission log save error:", err));

  const rankInfo = resolveRankFromMember(member, updatedMiles.rank_level);

  return {
    missionDesc: mission.mission_desc,
    countMultiplier: count,
    rewardMiles: totalRewardMiles,
    newMiles: updatedMiles.miles,
    rankLevel: rankInfo.level,
    rankName: rankInfo.name,
    rankColor: rankInfo.color,
    missionCount: updatedMiles.mission_count,
    totalMissionCount: updatedMiles.total_mission_count,
  };
}

/**
 * 管理者によるマイル付与
 */
export async function adminAddMiles(guildId, userId, amount, adminId, reason = "") {
  const newMiles = await addMiles(guildId, userId, amount);
  await doumoriPool.query(
    `INSERT INTO doumori_mile_logs (guild_id, user_id, admin_id, amount, action, reason)
     VALUES ($1, $2, $3, $4, 'grant', $5)`,
    [guildId, userId, adminId, amount, reason]
  ).catch((err) => console.error("❌ Mile grant log error:", err));
  return newMiles;
}

/**
 * 管理者によるマイル没収
 */
export async function adminRemoveMiles(guildId, userId, amount, adminId, reason = "") {
  const currentData = await getUserMiles(guildId, userId);
  const actualDeduct = Math.min(currentData.miles, amount);
  const newMiles = await addMiles(guildId, userId, -actualDeduct);

  await doumoriPool.query(
    `INSERT INTO doumori_mile_logs (guild_id, user_id, admin_id, amount, action, reason)
     VALUES ($1, $2, $3, $4, 'revoke', $5)`,
    [guildId, userId, adminId, actualDeduct, reason]
  ).catch((err) => console.error("❌ Mile revoke log error:", err));

  return { newMiles, deducted: actualDeduct };
}

/**
 * マイルを消費してチケットを購入
 */
export async function buyTicketsWithMiles(guildId, userId, ticketCount = 1) {
  const rate = CONFIG.EXCHANGE_RATES.MILES_PER_TICKET || 100;
  const count = Math.max(1, parseInt(ticketCount, 10) || 1);
  const requiredMiles = count * rate;

  const currentMilesData = await getUserMiles(guildId, userId);
  if (currentMilesData.miles < requiredMiles) {
    return {
      success: false,
      reason: "NOT_ENOUGH_MILES",
      needed: requiredMiles,
      current: currentMilesData.miles,
    };
  }

  // マイルを消費
  const newMiles = await addMiles(guildId, userId, -requiredMiles);
  // チケットを付与
  const newTickets = await addTickets(guildId, userId, count);

  return {
    success: true,
    spentMiles: requiredMiles,
    ticketCount: count,
    newMiles,
    newTickets,
  };
}

/**
 * manybot DBの balance (通貨) を取得
 */
export async function getManybotBalance(guildId, userId) {
  const res = await manybotPool.query(
    "SELECT balance FROM users WHERE guild_id = $1 AND user_id = $2",
    [guildId, userId]
  );
  if (res.rows.length === 0) {
    return 0;
  }
  return res.rows[0].balance || 0;
}

/**
 * manybot DBの balance (通貨) を更新・加算
 */
export async function addManybotBalance(guildId, userId, amount) {
  await manybotPool.query(
    `INSERT INTO users (guild_id, user_id, balance)
     VALUES ($1, $2, $3)
     ON CONFLICT (guild_id, user_id)
     DO UPDATE SET balance = users.balance + $3`,
    [guildId, userId, amount]
  );
}

/**
 * チケットの変更
 */
export async function addTickets(guildId, userId, amount) {
  const res = await doumoriPool.query(
    `INSERT INTO doumori_users (guild_id, user_id, tickets)
     VALUES ($1, $2, $3)
     ON CONFLICT (guild_id, user_id)
     DO UPDATE SET tickets = doumori_users.tickets + $3
     RETURNING tickets`,
    [guildId, userId, amount]
  );
  return res.rows[0].tickets;
}

/**
 * インベントリ内の道具数を取得
 */
export async function getItemCount(guildId, userId, itemId) {
  const res = await doumoriPool.query(
    "SELECT quantity FROM doumori_inventory WHERE guild_id = $1 AND user_id = $2 AND item_id = $3",
    [guildId, userId, itemId]
  );
  if (res.rows.length === 0) return 0;
  return res.rows[0].quantity || 0;
}

/**
 * インベントリの道具数を加算/消費
 */
export async function addInventoryItem(guildId, userId, itemId, amount) {
  const res = await doumoriPool.query(
    `INSERT INTO doumori_inventory (guild_id, user_id, item_id, quantity)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (guild_id, user_id, item_id)
     DO UPDATE SET quantity = doumori_inventory.quantity + $4
     RETURNING quantity`,
    [guildId, userId, itemId, amount]
  );
  return res.rows[0].quantity;
}

/**
 * 生き物捕獲記録を追加 / 更新
 */
export async function recordCatch(guildId, userId, category, creatureId, isShiny) {
  const check = await doumoriPool.query(
    "SELECT * FROM doumori_collection WHERE guild_id = $1 AND user_id = $2 AND category = $3 AND creature_id = $4",
    [guildId, userId, category, creatureId]
  );

  let isFirstTime = false;
  if (check.rows.length === 0) {
    isFirstTime = true;
    await doumoriPool.query(
      `INSERT INTO doumori_collection (guild_id, user_id, category, creature_id, count, has_shiny)
       VALUES ($1, $2, $3, $4, 1, $5)`,
      [guildId, userId, category, creatureId, isShiny]
    );
  } else {
    const currentShiny = check.rows[0].has_shiny;
    const newShiny = currentShiny || isShiny;
    await doumoriPool.query(
      `UPDATE doumori_collection
       SET count = count + 1, has_shiny = $1
       WHERE guild_id = $2 AND user_id = $3 AND category = $4 AND creature_id = $5`,
      [newShiny, guildId, userId, category, creatureId]
    );
  }

  return isFirstTime;
}

/**
 * コレクション (図鑑データ) 一覧の取得
 */
export async function getUserCollection(guildId, userId, category) {
  const res = await doumoriPool.query(
    "SELECT * FROM doumori_collection WHERE guild_id = $1 AND user_id = $2 AND category = $3",
    [guildId, userId, category]
  );
  return res.rows;
}

/**
 * 収集率ランキングの取得
 */
export async function getLeaderboard(guildId, totalCount) {
  const res = await doumoriPool.query(
    `SELECT user_id, COUNT(DISTINCT creature_id) as caught_types
     FROM doumori_collection
     WHERE guild_id = $1
     GROUP BY user_id
     ORDER BY caught_types DESC
     LIMIT 10`,
    [guildId]
  );
  return res.rows;
}

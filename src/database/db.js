import pg from "pg";
import dotenv from "dotenv";

dotenv.config();

const { Pool } = pg;

// Doumori専用 Supabase / PostgreSQL DB
const doumoriDbUrl = process.env.DOUMORI_DATABASE_URL || process.env.DATABASE_URL;

// Manybot専用 Supabase / PostgreSQL DB
const manybotDbUrl = process.env.MANYBOT_DATABASE_URL;

if (!doumoriDbUrl) {
  console.warn("⚠️ DOUMORI_DATABASE_URL (または DATABASE_URL) が設定されていません。");
}

export const doumoriPool = new Pool({
  connectionString: doumoriDbUrl,
  ssl: doumoriDbUrl && doumoriDbUrl.includes("supabase") ? { rejectUnauthorized: false } : false,
});

// Manybot DB接続 (設定されている場合のみ分離接続)
export const manybotPool = manybotDbUrl
  ? new Pool({
      connectionString: manybotDbUrl,
      ssl: manybotDbUrl.includes("supabase") ? { rejectUnauthorized: false } : false,
    })
  : doumoriPool;

/**
 * データベースのテーブルスキーマを自動作成・初期化
 */
export async function initDatabase() {
  const client = await doumoriPool.connect();
  try {
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

    console.log("✅ doumori データベーススキーマの初期化が完了しました。");
  } catch (error) {
    console.error("❌ doumori データベース初期化エラー:", error);
  } finally {
    client.release();
  }

  // Manybot DB側にも users テーブルの確保 (フォールバック時含む)
  try {
    const mbClient = await manybotPool.connect();
    await mbClient.query(`
      CREATE TABLE IF NOT EXISTS users (
        guild_id BIGINT,
        user_id BIGINT,
        balance INTEGER DEFAULT 0,
        PRIMARY KEY (guild_id, user_id)
      );
    `);
    mbClient.release();
    console.log("✅ manybot データベース接続・確認が完了しました。");
  } catch (err) {
    console.error("❌ manybot DB初期化確認エラー:", err);
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

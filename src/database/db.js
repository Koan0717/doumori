import pg from "pg";
import dotenv from "dotenv";

dotenv.config();

const { Pool } = pg;

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.warn("⚠️ DATABASE_URL が設定されていません。Supabase / PostgreSQL に接続できません。");
}

export const pool = new Pool({
  connectionString,
  ssl: connectionString && connectionString.includes("supabase") ? { rejectUnauthorized: false } : false,
});

/**
 * データベースのテーブルスキーマを自動作成・初期化
 */
export async function initDatabase() {
  const client = await pool.connect();
  try {
    // 1. manybot 互換の users テーブル (既存に存在しなければ作成)
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        guild_id BIGINT,
        user_id BIGINT,
        balance INTEGER DEFAULT 0,
        PRIMARY KEY (guild_id, user_id)
      );
    `);

    // 2. どうぶつの森Bot専用ユーザーデータ
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

    // 3. インベントリ (道具所持数)
    await client.query(`
      CREATE TABLE IF NOT EXISTS doumori_inventory (
        guild_id BIGINT,
        user_id BIGINT,
        item_id TEXT,
        quantity INTEGER DEFAULT 0,
        PRIMARY KEY (guild_id, user_id, item_id)
      );
    `);

    // 4. 図鑑コレクション
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

    console.log("✅ データベーススキーマの初期化が完了しました。");
  } catch (error) {
    console.error("❌ データベース初期化エラー:", error);
  } finally {
    client.release();
  }
}

/**
 * ユーザー情報の取得または初期化
 */
export async function getUser(guildId, userId) {
  const res = await pool.query(
    "SELECT * FROM doumori_users WHERE guild_id = $1 AND user_id = $2",
    [guildId, userId]
  );
  if (res.rows.length === 0) {
    const insertRes = await pool.query(
      "INSERT INTO doumori_users (guild_id, user_id) VALUES ($1, $2) RETURNING *",
      [guildId, userId]
    );
    return insertRes.rows[0];
  }
  return res.rows[0];
}

/**
 * manybotの balance (通貨) を取得
 */
export async function getManybotBalance(guildId, userId) {
  const res = await pool.query(
    "SELECT balance FROM users WHERE guild_id = $1 AND user_id = $2",
    [guildId, userId]
  );
  if (res.rows.length === 0) {
    return 0;
  }
  return res.rows[0].balance || 0;
}

/**
 * manybotの balance (通貨) を更新・加算
 */
export async function addManybotBalance(guildId, userId, amount) {
  await pool.query(
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
  const res = await pool.query(
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
  const res = await pool.query(
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
  const res = await pool.query(
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
  const check = await pool.query(
    "SELECT * FROM doumori_collection WHERE guild_id = $1 AND user_id = $2 AND category = $3 AND creature_id = $4",
    [guildId, userId, category, creatureId]
  );

  let isFirstTime = false;
  if (check.rows.length === 0) {
    isFirstTime = true;
    await pool.query(
      `INSERT INTO doumori_collection (guild_id, user_id, category, creature_id, count, has_shiny)
       VALUES ($1, $2, $3, $4, 1, $5)`,
      [guildId, userId, category, creatureId, isShiny]
    );
  } else {
    const currentShiny = check.rows[0].has_shiny;
    const newShiny = currentShiny || isShiny;
    await pool.query(
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
  const res = await pool.query(
    "SELECT * FROM doumori_collection WHERE guild_id = $1 AND user_id = $2 AND category = $3",
    [guildId, userId, category]
  );
  return res.rows;
}

/**
 * 収集率ランキングの取得
 */
export async function getLeaderboard(guildId, totalCount) {
  const res = await pool.query(
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

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
    await client.query("CREATE UNIQUE INDEX IF NOT EXISTS doumori_miles_uidx ON doumori_miles (guild_id, user_id)").catch(() => {});

    // 5. デイリーミッションテーブル (1日3枠対応)
    await client.query(`
      CREATE TABLE IF NOT EXISTS doumori_daily_missions (
        guild_id BIGINT,
        user_id BIGINT,
        date_key TEXT,
        mission_slot INTEGER DEFAULT 1,
        mission_id INTEGER,
        mission_title TEXT,
        mission_desc TEXT,
        reward_miles INTEGER DEFAULT 100,
        status TEXT DEFAULT 'pending',
        proof_url TEXT
      );
    `);

    // 既存テーブルへのカラム追加（安全なマイグレーション）
    await client.query("ALTER TABLE doumori_daily_missions ADD COLUMN IF NOT EXISTS mission_slot INTEGER DEFAULT 1").catch(() => {});
    await client.query("ALTER TABLE doumori_daily_missions ADD COLUMN IF NOT EXISTS mission_id INTEGER").catch(() => {});
    await client.query("ALTER TABLE doumori_daily_missions ADD COLUMN IF NOT EXISTS mission_title TEXT").catch(() => {});
    
    // 古い主キー制約 (guild_id, user_id, date_key) を削除して3枠同日保存を可能にする
    try {
      await client.query("ALTER TABLE doumori_daily_missions DROP CONSTRAINT IF EXISTS doumori_daily_missions_pkey");
    } catch (e) {}

    await client.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS doumori_daily_missions_slot_uidx
      ON doumori_daily_missions (guild_id, user_id, date_key, mission_slot);
    `).catch(() => {});

    // 6. ミッションマスターテーブル (ダッシュボード用ミッション管理)
    await client.query(`
      CREATE TABLE IF NOT EXISTS doumori_missions_master (
        id SERIAL PRIMARY KEY,
        guild_id BIGINT DEFAULT 0,
        title TEXT NOT NULL,
        description TEXT NOT NULL,
        target_rank INTEGER DEFAULT 0,
        reward_miles INTEGER DEFAULT 100,
        is_active BOOLEAN DEFAULT TRUE,
        times_assigned INTEGER DEFAULT 0,
        times_completed INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 7. 階級・ランクマスターテーブル (ダッシュボード用ランク設定)
    await client.query(`
      CREATE TABLE IF NOT EXISTS doumori_ranks_master (
        level INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        required_miles INTEGER NOT NULL,
        color TEXT NOT NULL,
        role_name TEXT NOT NULL,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 初期ランクデータの投入 (未存在時のみ)
    const initialRanks = [
      { level: 1, name: "🌱 新規住人", requiredMiles: 0, color: "#A8E6CF", roleName: "新規住人" },
      { level: 2, name: "🏠 住人", requiredMiles: 4000, color: "#3498DB", roleName: "住人" },
      { level: 3, name: "☕ 常連住人", requiredMiles: 15000, color: "#E67E22", roleName: "常連住人" },
      { level: 4, name: "🌟 人気住人", requiredMiles: 45000, color: "#FFD700", roleName: "人気住人" },
    ];
    for (const r of initialRanks) {
      await client.query(
        `INSERT INTO doumori_ranks_master (level, name, required_miles, color, role_name)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (level) DO NOTHING`,
        [r.level, r.name, r.requiredMiles, r.color, r.roleName]
      ).catch(() => {});
    }

    // 初期ミッションマスターの投入 (未存在時のみ)
    const mCheck = await client.query("SELECT COUNT(*) FROM doumori_missions_master");
    if (parseInt(mCheck.rows[0].count, 10) === 0) {
      const defaultMissions = [
        { title: "VC交流", desc: "VCに通算30分以上参加する", rank: 0, miles: 100 },
        { title: "雑談あいさつ", desc: "雑談チャンネルであいさつや会話を3回以上送信する", rank: 0, miles: 100 },
        { title: "魚釣り挑戦", desc: "`/釣り` で魚を1匹以上釣り上げる", rank: 0, miles: 100 },
        { title: "虫捕り挑戦", desc: "`/虫捕り` で虫を1匹以上捕まえる", rank: 0, miles: 100 },
        { title: "ショップ利用", desc: "`/ショップ` または `/両替` を1回利用する", rank: 0, miles: 100 },
        { title: "生き物売却", desc: "`/売却` で重複した生き物を売却してゼニーにする", rank: 0, miles: 100 },
        { title: "VC長時間滞在", desc: "VCに通算1時間以上参加してメンバーと交流する", rank: 0, miles: 100 },
        { title: "レア生き物捕獲", desc: "レア度RARE以上の生き物を1匹捕獲する", rank: 0, miles: 100 },
        { title: "図鑑チェック", desc: "`/魚図鑑` または `/虫図鑑` を確認してコレクションを広げる", rank: 0, miles: 100 },
        { title: "イベント参加", desc: "DIY作業台イベントや鯖内イベントに参加・告知する", rank: 0, miles: 100 },
      ];
      for (const m of defaultMissions) {
        await client.query(
          `INSERT INTO doumori_missions_master (title, description, target_rank, reward_miles, is_active)
           VALUES ($1, $2, $3, $4, TRUE)`,
          [m.title, m.desc, m.rank, m.miles]
        ).catch(() => {});
      }
    }

    // 8. ミッション承認・処理履歴ログテーブル
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

    // 9. マイル手動付与・没収ログテーブル (管理者用)
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

      -- 10. どうぶつの森Bot 設定テーブル
      CREATE TABLE IF NOT EXISTS doumori_settings (
        guild_id BIGINT,
        setting_key TEXT,
        setting_value TEXT,
        PRIMARY KEY (guild_id, setting_key)
      );
    `);

    console.log("✅ doumori データベーススキーマ（マイル・3枠ミッション・マスター含む）の初期化が完了しました。");
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
 * 階級・ランクマスター一覧の取得（DBを優先、無ければCONFIGフォールバック）
 */
export async function getDoumoriRanksMaster() {
  try {
    const res = await doumoriPool.query(
      "SELECT level, name, required_miles, color, role_name FROM doumori_ranks_master ORDER BY level ASC"
    );
    if (res.rows.length > 0) {
      return res.rows.map((r) => ({
        level: r.level,
        name: r.name,
        requiredMiles: parseInt(r.required_miles, 10),
        color: r.color,
        roleName: r.role_name,
      }));
    }
  } catch (err) {
    console.warn("⚠️ doumori_ranks_master fetch failed, fallback to CONFIG.RANKS:", err.message);
  }
  return CONFIG.RANKS;
}

/**
 * 階級・ランクマスターの保存・更新
 */
export async function saveDoumoriRankMaster(level, rankData) {
  const { name, requiredMiles, color, roleName } = rankData;
  await doumoriPool.query(
    `INSERT INTO doumori_ranks_master (level, name, required_miles, color, role_name, updated_at)
     VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)
     ON CONFLICT (level)
     DO UPDATE SET
       name = EXCLUDED.name,
       required_miles = EXCLUDED.required_miles,
       color = EXCLUDED.color,
       role_name = EXCLUDED.role_name,
       updated_at = CURRENT_TIMESTAMP`,
    [level, name, requiredMiles, color, roleName]
  );
}

/**
 * ミッションマスター一覧の取得 (ダッシュボード用)
 */
export async function getMissionsMaster(guildId = 0) {
  const res = await doumoriPool.query(
    `SELECT * FROM doumori_missions_master
     WHERE guild_id = $1 OR guild_id = 0
     ORDER BY is_active DESC, id ASC`,
    [guildId]
  );
  return res.rows;
}

/**
 * ミッションマスターの新規作成
 */
export async function createMissionMaster(guildId, data) {
  const { title, description, target_rank = 0, reward_miles = 100 } = data;
  const res = await doumoriPool.query(
    `INSERT INTO doumori_missions_master (guild_id, title, description, target_rank, reward_miles, is_active)
     VALUES ($1, $2, $3, $4, $5, TRUE)
     RETURNING *`,
    [guildId || 0, title, description, target_rank, reward_miles]
  );
  return res.rows[0];
}

/**
 * ミッションマスターの更新
 */
export async function updateMissionMaster(id, data) {
  const { title, description, target_rank, reward_miles, is_active } = data;
  const res = await doumoriPool.query(
    `UPDATE doumori_missions_master
     SET title = COALESCE($1, title),
         description = COALESCE($2, description),
         target_rank = COALESCE($3, target_rank),
         reward_miles = COALESCE($4, reward_miles),
         is_active = COALESCE($5, is_active),
         updated_at = CURRENT_TIMESTAMP
     WHERE id = $6
     RETURNING *`,
    [title, description, target_rank, reward_miles, is_active, id]
  );
  return res.rows[0];
}

/**
 * ミッションマスターの削除
 */
export async function deleteMissionMaster(id) {
  await doumoriPool.query("DELETE FROM doumori_missions_master WHERE id = $1", [id]);
}

/**
 * 1日3枠のデイリーミッション取得または自動生成
 */
export async function getOrCreateDailyMissions(guildId, userId, rankLevel = 1) {
  // 本日の日付キー (JST: YYYY-MM-DD)
  const todayStr = new Date(Date.now() + 9 * 3600 * 1000).toISOString().split("T")[0];

  // 1. 有効なミッションマスターを取得（ダッシュボードで設定されたミッション）
  let masterPoolRows = [];
  try {
    const mRes = await doumoriPool.query(
      `SELECT * FROM doumori_missions_master
       WHERE (guild_id = $1 OR guild_id = 0) AND is_active = TRUE AND (target_rank = 0 OR target_rank = $2)
       ORDER BY id ASC`,
      [guildId, rankLevel]
    );
    masterPoolRows = mRes.rows || [];
  } catch (err) {
    console.warn("⚠️ Master mission fetch error:", err);
  }

  // マスターが無ければデフォルトテンプレートから生成
  if (masterPoolRows.length === 0) {
    const fallbackTemplates = [
      { title: "VC交流", desc: "VCに通算30分以上参加する", miles: 100 },
      { title: "雑談チャット", desc: "雑談チャンネルで3回以上メッセージを発言する", miles: 100 },
    ];
    masterPoolRows = fallbackTemplates.map((t, idx) => ({
      id: idx + 1,
      title: t.title || "ミッション",
      description: t.desc,
      reward_miles: t.miles || 100,
    }));
  }

  // 2. 本日の既存ミッションを取得
  const res = await doumoriPool.query(
    `SELECT * FROM doumori_daily_missions
     WHERE guild_id = $1 AND user_id = $2 AND date_key = $3
     ORDER BY mission_slot ASC`,
    [guildId, userId, todayStr]
  ).catch(() => ({ rows: [] }));

  const masterTitles = new Set(masterPoolRows.map((m) => m.title));

  // ダッシュボードに存在しない古いミッション（魚釣り等）がpendingのまま残っている、または3枠未満の場合はpendingを削除して再同期
  const hasOutdatedPending = (res.rows || []).some(
    (r) => r.status === "pending" && !masterTitles.has(r.mission_title)
  );

  if (hasOutdatedPending || !res.rows || res.rows.length < 3) {
    await doumoriPool.query(
      `DELETE FROM doumori_daily_missions
       WHERE guild_id = $1 AND user_id = $2 AND date_key = $3 AND status = 'pending'`,
      [guildId, userId, todayStr]
    ).catch(() => {});
  } else if (res.rows && res.rows.length >= 3) {
    return res.rows;
  }

  // 3. 再度残りのスロットを確認
  const currentRes = await doumoriPool.query(
    `SELECT * FROM doumori_daily_missions
     WHERE guild_id = $1 AND user_id = $2 AND date_key = $3
     ORDER BY mission_slot ASC`,
    [guildId, userId, todayStr]
  ).catch(() => ({ rows: [] }));

  const existingSlots = new Set((currentRes.rows || []).map((r) => r.mission_slot));

  // 古いPK制約を念のため削除
  try {
    await doumoriPool.query("ALTER TABLE doumori_daily_missions DROP CONSTRAINT IF EXISTS doumori_daily_missions_pkey");
  } catch (e) {}

  // スロット1〜3を順に生成（ダッシュボードの登録ミッションのみから選出）
  for (let slot = 1; slot <= 3; slot++) {
    if (existingSlots.has(slot)) continue;

    const selected = masterPoolRows[(slot - 1) % masterPoolRows.length];

    const title = selected.title || "デイリーミッション";
    const desc = selected.description || selected.desc || "ミッションを達成しよう！";
    const miles = selected.reward_miles || selected.miles || 100;
    const mId = selected.id || null;

    try {
      await doumoriPool.query(
        `INSERT INTO doumori_daily_missions (guild_id, user_id, date_key, mission_slot, mission_id, mission_title, mission_desc, reward_miles, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'pending')`,
        [guildId, userId, todayStr, slot, mId, title, desc, miles]
      );
    } catch (insertErr) {
      console.error(`Slot ${slot} insert error:`, insertErr);
    }

    // 受注統計を加算
    if (mId) {
      await doumoriPool.query(
        "UPDATE doumori_missions_master SET times_assigned = times_assigned + 1 WHERE id = $1",
        [mId]
      ).catch(() => {});
    }
  }

  const finalRes = await doumoriPool.query(
    `SELECT * FROM doumori_daily_missions
     WHERE guild_id = $1 AND user_id = $2 AND date_key = $3
     ORDER BY mission_slot ASC`,
    [guildId, userId, todayStr]
  );

  return finalRes.rows || [];
}

/**
 * 互換用: 単一デイリーミッション取得
 */
export async function getOrCreateDailyMission(guildId, userId, rankLevel) {
  const missions = await getOrCreateDailyMissions(guildId, userId, rankLevel);
  return missions[0];
}

/**
 * デイリーミッションの報告送信（スロット指定または全スロット）
 */
export async function submitMissionReportSlot(guildId, userId, dateKey, slot = 0, proofUrl = "") {
  if (slot > 0) {
    await doumoriPool.query(
      `UPDATE doumori_daily_missions
       SET status = 'submitted', proof_url = $1
       WHERE guild_id = $2 AND user_id = $3 AND date_key = $4 AND mission_slot = $5 AND status = 'pending'`,
      [proofUrl, guildId, userId, dateKey, slot]
    );
  } else {
    // 全スロット
    await doumoriPool.query(
      `UPDATE doumori_daily_missions
       SET status = 'submitted', proof_url = $1
       WHERE guild_id = $2 AND user_id = $3 AND date_key = $4 AND status = 'pending'`,
      [proofUrl, guildId, userId, dateKey]
    );
  }
}

/**
 * 互換用: ミッション報告送信
 */
export async function submitMissionReport(guildId, userId, dateKey, proofUrl) {
  return submitMissionReportSlot(guildId, userId, dateKey, 0, proofUrl);
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
 * デイリーミッションの承認（スロット単位または全枠） ＆ マイル付与 ＆ 住民カードカウント自動更新 ＆ 履歴保存
 */
export async function approveMissionSlot(guildId, userId, dateKey, slot = 0, staffId = null, member = null) {
  const queryStr = slot > 0
    ? "SELECT * FROM doumori_daily_missions WHERE guild_id = $1 AND user_id = $2 AND date_key = $3 AND mission_slot = $4 AND status != 'approved'"
    : "SELECT * FROM doumori_daily_missions WHERE guild_id = $1 AND user_id = $2 AND date_key = $3 AND status != 'approved'";
  const params = slot > 0 ? [guildId, userId, dateKey, slot] : [guildId, userId, dateKey];

  const res = await doumoriPool.query(queryStr, params);

  if (res.rows.length === 0) {
    return null;
  }

  let totalRewardMiles = 0;
  let approvedCount = 0;
  const approvedMissions = [];

  for (const m of res.rows) {
    const miles = m.reward_miles || 100;
    totalRewardMiles += miles;
    approvedCount += 1;
    approvedMissions.push(m);

    // ステータスを達成済みに更新
    await doumoriPool.query(
      "UPDATE doumori_daily_missions SET status = 'approved' WHERE guild_id = $1 AND user_id = $2 AND date_key = $3 AND mission_slot = $4",
      [guildId, userId, dateKey, m.mission_slot]
    );

    // ミッションマスターの達成統計を加算
    if (m.mission_id) {
      await doumoriPool.query(
        "UPDATE doumori_missions_master SET times_completed = times_completed + 1 WHERE id = $1",
        [m.mission_id]
      ).catch(() => {});
    }

    // 処理履歴（ログ）をDBに保存
    await doumoriPool.query(
      `INSERT INTO doumori_mission_logs (guild_id, user_id, staff_id, mission_desc, reward_miles, mission_count)
       VALUES ($1, $2, $3, $4, $5, 1)`,
      [guildId, userId, staffId, m.mission_desc || m.mission_title, miles]
    ).catch((err) => console.error("❌ Mission log save error:", err));
  }

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
    [guildId, userId, totalRewardMiles, approvedCount]
  );

  const updatedMiles = updateRes.rows[0];
  const rankInfo = resolveRankFromMember(member, updatedMiles.rank_level);

  return {
    approvedCount,
    rewardMiles: totalRewardMiles,
    newMiles: updatedMiles.miles,
    rankLevel: rankInfo.level,
    rankName: rankInfo.name,
    rankColor: rankInfo.color,
    missionCount: updatedMiles.mission_count,
    totalMissionCount: updatedMiles.total_mission_count,
    missions: approvedMissions,
  };
}

/**
 * 互換用: 旧approveMissionReport
 */
export async function approveMissionReport(guildId, userId, dateKey, staffId = null, countMultiplier = 1, member = null) {
  return approveMissionSlot(guildId, userId, dateKey, 0, staffId, member);
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

/**
 * どうぶつの森林 設定の取得
 */
export async function getDoumoriSettings(guildId) {
  try {
    const res = await doumoriPool.query(
      "SELECT setting_key, setting_value FROM doumori_settings WHERE guild_id = $1",
      [guildId]
    );
    const settings = {};
    for (const row of res.rows) {
      try {
        settings[row.setting_key] = JSON.parse(row.setting_value);
      } catch {
        settings[row.setting_key] = row.setting_value;
      }
    }
    return settings;
  } catch (err) {
    return {};
  }
}

/**
 * どうぶつの森林 設定の保存
 */
export async function saveDoumoriSettings(guildId, settingsObj) {
  for (const [key, value] of Object.entries(settingsObj)) {
    const strVal = typeof value === "object" ? JSON.stringify(value) : String(value);
    await doumoriPool.query(
      `INSERT INTO doumori_settings (guild_id, setting_key, setting_value)
       VALUES ($1, $2, $3)
       ON CONFLICT (guild_id, setting_key)
       DO UPDATE SET setting_value = $3`,
      [guildId, key, strVal]
    );
  }
}


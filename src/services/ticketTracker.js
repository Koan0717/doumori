import { CONFIG } from "../config.js";
import { doumoriPool, addTickets } from "../database/db.js";

// VC参加開始時間のメモリキャッシュ Map<`${guildId}_${userId}`, timestamp>
const vcStateMap = new Map();
// チャットスパム防止用 Map<`${guildId}_${userId}`, timestamp>
const chatCooldownMap = new Map();

/**
 * VC状態変更時のハンドラー
 */
export async function handleVoiceStateUpdate(oldState, newState) {
  const member = newState.member || oldState.member;
  if (!member || member.user.bot) return;

  const guildId = member.guild.id;
  const userId = member.id;
  const key = `${guildId}_${userId}`;
  const now = Date.now();

  // VCに接続した時
  if (!oldState.channelId && newState.channelId) {
    vcStateMap.set(key, now);
  }
  // VCから切断した時（または別チャンネルへ移動時）
  else if (oldState.channelId && !newState.channelId) {
    const startTime = vcStateMap.get(key);
    if (startTime) {
      const elapsedSeconds = Math.floor((now - startTime) / 1000);
      vcStateMap.delete(key);

      if (elapsedSeconds > 0) {
        await processUserActivityTime(guildId, userId, elapsedSeconds, newState.member);
      }
    }
  }
}

/**
 * チャット発言時のハンドラー
 */
export async function handleMessageCreate(message) {
  if (!message.guild || message.author.bot) return;

  const guildId = message.guild.id;
  const userId = message.author.id;
  const key = `${guildId}_${userId}`;
  const now = Date.now();

  // 1分間のクールダウン
  const lastTime = chatCooldownMap.get(key) || 0;
  if (now - lastTime >= 60000) {
    chatCooldownMap.set(key, now);
    // チャット1発言あたり60秒分のアクティビティとして加算
    await processUserActivityTime(guildId, userId, 60, message.member, message.channel);
  }
}

/**
 * ユーザーのアクティビティ時間を加算し、1時間ごとにチケットを付与
 */
async function processUserActivityTime(guildId, userId, seconds, member, channel = null) {
  try {
    const res = await doumoriPool.query(
      `INSERT INTO doumori_users (guild_id, user_id, vc_total_seconds, vc_unclaimed_seconds)
       VALUES ($1, $2, $3, $3)
       ON CONFLICT (guild_id, user_id)
       DO UPDATE SET
         vc_total_seconds = doumori_users.vc_total_seconds + $3,
         vc_unclaimed_seconds = doumori_users.vc_unclaimed_seconds + $3
       RETURNING vc_unclaimed_seconds`,
      [guildId, userId, seconds]
    );

    let unclaimed = res.rows[0].vc_unclaimed_seconds || 0;
    const reqSec = CONFIG.TICKET_REQUIRED_SECONDS; // 3600秒 (1時間)

    if (unclaimed >= reqSec) {
      const ticketsToGive = Math.floor(unclaimed / reqSec);
      const remainSec = unclaimed % reqSec;

      // 未換算秒数を更新
      await doumoriPool.query(
        "UPDATE doumori_users SET vc_unclaimed_seconds = $1 WHERE guild_id = $2 AND user_id = $3",
        [remainSec, guildId, userId]
      );

      // チケット付与
      const totalTickets = await addTickets(guildId, userId, ticketsToGive);

      // お祝いメッセージ送信
      const msg = `🎉 **【浮上特典】** ${member ? member.displayName : `<@${userId}>`} さんがアクティビティ1時間を達成し、**図鑑チケット ×${ticketsToGive}** を獲得しました！（所持数: ${totalTickets}枚）`;
      
      if (channel) {
        await channel.send(msg).catch(() => {});
      } else if (member) {
        await member.send(msg).catch(() => {});
      }
    }
  } catch (err) {
    console.error("❌ アクティビティ時間処理エラー:", err);
  }
}

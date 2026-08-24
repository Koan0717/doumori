import { CONFIG } from "../config.js";
import { doumoriPool, addTickets, getDoumoriSettings } from "../database/db.js";

// VC参加開始時間のメモリキャッシュ Map<`${guildId}_${userId}`, timestamp>
const vcStateMap = new Map();
// チャットスパム防止用 Map<`${guildId}_${userId}`, timestamp>
const chatCooldownMap = new Map();
// ユーザーが直近で発言したチャンネルのメモリキャッシュ Map<`${guildId}_${userId}`, channelId>
const userLastChannelMap = new Map();

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
        await processUserActivityTime(guildId, userId, elapsedSeconds, newState.member || oldState.member);
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

  // 直近発言チャンネルを記憶
  if (message.channel && message.channel.id) {
    userLastChannelMap.set(key, message.channel.id);
  }

  // 設定からクールダウンと加算秒数を取得
  let cooldownMs = 60000;
  let addSeconds = 60;
  try {
    const settings = await getDoumoriSettings(guildId);
    if (settings.ticket_chat_cooldown_seconds !== undefined) {
      cooldownMs = Math.max(1, parseInt(settings.ticket_chat_cooldown_seconds, 10)) * 1000;
    }
    if (settings.ticket_chat_activity_seconds !== undefined) {
      addSeconds = Math.max(1, parseInt(settings.ticket_chat_activity_seconds, 10));
    }
  } catch (e) {}

  const lastTime = chatCooldownMap.get(key) || 0;
  if (now - lastTime >= cooldownMs) {
    chatCooldownMap.set(key, now);
    await processUserActivityTime(guildId, userId, addSeconds, message.member, message.channel);
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

    // 設定取得 (必要分数・通知ON/OFF・送信先設定)
    const settings = await getDoumoriSettings(guildId);
    const reqMinutes = settings.ticket_required_minutes || 60;
    const reqSec = reqMinutes * 60;

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

      // 1. 通知が無効 (OFF) の場合はメッセージ送信をスキップ
      const notifyEnabled = settings.ticket_notify_enabled !== false;
      if (!notifyEnabled) {
        return;
      }

      // 2. お祝いメッセージの作成
      const template =
        settings.ticket_notify_message ||
        "🎉 **【浮上特典】** {user} さんがアクティビティ1時間を達成し、**図鑑チケット ×{tickets}** を獲得しました！（所持数: {total}枚）";

      const userName = member ? member.displayName : `<@${userId}>`;
      const msg = template
        .replace(/{user}/g, userName)
        .replace(/{tickets}/g, String(ticketsToGive))
        .replace(/{total}/g, String(totalTickets));

      // 3. 送信先の振り分け ('dm' | 'channel' | 'last_channel')
      const destination = settings.ticket_notify_destination || "last_channel";
      const key = `${guildId}_${userId}`;

      // A. メンバーのDMへ送信
      if (destination === "dm") {
        if (member) {
          await member.send(msg).catch(() => {});
        }
      }
      // B. 特定の固定チャンネルへ送信
      else if (destination === "channel") {
        let sent = false;
        if (settings.ticket_notify_channel_id && member?.guild) {
          const targetChannel =
            member.guild.channels.cache.get(settings.ticket_notify_channel_id) ||
            (await member.guild.channels.fetch(settings.ticket_notify_channel_id).catch(() => null));

          if (targetChannel && targetChannel.isTextBased()) {
            await targetChannel.send(msg).catch(() => {});
            sent = true;
          }
        }
        // 固定チャンネルが見つからない場合は直近チャンネルまたはDMへフォールバック
        if (!sent) {
          if (channel && channel.isTextBased()) {
            await channel.send(msg).catch(() => {});
          } else if (member) {
            await member.send(msg).catch(() => {});
          }
        }
      }
      // C. 最後にメッセージを送信したチャンネル上（アクティブチャンネル）
      else {
        let targetChannel = channel;
        if (!targetChannel && member?.guild) {
          const lastChannelId = userLastChannelMap.get(key);
          if (lastChannelId) {
            targetChannel =
              member.guild.channels.cache.get(lastChannelId) ||
              (await member.guild.channels.fetch(lastChannelId).catch(() => null));
          }
        }

        if (targetChannel && targetChannel.isTextBased()) {
          await targetChannel.send(msg).catch(() => {});
        } else if (member) {
          await member.send(msg).catch(() => {});
        }
      }
    }
  } catch (err) {
    console.error("❌ アクティビティ時間処理エラー:", err);
  }
}

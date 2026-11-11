import dotenv from "dotenv";

dotenv.config();

/**
 * どう森の機能を動かすサーバー(Guild)。
 *
 * どう森BOTは ManyBot と同じトークンで動かすため、ManyBot が参加している全サーバーのイベントを受け取る。
 * ここに無いサーバーでは、浮上計測・通知・コマンド・ボタンを一切処理しない。
 *
 * 環境変数 DOUMORI_GUILD_ID にカンマ区切りで複数指定できる（未設定ならどう森サーバー）。
 */
export const DOUMORI_GUILD_IDS = (process.env.DOUMORI_GUILD_ID || "1526696870724894780")
  .split(",")
  .map((s) => s.trim())
  .filter((s) => /^\d+$/.test(s));

export function isDoumoriGuild(guildId) {
  return !!guildId && DOUMORI_GUILD_IDS.includes(String(guildId));
}

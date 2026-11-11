import { REST, Routes } from "discord.js";
import dotenv from "dotenv";
import { DOUMORI_GUILD_IDS } from "./guildScope.js";
import { command as fishCmd } from "../commands/fish.js";
import { command as bugCmd } from "../commands/bug.js";
import { command as shopCmd } from "../commands/shop.js";
import { command as fishbookCmd } from "../commands/fishbook.js";
import { command as bugbookCmd } from "../commands/bugbook.js";
import { command as exchangeCmd } from "../commands/exchange.js";
import { command as sellCmd } from "../commands/sell.js";
import { command as profileCmd } from "../commands/profile.js";
import { command as leaderboardCmd } from "../commands/leaderboard.js";
import { command as helpCmd } from "../commands/help.js";
import { command as panelCmd } from "../commands/panel.js";
import { command as milesCmd } from "../commands/miles.js";
import { command as missionCmd } from "../commands/mission.js";
import { command as missionReportCmd } from "../commands/missionReport.js";
import { command as diyCmd } from "../commands/diy.js";
import { command as rankupCmd } from "../commands/rankup.js";
import { command as cardCmd } from "../commands/card.js";
import { command as mileGrantCmd } from "../commands/mileGrant.js";
import { command as mileRevokeCmd } from "../commands/mileRevoke.js";
import { command as mileBalanceCmd } from "../commands/mileBalance.js";
import { command as settingsPanelCmd } from "../commands/settingsPanel.js";
import { command as ticketGrantCmd } from "../commands/ticketGrant.js";
import { command as ticketRevokeCmd } from "../commands/ticketRevoke.js";

dotenv.config();

const commands = [
  fishCmd.data.toJSON(),
  bugCmd.data.toJSON(),
  shopCmd.data.toJSON(),
  fishbookCmd.data.toJSON(),
  bugbookCmd.data.toJSON(),
  exchangeCmd.data.toJSON(),
  sellCmd.data.toJSON(),
  profileCmd.data.toJSON(),
  leaderboardCmd.data.toJSON(),
  helpCmd.data.toJSON(),
  panelCmd.data.toJSON(),
  milesCmd.data.toJSON(),
  missionCmd.data.toJSON(),
  missionReportCmd.data.toJSON(),
  diyCmd.data.toJSON(),
  rankupCmd.data.toJSON(),
  cardCmd.data.toJSON(),
  mileGrantCmd.data.toJSON(),
  mileRevokeCmd.data.toJSON(),
  mileBalanceCmd.data.toJSON(),
  settingsPanelCmd.data.toJSON(),
  ticketGrantCmd.data.toJSON(),
  ticketRevokeCmd.data.toJSON(),
];

/**
 * どう森のスラッシュコマンドを、どう森サーバーにだけ登録する。
 *
 * ManyBot と同じアプリ（トークン）で動かすため、コマンドの「一括上書き(PUT)」は使わない。
 * 一括上書きすると ManyBot のコマンドまで消えてしまうので、どう森のコマンドを1つずつ
 * 追加・更新(POST)する。既に同じ内容で登録済みのものは送らない（1日の作成回数制限の節約）。
 */
export async function deployCommands({ quiet = false } = {}) {
  const token = process.env.DISCORD_BOT_TOKEN;
  const clientId = process.env.DISCORD_CLIENT_ID;

  if (!token || !clientId) {
    console.error("❌ DISCORD_BOT_TOKEN または DISCORD_CLIENT_ID が設定されていません。");
    return;
  }

  const rest = new REST({ version: "10" }).setToken(token);
  const doumoriNames = new Set(commands.map((c) => c.name));

  // ① 以前グローバル登録していた どう森コマンドが残っていれば、それだけを個別に削除する
  try {
    const globalExisting = await rest.get(Routes.applicationCommands(clientId));
    for (const c of Array.isArray(globalExisting) ? globalExisting : []) {
      if (doumoriNames.has(c.name)) {
        await rest.delete(Routes.applicationCommand(clientId, c.id));
        console.log(`🧹 グローバルに残っていた /${c.name} を削除しました。`);
      }
    }
  } catch (error) {
    console.error("❌ グローバルコマンドの確認エラー:", error?.message || error);
  }

  // ② どう森サーバーに、無いもの・内容が変わったものだけ登録する
  for (const guildId of DOUMORI_GUILD_IDS) {
    try {
      const existing = await rest.get(Routes.applicationGuildCommands(clientId, guildId));
      const byName = new Map((Array.isArray(existing) ? existing : []).map((c) => [c.name, c]));
      let updated = 0;
      for (const cmd of commands) {
        const cur = byName.get(cmd.name);
        if (cur && sameCommand(cur, cmd)) continue;
        await rest.post(Routes.applicationGuildCommands(clientId, guildId), { body: cmd });
        updated++;
      }
      if (updated > 0 || !quiet) {
        console.log(`✅ どう森サーバー(${guildId}) のコマンド: ${commands.length}個中 ${updated}個を登録・更新しました。`);
      }
    } catch (error) {
      console.error(`❌ スラッシュコマンド登録エラー (guild ${guildId}):`, error?.message || error);
    }
  }
}

/** 登録済みコマンドと同じ内容か（説明とオプションで比較） */
function sameCommand(current, wanted) {
  const norm = (opts) =>
    JSON.stringify(
      (opts || []).map((o) => ({
        type: o.type,
        name: o.name,
        description: o.description,
        required: !!o.required,
        choices: (o.choices || []).map((c) => [c.name, c.value]),
        options: o.options ? JSON.parse(norm(o.options)) : undefined,
        min_value: o.min_value,
        max_value: o.max_value,
      }))
    );
  return (
    current.description === wanted.description &&
    String(current.default_member_permissions ?? null) === String(wanted.default_member_permissions ?? null) &&
    norm(current.options) === norm(wanted.options)
  );
}

// 直接実行された場合 (npm run register)
if (process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, "/"))) {
  deployCommands();
}

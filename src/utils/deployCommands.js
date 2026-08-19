import { REST, Routes } from "discord.js";
import dotenv from "dotenv";
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

const token = process.env.DISCORD_BOT_TOKEN;
const clientId = process.env.DISCORD_CLIENT_ID;

if (!token || !clientId) {
  console.error("❌ DISCORD_BOT_TOKEN または DISCORD_CLIENT_ID が設定されていません。");
  process.exit(1);
}

const rest = new REST({ version: "10" }).setToken(token);

export async function deployCommands() {
  try {
    console.log(`🚀 ${commands.length} 個のスラッシュコマンドをデプロイ中...`);
    // 既存の Primary Entry Point (type: 4) コマンド等を自動検知して保持
    const existing = await rest.get(Routes.applicationCommands(clientId)).catch(() => []);
    const entryPoints = Array.isArray(existing) ? existing.filter((c) => c.type === 4) : [];

    const finalCommands = [...commands, ...entryPoints];
    await rest.put(Routes.applicationCommands(clientId), { body: finalCommands });
    console.log("✅ スラッシュコマンドのデプロイが完了しました！");
  } catch (error) {
    console.error("❌ スラッシュコマンドデプロイエラー:", error);
  }
}

// 直接実行された場合
if (process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, "/"))) {
  deployCommands();
}

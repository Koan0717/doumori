import { Client, GatewayIntentBits, Collection, Events } from "discord.js";
import express from "express";
import dotenv from "dotenv";

import { initDatabase } from "./database/db.js";
import { deployCommands } from "./utils/deployCommands.js";
import { DOUMORI_GUILD_IDS, isDoumoriGuild } from "./utils/guildScope.js";
import { handleVoiceStateUpdate, handleMessageCreate } from "./services/ticketTracker.js";

import { command as fishCmd } from "./commands/fish.js";
import { command as bugCmd } from "./commands/bug.js";
import { command as shopCmd } from "./commands/shop.js";
import { command as fishbookCmd } from "./commands/fishbook.js";
import { command as bugbookCmd } from "./commands/bugbook.js";
import { command as exchangeCmd } from "./commands/exchange.js";
import { command as sellCmd } from "./commands/sell.js";
import { command as profileCmd } from "./commands/profile.js";
import { command as leaderboardCmd } from "./commands/leaderboard.js";
import { command as helpCmd } from "./commands/help.js";
import { command as panelCmd } from "./commands/panel.js";
import { command as milesCmd } from "./commands/miles.js";
import { command as missionCmd } from "./commands/mission.js";
import { command as missionReportCmd, handleMissionApproval } from "./commands/missionReport.js";
import { command as diyCmd } from "./commands/diy.js";
import { command as rankupCmd } from "./commands/rankup.js";
import { command as cardCmd } from "./commands/card.js";
import { command as mileGrantCmd } from "./commands/mileGrant.js";
import { command as mileRevokeCmd } from "./commands/mileRevoke.js";
import { command as mileBalanceCmd } from "./commands/mileBalance.js";
import { command as settingsPanelCmd } from "./commands/settingsPanel.js";
import { command as ticketGrantCmd } from "./commands/ticketGrant.js";
import { command as ticketRevokeCmd } from "./commands/ticketRevoke.js";

dotenv.config();

// 1. ヘルスチェック用Webサーバー (PORT が設定されている場合のみ起動)
//    Render などのPaaSでは PORT が自動設定されるので起動する。
//    VPS + pm2 運用では不要なので PORT を設定しなければ起動しない（他Botとのポート衝突を防ぐ）。
const PORT = process.env.PORT;

if (PORT) {
  const app = express();

  app.get("/", (req, res) => {
    res.send("🍃 どうぶつの森林 Bot is running!");
  });

  app
    .listen(PORT, () => {
      console.log(`🌐 ヘルスチェック用サーバーがポート ${PORT} で起動しました。`);
    })
    .on("error", (err) => {
      console.error(`⚠️ ヘルスチェック用サーバーを起動できませんでした (ポート ${PORT}):`, err.message);
    });
}

// 2. Discord Client インスタンス化
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

// コマンドコレクションの作成
client.commands = new Collection();
const commandList = [
  fishCmd,
  bugCmd,
  shopCmd,
  fishbookCmd,
  bugbookCmd,
  exchangeCmd,
  sellCmd,
  profileCmd,
  leaderboardCmd,
  helpCmd,
  panelCmd,
  milesCmd,
  missionCmd,
  missionReportCmd,
  diyCmd,
  rankupCmd,
  cardCmd,
  mileGrantCmd,
  mileRevokeCmd,
  mileBalanceCmd,
  settingsPanelCmd,
  ticketGrantCmd,
  ticketRevokeCmd,
];

commandList.forEach((cmd) => {
  client.commands.set(cmd.data.name, cmd);
});

// ボタンID ➔ コマンドのマッピング
const buttonCommandMap = {
  btn_fish: fishCmd,
  btn_bug: bugCmd,
  btn_shop: shopCmd,
  btn_fishbook: fishbookCmd,
  btn_bugbook: bugbookCmd,
  btn_exchange: exchangeCmd,
  btn_sell: sellCmd,
  btn_card: cardCmd,
  btn_profile: profileCmd,
  btn_leaderboard: leaderboardCmd,
  btn_help: helpCmd,
  btn_miles: milesCmd,
  btn_mission: missionCmd,
  btn_diy: diyCmd,
  btn_rankup: rankupCmd,
};

// 3. イベントハンドラー
client.on(Events.ClientReady, async () => {
  console.log(`🟢 Botがログインしました: ${client.user.tag}`);
  
  console.log(`🍃 どう森の機能を動かすサーバー: ${DOUMORI_GUILD_IDS.join(", ")}`);

  // スラッシュコマンド自動登録
  if (process.env.DISCORD_CLIENT_ID && process.env.DISCORD_BOT_TOKEN) {
    await deployCommands().catch((err) => console.error("❌ Command deploy error:", err));

    // ManyBot と同じアプリなので、ManyBot 側の同期でどう森のコマンドが消えることがある。
    // 定期的に確認して、消えていたら登録し直す。
    setInterval(() => {
      deployCommands({ quiet: true }).catch((err) => console.error("❌ Command re-check error:", err));
    }, 10 * 60 * 1000);
  }
});

// インタラクション受付 (スラッシュコマンド ＆ パネルボタン)
client.on("interactionCreate", async (interaction) => {
  // どう森サーバー以外（ManyBot だけが使うサーバー）のインタラクションは ManyBot に任せる
  if (!isDoumoriGuild(interaction.guildId)) return;

  // A. スラッシュコマンド実行
  if (interaction.isChatInputCommand()) {
    const cmd = client.commands.get(interaction.commandName);
    if (!cmd) return;

    try {
      if (!interaction.deferred && !interaction.replied) {
        const isEphemeral = cmd.ephemeral !== undefined ? !!cmd.ephemeral : false;
        await interaction.deferReply({ ephemeral: isEphemeral }).catch(() => {});
      }
      await cmd.execute(interaction);
    } catch (error) {
      console.error(`❌ コマンド実行エラー [/${interaction.commandName}]:`, error);
      const replyPayload = {
        content: `❌ コマンドの処理中にエラーが発生しました: \`${error.message || error}\``,
        ephemeral: true,
      };
      if (interaction.deferred || interaction.replied) {
        await interaction.followUp(replyPayload).catch(() => {});
      } else {
        await interaction.reply(replyPayload).catch(() => {});
      }
    }
  }
  // B. パネルボタンクリックの実行 (ephemeral: true で自分だけに表示)
  else if (interaction.isButton() && interaction.customId.startsWith("btn_")) {
    const targetCmd = buttonCommandMap[interaction.customId];
    if (!targetCmd) return;

    try {
      if (!interaction.deferred && !interaction.replied) {
        await interaction.deferReply({ ephemeral: true }).catch(() => {});
      }
      await targetCmd.execute(interaction);
    } catch (error) {
      console.error(`❌ パネルボタン実行エラー [${interaction.customId}]:`, error);
      const replyPayload = {
        content: `❌ 操作処理中にエラーが発生しました: \`${error.message || error}\``,
        ephemeral: true,
      };
      if (interaction.deferred || interaction.replied) {
        await interaction.followUp(replyPayload).catch(() => {});
      } else {
        await interaction.reply(replyPayload).catch(() => {});
      }
    }
  }
  // C. ミッション承認ボタンクリックの実行 (approve_${userId}_${dateKey}_${slot})
  else if (interaction.isButton() && interaction.customId.startsWith("approve_")) {
    await handleMissionApproval(interaction);
  }
  // D. 既に承認済みのボタンが押された場合のフォールバック案内
  else if (interaction.isButton() && (interaction.customId === "approved" || interaction.customId.startsWith("approved_"))) {
    await interaction.reply({ content: "ℹ️ このミッション報告はすでに承認済みです。", ephemeral: true }).catch(() => {});
  }
});

// VC監視 (チケット付与)
client.on("voiceStateUpdate", async (oldState, newState) => {
  if (!isDoumoriGuild(newState.guild?.id ?? oldState.guild?.id)) return;
  await handleVoiceStateUpdate(oldState, newState).catch((err) => console.error("❌ VC tracker error:", err));
});

// チャット監視 (チケット付与)
client.on("messageCreate", async (message) => {
  if (!isDoumoriGuild(message.guildId)) return;
  await handleMessageCreate(message).catch((err) => console.error("❌ Chat tracker error:", err));
});

// プロセスエラーハンドリング (Botのクラッシュ・オフライン化防止)
process.on("unhandledRejection", (reason, promise) => {
  console.error("❌ 未処理のPromise拒否 (unhandledRejection):", reason);
});

process.on("uncaughtException", (error) => {
  console.error("❌ 未処理の例外 (uncaughtException):", error);
});

// 4. メイン起動
async function startBot() {
  // DB初期化
  if (process.env.DATABASE_URL || process.env.DOUMORI_DATABASE_URL) {
    await initDatabase().catch((err) => console.error("❌ DB Init error:", err));
  }

  const token = process.env.DISCORD_BOT_TOKEN;
  if (!token) {
    console.error("❌ ERROR: DISCORD_BOT_TOKEN が環境変数に設定されていません。");
    return;
  }

  await client.login(token).catch((err) => console.error("❌ Discord Login Error:", err));
}

startBot();

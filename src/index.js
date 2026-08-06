import { Client, GatewayIntentBits, Collection } from "discord.js";
import express from "express";
import dotenv from "dotenv";

import { initDatabase } from "./database/db.js";
import { deployCommands } from "./utils/deployCommands.js";
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

dotenv.config();

// 1. Render用ダミーWebサーバー (24時間ヘルスチェックパス用)
const app = express();
const PORT = process.env.PORT || 8080;

app.get("/", (req, res) => {
  res.send("🍃 あつまれ どうぶつの森 Bot is running 24/7 on Render!");
});

app.listen(PORT, () => {
  console.log(`🌐 Renderヘルスチェック用サーバーがポート ${PORT} で起動しました。`);
});

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
];

commandList.forEach((cmd) => {
  client.commands.set(cmd.data.name, cmd);
});

// 3. イベントハンドラー
client.once("ready", async () => {
  console.log(`🟢 Botがログインしました: ${client.user.tag}`);
  
  // スラッシュコマンド自動登録
  if (process.env.DISCORD_CLIENT_ID && process.env.DISCORD_BOT_TOKEN) {
    await deployCommands();
  }
});

// スラッシュコマンド実行の受付
client.on("interactionCreate", async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  const cmd = client.commands.get(interaction.commandName);
  if (!cmd) return;

  try {
    await cmd.execute(interaction);
  } catch (error) {
    console.error(`❌ コマンド実行エラー [/${interaction.commandName}]:`, error);
    const replyPayload = {
      content: "コマンドの実行中にエラーが発生しました。",
      ephemeral: true,
    };
    if (interaction.replied || interaction.deferred) {
      await interaction.followup(replyPayload).catch(() => {});
    } else {
      await interaction.reply(replyPayload).catch(() => {});
    }
  }
});

// VC監視 (チケット付与)
client.on("voiceStateUpdate", async (oldState, newState) => {
  await handleVoiceStateUpdate(oldState, newState);
});

// チャット監視 (チケット付与)
client.on("messageCreate", async (message) => {
  await handleMessageCreate(message);
});

// 4. メイン起動
async function startBot() {
  // DB初期化
  if (process.env.DATABASE_URL) {
    await initDatabase();
  }

  const token = process.env.DISCORD_BOT_TOKEN;
  if (!token) {
    console.error("❌ ERROR: DISCORD_BOT_TOKEN が環境変数に設定されていません。");
    return;
  }

  await client.login(token);
}

startBot();

import {
  SlashCommandBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  PermissionFlagsBits,
} from "discord.js";
import { createBaseEmbed } from "../utils/embedBuilder.js";

export const command = {
  data: new SlashCommandBuilder()
    .setName("パネル設置")
    .setDescription("このチャンネルに全機能がボタン操作できる【操作パネル】を設置します🎮")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),

  async execute(interaction) {
    if (!interaction.deferred && !interaction.replied) {
      await interaction.deferReply({ ephemeral: true }).catch(() => {});
    }

    const embed = createBaseEmbed(
      "🍃 どうぶつの森林 - 総合操作パネル",
      "下のボタンを押すだけで、釣りや虫捕り、ショップ、図鑑確認などの全機能が手軽に使えます！",
      "#2ECC71"
    );

    embed.addFields(
      {
        name: "🎣 🦋 採集＆ショップ",
        value: "・**【魚を釣る】**: つりざおを消費して釣る\n" +
               "・**【虫を捕まえる】**: 虫取り網を消費して捕まえる\n" +
               "・**【タヌキショップ】**: チケットで道具を交換",
        inline: false,
      },
      {
        name: "📖 🔀 💰 図鑑・両替・売却",
        value: "・**【魚図鑑】/【虫図鑑】**: 各図鑑と完成率を確認\n" +
               "・**【両替】**: 所持通貨 ⇄ 図鑑チケット の相互交換\n" +
               "・**【ダブり売却】**: 重複した生き物をまとめて換金",
        inline: false,
      },
      {
        name: "📊 🏆 ❓ プロフィール・ランキング",
        value: "・**【プロフィール】**: 自分の持ち物や完成率を確認\n" +
               "・**【ランキング】**: サーバー内完成率 Top 10\n" +
               "・**【ヘルプ】**: 遊び方ガイドパネルを表示",
        inline: false,
      }
    );

    // 行1: 採集 & ショップ
    const row1 = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId("btn_fish").setLabel("🎣 魚を釣る").setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId("btn_bug").setLabel("🦋 虫を捕まえる").setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId("btn_shop").setLabel("🏪 タヌキショップ").setStyle(ButtonStyle.Secondary)
    );

    // 行2: 図鑑・両替・売却
    const row2 = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId("btn_fishbook").setLabel("📖 魚図鑑").setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId("btn_bugbook").setLabel("📖 虫図鑑").setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId("btn_exchange").setLabel("🔀 通貨両替").setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId("btn_sell").setLabel("💰 ダブり売却").setStyle(ButtonStyle.Danger)
    );

    // 行3: プロフィール・ランキング・ヘルプ
    const row3 = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId("btn_profile").setLabel("📊 プロフィール").setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId("btn_leaderboard").setLabel("🏆 ランキング").setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId("btn_help").setLabel("❓ ヘルプ").setStyle(ButtonStyle.Secondary)
    );

    // チャンネルへパネルを送信
    await interaction.channel.send({
      embeds: [embed],
      components: [row1, row2, row3],
    });

    await interaction.followUp({
      content: "✅ チャンネルに【操作パネル】を設置しました！",
      ephemeral: true,
    });
  },
};

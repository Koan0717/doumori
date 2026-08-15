import {
  SlashCommandBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  PermissionFlagsBits,
} from "discord.js";
import { createBaseEmbed } from "../utils/embedBuilder.js";

export const command = {
  ephemeral: true,
  data: new SlashCommandBuilder()
    .setName("パネル設置")
    .setDescription("このチャンネルに全機能がボタン操作できる【総合操作パネル】を設置します🎮")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),

  async execute(interaction) {
    if (!interaction.deferred && !interaction.replied) {
      await interaction.deferReply({ ephemeral: true }).catch(() => {});
    }

    const embed = createBaseEmbed(
      "🍃 どうぶつの森林 - 総合操作パネル",
      "下のボタンを押すだけで、採集・図鑑・マイルポイント・ランクアップなどの全機能が手軽に使えます！",
      "#2ECC71"
    );

    embed.addFields(
      {
        name: "🎣 🦋 採集＆ショップ",
        value: "・**【魚を釣る】**: つりざおを消費して釣る\n" +
               "・**【虫を捕まえる】**: 虫取り網を消費して捕まえる\n" +
               "・**【タヌキショップ】**: マイルでチケット購入＆道具交換",
        inline: false,
      },
      {
        name: "🌟 📅 🛠️ ⬆️ マイル＆階級ステップアップ",
        value: "・**【マイル確認】**: 現在のマイルと階級状態を確認\n" +
               "・**【ミッション】**: 今日の階級別デイリーミッションを確認\n" +
               "・**【DIY作業台】**: 週1回のイベント開催告知でマイル獲得\n" +
               "・**【階級アップ】**: マイルを消費して次の階級に昇格！",
        inline: false,
      },
      {
        name: "📖 🔀 💰 図鑑・両替・売却",
        value: "・**【魚図鑑】/【虫図鑑】**: 各図鑑と完成率を確認\n" +
               "・**【両替】**: マイル/ゼニー ⇄ 図鑑チケット の相互両替\n" +
               "・**【ダブり売却】**: 重複した生き物をまとめてゼニーに換金",
        inline: false,
      },
      {
        name: "🃏 📊 🏆 ❓ 住民カード・プロフ・ランキング・ヘルプ",
        value: "・**【住民カード】**: 階級・ミッション達成回数・ポイント証を表示\n" +
               "・**【プロフィール】**: 自分の持ち物や図鑑完成率を確認\n" +
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

    // 行2: マイル & ランクアップ
    const row2 = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId("btn_miles").setLabel("🌟 マイル確認").setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId("btn_mission").setLabel("📅 ミッション").setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId("btn_diy").setLabel("🛠️ DIY作業台").setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId("btn_rankup").setLabel("⬆️ 階級アップ").setStyle(ButtonStyle.Danger)
    );

    // 行3: 図鑑・両替・売却
    const row3 = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId("btn_fishbook").setLabel("📖 魚図鑑").setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId("btn_bugbook").setLabel("📖 虫図鑑").setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId("btn_exchange").setLabel("🔀 両替").setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId("btn_sell").setLabel("💰 ダブり売却 (ゼニー)").setStyle(ButtonStyle.Danger)
    );

    // 行4: 住民カード・プロフィール・ランキング・ヘルプ
    const row4 = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId("btn_card").setLabel("🃏 住民カード").setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId("btn_profile").setLabel("📊 プロフィール").setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId("btn_leaderboard").setLabel("🏆 ランキング").setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId("btn_help").setLabel("❓ ヘルプ").setStyle(ButtonStyle.Secondary)
    );

    // チャンネルへパネルを送信
    await interaction.channel.send({
      embeds: [embed],
      components: [row1, row2, row3, row4],
    });

    await interaction.followUp({
      content: "✅ チャンネルに【総合操作パネル】を設置しました！",
      ephemeral: true,
    });
  },
};

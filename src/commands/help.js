import { SlashCommandBuilder } from "discord.js";
import { createBaseEmbed } from "../utils/embedBuilder.js";

export const command = {
  data: new SlashCommandBuilder()
    .setName("ヘルプ")
    .setDescription("どうぶつの森林 Bot のコマンド一覧と遊び方のヘルプパネルを表示します📖"),

  async execute(interaction) {
    if (!interaction.deferred && !interaction.replied) {
      await interaction.deferReply().catch(() => {});
    }

    const embed = createBaseEmbed(
      "📖 どうぶつの森林 Bot - ヘルプ＆ガイドパネル",
      "Discordサーバーで浮上してチケットを集め、魚や虫を捕まえて図鑑を完成させよう！",
      "#2ECC71"
    );

    embed.addFields(
      {
        name: "🔄 ゲームの基本フロー",
        value: "① **VCやチャットで浮上** ➔ 1時間ごとに「図鑑チケット ×1」を獲得！\n" +
               "② **`/ショップ`** ➔ チケットを「つりざお」や「虫取り網」に交換\n" +
               "③ **`/釣り` / `/虫捕り`** ➔ 生き物を採集（0.5%で✨金色個体が出現！）\n" +
               "④ **図鑑コンプ** ➔ 「金のつりざお」「金の虫取り網」の限定ゴールドロールを獲得！",
        inline: false,
      },
      {
        name: "🎣 🦋 採集コマンド",
        value: "・`/釣り` — つりざおを1つ消費して魚を釣る\n" +
               "・`/虫捕り` — 虫取り網を1つ消費して虫を捕まえる",
        inline: false,
      },
      {
        name: "🏪 🔀 💰 ショップ・両替・売却",
        value: "・`/ショップ` — チケットを使って道具を交換（ボタン操作）\n" +
               "・`/両替` — 所持通貨 ⇄ 図鑑チケット の相互両替\n" +
               "・`/売却` — 重複した生き物（2匹目以降）を売却して通貨を獲得",
        inline: false,
      },
      {
        name: "📖 📊 🏆 図鑑・プロフ・ランキング・パネル",
        value: "・`/魚図鑑` — 魚図鑑（全20種）と完成率の確認\n" +
               "・`/虫図鑑` — 虫図鑑（全20種）と完成率の確認\n" +
               "・`/プロフィール` — 自分の所持チケット・通貨・完成率プロフ確認\n" +
               "・`/ランキング` — サーバー内の図鑑完成率ランキング Top 10\n" +
               "・`/パネル設置` — チャンネルに全機能ボタン付き【操作パネル】を設置",
        inline: false,
      },
      {
        name: "🏅 コンプリート特典ロール",
        value: "・魚図鑑 100% 達成 ➔ **「🎣 金のつりざお」** ロール付与\n" +
               "・虫図鑑 100% 達成 ➔ **「🦋 金の虫取り網」** ロール付与",
        inline: false,
      }
    );

    await interaction.followUp({ embeds: [embed] });
  },
};

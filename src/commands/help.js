import { SlashCommandBuilder } from "discord.js";
import { createBaseEmbed } from "../utils/embedBuilder.js";

export const command = {
  data: new SlashCommandBuilder()
    .setName("ヘルプ")
    .setDescription("どうぶつの森林 Bot のコマンド一覧と遊び方のヘルプパネルを表示します📖"),

  async execute(interaction) {
    if (!interaction.deferred && !interaction.replied) {
      await interaction.deferReply({ ephemeral: interaction.isButton() }).catch(() => {});
    }

    const embed = createBaseEmbed(
      "📖 どうぶつの森林 Bot - ヘルプ＆ガイドパネル",
      "Discordサーバーで浮上してチケットを集め、魚や虫を捕まえて図鑑を完成させよう！",
      "#2ECC71"
    );

    embed.addFields(
      {
        name: "🔄 ゲームの基本フロー",
        value: "① **VCやチャットで浮上 / ミッション達成** ➔ チケットや「マイルポイント」を獲得！\n" +
               "② **`/ショップ` / `/両替`** ➔ マイルで「図鑑チケット」を購入し、「つりざお」や「虫取り網」に交換\n" +
               "③ **`/釣り` / `/虫捕り`** ➔ 生き物を採集（0.5%で✨金色個体が出現！）\n" +
               "④ **`/売却`** ➔ ダブった生き物を売却して鯖内通貨「ゼニー (🪙)」を獲得！\n" +
               "⑤ **図鑑コンプ** ➔ 「金のつりざお」「金の虫取り網」の限定ゴールドロールを獲得！",
        inline: false,
      },
      {
        name: "🎣 🦋 採集＆ショップ・売却",
        value: "・`/釣り` — つりざおを1つ消費して魚を釣る\n" +
               "・`/虫捕り` — 虫取り網を1つ消費して虫を捕まえる\n" +
               "・`/ショップ` — マイルでチケット購入 ＆ 道具交換（ボタン操作）\n" +
               "・`/両替` — マイル/ゼニー ⇄ 図鑑チケット の相互両替\n" +
               "・`/売却` — 重複した生き物を売却してゼニーを獲得",
        inline: false,
      },
      {
        name: "🃏 🌟 📅 ⬆️ 住民カード・マイル・階級",
        value: "・`/住民カード` — 階級・ミッション達成回数・ポイント等の住民証表示\n" +
               "・`/マイル` / `/マイル残高` — 所持マイルと階級ステータス確認\n" +
               "・`/デイリーミッション` — 本日の階級別ミッション確認\n" +
               "・`/ミッション報告` — ミッションスクショを報告（スタッフ承認で自動付与＆カード更新）\n" +
               "・`/ランクアップ` — マイルを消費して次の階級へ昇格",
        inline: false,
      },
      {
        name: "📖 📊 🏆 🛠️ 図鑑・プロフ・パネル・管理",
        value: "・`/魚図鑑` / `/虫図鑑` — 図鑑と完成率の確認\n" +
               "・`/プロフィール` — 所持マイル・チケット・ゼニー・道具・完成率確認\n" +
               "・`/ランキング` — サーバー内の図鑑完成率ランキング Top 10\n" +
               "・`/パネル設置` — ボタン操作できる【総合操作パネル】を設置\n" +
               "・`/マイル付与` / `/マイル没収` — 【管理者専用】マイル手動付与・減額",
        inline: false,
      }
    );

    await interaction.followUp({ embeds: [embed] });
  },
};

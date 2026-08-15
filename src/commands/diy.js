import { SlashCommandBuilder } from "discord.js";
import { CONFIG } from "../config.js";
import { getUserMiles, addMiles, updateLastDiyAt } from "../database/db.js";
import { createBaseEmbed } from "../utils/embedBuilder.js";

export const command = {
  ephemeral: false,
  data: new SlashCommandBuilder()
    .setName("diy作業台")
    .setDescription("週1回、個人的なイベントを開催告知してマイルを獲得します🛠️")
    .addStringOption((option) =>
      option
        .setName("title")
        .setDescription("開催するイベントのタイトル")
        .setRequired(true)
    )
    .addStringOption((option) =>
      option
        .setName("details")
        .setDescription("イベントの開催日時・ルール・内容")
        .setRequired(true)
    ),

  async execute(interaction) {
    if (!interaction.deferred && !interaction.replied) {
      await interaction.deferReply({ ephemeral: false }).catch(() => {});
    }

    const guildId = interaction.guild.id;
    const userId = interaction.user.id;
    const title = interaction.options.getString("title");
    const details = interaction.options.getString("details");

    const userMiles = await getUserMiles(guildId, userId);

    // 週1回 (7日間 = 604,800,000 ms) クールダウン判定
    if (userMiles.last_diy_at) {
      const lastTime = new Date(userMiles.last_diy_at).getTime();
      const now = Date.now();
      const diffDays = (now - lastTime) / (1000 * 3600 * 24);

      if (diffDays < CONFIG.DIY_COOLDOWN_DAYS) {
        const remainDays = Math.ceil(CONFIG.DIY_COOLDOWN_DAYS - diffDays);
        const cooldownEmbed = createBaseEmbed(
          "⚠️ クールダウン中",
          `DIY作業台でのイベント開催は **1週間に1回まで** です。\n（あと **${remainDays} 日** 後に再度開催できます）`,
          "#E74C3C"
        );
        await interaction.followUp({ embeds: [cooldownEmbed], ephemeral: true });
        return;
      }
    }

    // 最終実行日時を更新 ＆ マイル付与
    await updateLastDiyAt(guildId, userId);
    const newMiles = await addMiles(guildId, userId, CONFIG.DIY_EVENT_REWARD_MILES);

    const embed = createBaseEmbed(
      `🛠️ DIY作業台 - 住民主催イベント告知！`,
      `主催者: ${interaction.user.toString()}\n\n**【${title}】**\n\n*${details}*`,
      "#9B59B6"
    );

    embed.addFields({
      name: "🎁 主催者特典",
      value: `イベント開催につき **+${CONFIG.DIY_EVENT_REWARD_MILES}** マイル獲得！ (現在の所持: **${newMiles}** マイル)`,
      inline: false,
    });

    await interaction.followUp({
      content: "📢 **新しいイベントがDIY作業台から開催されました！**",
      embeds: [embed],
    });
  },
};

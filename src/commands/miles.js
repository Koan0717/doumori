import { SlashCommandBuilder } from "discord.js";
import { CONFIG } from "../config.js";
import { getUserMiles } from "../database/db.js";
import { createBaseEmbed, createProgressBar } from "../utils/embedBuilder.js";

export const command = {
  data: new SlashCommandBuilder()
    .setName("マイル")
    .setDescription("現在の所持マイルポイントとランク昇格状況を確認します🌟"),

  async execute(interaction) {
    if (!interaction.deferred && !interaction.replied) {
      await interaction.deferReply({ ephemeral: interaction.isButton() }).catch(() => {});
    }

    const guildId = interaction.guild.id;
    const userId = interaction.user.id;

    const userMiles = await getUserMiles(guildId, userId);
    const currentRank = CONFIG.RANKS.find((r) => r.level === userMiles.rank_level) || CONFIG.RANKS[0];
    const nextRank = CONFIG.RANKS.find((r) => r.level === userMiles.rank_level + 1);

    const embed = createBaseEmbed(
      "🌟 マイルポイント & ランクステータス",
      `ステップアップサーバーの現在の実績データです。`,
      currentRank.color
    );

    embed.addFields(
      { name: "🏷️ 現在のランク", value: `**${currentRank.name}**`, inline: true },
      { name: "🌟 所持マイルポイント", value: `**${userMiles.miles}** マイル`, inline: true }
    );

    if (nextRank) {
      const needed = nextRank.requiredMiles - userMiles.miles;
      const progress = createProgressBar(
        Math.min(userMiles.miles, nextRank.requiredMiles),
        nextRank.requiredMiles
      );

      embed.addFields(
        { name: `⬆️ 次のランク: ${nextRank.name}`, value: `必要マイル: **${nextRank.requiredMiles}** マイル (あと **${Math.max(0, needed)}** マイル)`, inline: false },
        { name: "昇格進捗", value: progress, inline: false }
      );
    } else {
      embed.addFields({
        name: "🏆 ランクステータス",
        value: "🎉 **最高ランク（マスター）に到達しています！おめでとうございます！**",
        inline: false,
      });
    }

    await interaction.followUp({ embeds: [embed] });
  },
};

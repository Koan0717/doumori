import { SlashCommandBuilder } from "discord.js";
import { resolveRankFromMember } from "../config.js";
import { getUserMiles, getDoumoriRanksMaster } from "../database/db.js";
import { createBaseEmbed, createProgressBar } from "../utils/embedBuilder.js";

export const command = {
  ephemeral: true,
  data: new SlashCommandBuilder()
    .setName("マイル")
    .setDescription("現在の所持マイルポイントと階級昇格状況を確認します🌟"),

  async execute(interaction) {
    if (!interaction.deferred && !interaction.replied) {
      await interaction.deferReply({ ephemeral: true }).catch(() => {});
    }

    const guildId = interaction.guild.id;
    const userId = interaction.user.id;

    const ranks = await getDoumoriRanksMaster();
    const userMiles = await getUserMiles(guildId, userId);
    const currentRank = resolveRankFromMember(interaction.member, userMiles.rank_level);
    const nextRank = ranks.find((r) => r.level === currentRank.level + 1);

    const embed = createBaseEmbed(
      "🌟 マイルポイント & 階級ステータス",
      `ステップアップサーバーの現在の実績データです。`,
      currentRank.color
    );

    embed.addFields(
      { name: "🏷️ 現在の階級", value: `**${currentRank.name}**`, inline: true },
      { name: "🌟 所持マイルポイント", value: `**${userMiles.miles.toLocaleString()}** pt`, inline: true }
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

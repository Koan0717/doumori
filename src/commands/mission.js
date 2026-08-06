import { SlashCommandBuilder } from "discord.js";
import { getUserMiles, getOrCreateDailyMission } from "../database/db.js";
import { createBaseEmbed } from "../utils/embedBuilder.js";

export const command = {
  data: new SlashCommandBuilder()
    .setName("デイリーミッション")
    .setDescription("本日のランクに応じたデイリーミッションを確認します📅"),

  async execute(interaction) {
    if (!interaction.deferred && !interaction.replied) {
      await interaction.deferReply({ ephemeral: interaction.isButton() }).catch(() => {});
    }

    const guildId = interaction.guild.id;
    const userId = interaction.user.id;

    const userMiles = await getUserMiles(guildId, userId);
    const mission = await getOrCreateDailyMission(guildId, userId, userMiles.rank_level);

    let statusText = "⏳ **未達成 (未報告)**";
    let colorStr = "#F1C40F";

    if (mission.status === "submitted") {
      statusText = "📨 **報告済み (運営の確認待ち)**";
      colorStr = "#3498DB";
    } else if (mission.status === "approved") {
      statusText = "✅ **達成・承認済み (マイル獲得済み)**";
      colorStr = "#2ECC71";
    }

    const embed = createBaseEmbed(
      "📅 本日のデイリーミッション",
      `現在のランク（Rank ${userMiles.rank_level}）に応じた本日のミッションです。`,
      colorStr
    );

    embed.addFields(
      { name: "📋 ミッション内容", value: `**${mission.mission_desc}**`, inline: false },
      { name: "🎁 報酬マイル", value: `**+${mission.reward_miles}** マイル`, inline: true },
      { name: "📌 状態", value: statusText, inline: true }
    );

    if (mission.status === "pending") {
      embed.setFooter({
        text: "💡 達成したら `/ミッション報告` でスクショを添えて報告しよう！",
      });
    }

    await interaction.followUp({ embeds: [embed] });
  },
};

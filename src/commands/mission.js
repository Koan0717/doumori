import { SlashCommandBuilder } from "discord.js";
import { getUserMiles, getOrCreateDailyMissions } from "../database/db.js";
import { createBaseEmbed } from "../utils/embedBuilder.js";

export const command = {
  ephemeral: true,
  data: new SlashCommandBuilder()
    .setName("デイリーミッション")
    .setDescription("本日のデイリーミッション（全3枠）を確認します📅"),

  async execute(interaction) {
    if (!interaction.deferred && !interaction.replied) {
      await interaction.deferReply({ ephemeral: true }).catch(() => {});
    }

    const guildId = interaction.guild.id;
    const userId = interaction.user.id;

    const userMiles = await getUserMiles(guildId, userId);
    const missions = await getOrCreateDailyMissions(guildId, userId, userMiles.rank_level);

    let completedCount = 0;
    let totalMilesAvailable = 0;

    missions.forEach((m) => {
      totalMilesAvailable += m.reward_miles || 100;
      if (m.status === "approved") completedCount++;
    });

    const embed = createBaseEmbed(
      "📅 本日のデイリーミッション (全3枠)",
      `1ミッション達成につき **100マイル** 付与されます（3つすべて達成で **+300マイル**）！\n進捗状況: **${completedCount} / 3** 達成済み`,
      completedCount === 3 ? "#2ECC71" : completedCount > 0 ? "#3498DB" : "#F1C40F"
    );

    const slotEmojis = ["1️⃣", "2️⃣", "3️⃣"];

    missions.forEach((m, idx) => {
      let statusBadge = "⏳ **未達成 (未報告)**";
      if (m.status === "submitted") {
        statusBadge = "📨 **報告中 (運営確認待ち)**";
      } else if (m.status === "approved") {
        statusBadge = "✅ **達成・承認済み (+100pt)**";
      }

      const slotIcon = slotEmojis[idx] || `[${idx + 1}]`;
      const title = m.mission_title || `ミッション ${idx + 1}`;

      embed.addFields({
        name: `${slotIcon} 【${title}】 (+${m.reward_miles || 100}pt)`,
        value: `📝 ${m.mission_desc}\n状態: ${statusBadge}`,
        inline: false,
      });
    });

    embed.setFooter({
      text: "💡 達成したら `/ミッション報告` でスクショを添えて報告してください！（枠指定または一括報告可能）",
    });

    await interaction.followUp({ embeds: [embed] });
  },
};

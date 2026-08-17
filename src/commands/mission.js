import { SlashCommandBuilder } from "discord.js";
import { getUserMiles, getOrCreateDailyMissions } from "../database/db.js";
import { createBaseEmbed } from "../utils/embedBuilder.js";

export const command = {
  ephemeral: true,
  data: new SlashCommandBuilder()
    .setName("デイリーミッション")
    .setDescription("本日のデイリーミッション（全枠・進捗状況）を確認します📅"),

  async execute(interaction) {
    if (!interaction.deferred && !interaction.replied) {
      await interaction.deferReply({ ephemeral: true }).catch(() => {});
    }

    const guildId = interaction.guild.id;
    const userId = interaction.user.id;

    const userMiles = await getUserMiles(guildId, userId);
    const missions = await getOrCreateDailyMissions(guildId, userId, userMiles.rank_level);

    let completedCount = 0;
    let totalMilesEarned = 0;
    let totalMilesAvailable = 0;

    missions.forEach((m) => {
      const reward = m.reward_miles || 100;
      totalMilesAvailable += reward;
      if (m.status === "approved") {
        completedCount++;
        totalMilesEarned += reward;
      }
    });

    const isAllCompleted = completedCount === missions.length && missions.length > 0;
    const embedColor = isAllCompleted ? "#2ECC71" : completedCount > 0 ? "#3498DB" : "#F1C40F";

    const embed = createBaseEmbed(
      `📅 本日のデイリーミッション (全${missions.length}枠)`,
      isAllCompleted
        ? `🎉 **本日の全ミッションを完全制覇しました！** (合計 **+${totalMilesEarned}マイル** 獲得済み)`
        : `1ミッション達成につき **100マイル** 付与されます（すべて達成で **+${totalMilesAvailable}マイル**）！\n進捗状況: **${completedCount} / ${missions.length}** クリア済み`,
      embedColor
    );

    const slotEmojis = ["1️⃣", "2️⃣", "3️⃣", "4️⃣", "5️⃣", "6️⃣", "7️⃣", "8️⃣", "9️⃣", "🔟"];

    missions.forEach((m, idx) => {
      const slotIcon = slotEmojis[idx] || `[${idx + 1}]`;
      const title = m.mission_title || `ミッション ${idx + 1}`;
      const reward = m.reward_miles || 100;

      let fieldTitle = `${slotIcon} 【${title}】 (+${reward}pt)`;
      let statusBadge = "⏳ **未達成 (未報告)**";

      if (m.status === "submitted") {
        fieldTitle = `📨 ${slotIcon} 【${title}】 [確認待ち]`;
        statusBadge = "📨 **報告中 (運営スタッフの確認待ち)**";
      } else if (m.status === "approved") {
        fieldTitle = `✅ ${slotIcon} 【${title}】 [クリア済み 🎉]`;
        statusBadge = `🎉 **クリア済み (承認完了 / +${reward}pt 獲得済み)**`;
      }

      embed.addFields({
        name: fieldTitle,
        value: `📝 ${m.mission_desc}\n状態: ${statusBadge}`,
        inline: false,
      });
    });

    embed.setFooter({
      text: isAllCompleted
        ? "🌟 明日になると新しいデイリーミッションが更新されます！お疲れ様でした！"
        : "💡 達成したら `/ミッション報告` で対象ミッションを指定してスクショを提出してください！",
    });

    await interaction.followUp({ embeds: [embed] });
  },
};

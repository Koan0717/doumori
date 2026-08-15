import { SlashCommandBuilder } from "discord.js";
import { FISH_LIST } from "../data/fish.js";
import { BUG_LIST } from "../data/bugs.js";
import { getLeaderboard } from "../database/db.js";
import { createBaseEmbed } from "../utils/embedBuilder.js";

export const command = {
  ephemeral: false,
  data: new SlashCommandBuilder()
    .setName("ランキング")
    .setDescription("サーバー内の図鑑完成率ランキングを表示します🏆"),

  async execute(interaction) {
    if (!interaction.deferred && !interaction.replied) {
      await interaction.deferReply({ ephemeral: interaction.isButton() }).catch(() => {});
    }

    const guildId = interaction.guild.id;
    const totalTypes = FISH_LIST.length + BUG_LIST.length; // 40

    const topRows = await getLeaderboard(guildId, totalTypes);

    const embed = createBaseEmbed(
      "🏆 図鑑完成率 ランキング Top 10",
      `魚・虫（全${totalTypes}種類）のコレクション数トップランカーです！`,
      "#FFD700"
    );

    if (topRows.length === 0) {
      embed.setDescription("まだ図鑑に登録された生き物がありません！最初に採集してみましょう！");
    } else {
      let descText = "";
      const rankEmojis = ["🥇", "🥈", "🥉", "4️⃣", "5️⃣", "6️⃣", "7️⃣", "8️⃣", "9️⃣", "🔟"];

      topRows.forEach((row, idx) => {
        const emoji = rankEmojis[idx] || "👤";
        const caught = parseInt(row.caught_types, 10);
        const percent = Math.floor((caught / totalTypes) * 100);
        descText += `${emoji} <@${row.user_id}> — **${caught}** / ${totalTypes} 種 (\`${percent}%\`)\n`;
      });

      embed.setDescription(descText);
    }

    await interaction.followUp({ embeds: [embed] });
  },
};

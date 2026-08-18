import { SlashCommandBuilder } from "discord.js";
import { getResidentCardData } from "../database/db.js";
import { createBaseEmbed } from "../utils/embedBuilder.js";

/**
 * 住民カードEmbed生成関数（共通ユーティリティとしても使用可能）
 */
export function buildResidentCardEmbed(cardData, targetUser) {
  const embed = createBaseEmbed(
    "🃏 住民カード",
    "━━━━━━━━━━━━━━━━━━",
    cardData.rankColor || "#2ECC71"
  );

  embed.setThumbnail(targetUser.displayAvatarURL({ dynamic: true }));

  embed.addFields(
    { name: "👤 名前", value: `**${targetUser.displayName}**`, inline: true },
    { name: "⭐ 階級", value: `**${cardData.rankName}**`, inline: true },
    { name: "📈 ミッション達成", value: `**＋${cardData.missionCount}** 回`, inline: true },
    { name: "💰 ポイント (マイル)", value: `**${cardData.miles.toLocaleString()}** pt`, inline: true },
    { name: "🏆 累計ミッション", value: `**${cardData.totalMissionCount}** 回`, inline: true },
    { name: "🪙 鯖内通貨 (ベル)", value: `**${cardData.bells.toLocaleString()}** ベル`, inline: true },
    { name: "🎫 所持チケット", value: `**${cardData.tickets}** 枚`, inline: true }
  );

  embed.setFooter({
    text: `ステップアップ住民証 | 住民ID: ${targetUser.id}`,
  });

  return embed;
}

export const command = {
  ephemeral: true,
  data: new SlashCommandBuilder()
    .setName("住民カード")
    .setDescription("現在の階級・ミッション達成回数・ポイント等の【住民カード】を表示します🃏")
    .addUserOption((option) =>
      option
        .setName("user")
        .setDescription("確認したい住民（省略時は自分）")
        .setRequired(false)
    ),

  async execute(interaction) {
    if (!interaction.deferred && !interaction.replied) {
      await interaction.deferReply({ ephemeral: true }).catch(() => {});
    }

    const guildId = interaction.guild.id;
    const targetUser = (interaction.options && interaction.options.getUser("user")) || interaction.user;
    const member = interaction.guild
      ? await interaction.guild.members.fetch(targetUser.id).catch(() => null)
      : null;
    const cardData = await getResidentCardData(guildId, targetUser.id, member);

    const embed = buildResidentCardEmbed(cardData, targetUser);

    await interaction.followUp({ embeds: [embed] });
  },
};

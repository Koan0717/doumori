import { SlashCommandBuilder } from "discord.js";
import { getResidentCardData } from "../database/db.js";
import { buildResidentCardEmbed } from "./card.js";

export const command = {
  data: new SlashCommandBuilder()
    .setName("マイル残高")
    .setDescription("現在の所持マイルポイントや住民カード情報を確認します🌟")
    .addUserOption((option) =>
      option
        .setName("user")
        .setDescription("確認したい住民（省略時は自分）")
        .setRequired(false)
    ),

  async execute(interaction) {
    if (!interaction.deferred && !interaction.replied) {
      await interaction.deferReply({ ephemeral: interaction.isButton() }).catch(() => {});
    }

    const guildId = interaction.guild.id;
    const targetUser = (interaction.options && interaction.options.getUser("user")) || interaction.user;
    const cardData = await getResidentCardData(guildId, targetUser.id);

    const embed = buildResidentCardEmbed(cardData, targetUser);

    await interaction.followUp({ embeds: [embed] });
  },
};

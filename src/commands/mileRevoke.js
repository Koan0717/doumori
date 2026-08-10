import { SlashCommandBuilder, PermissionFlagsBits } from "discord.js";
import { adminRemoveMiles, getResidentCardData } from "../database/db.js";
import { buildResidentCardEmbed } from "./card.js";
import { createBaseEmbed } from "../utils/embedBuilder.js";

export const command = {
  data: new SlashCommandBuilder()
    .setName("マイル没収")
    .setDescription("【管理者専用】指定した住民からマイルポイントを減額・没収します⚠️")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addUserOption((option) =>
      option
        .setName("user")
        .setDescription("マイルを没収する対象住民")
        .setRequired(true)
    )
    .addIntegerOption((option) =>
      option
        .setName("amount")
        .setDescription("没収するマイルポイント数")
        .setRequired(true)
        .setMinValue(1)
    )
    .addStringOption((option) =>
      option
        .setName("reason")
        .setDescription("没収の理由・メモ (任意)")
        .setRequired(false)
    ),

  async execute(interaction) {
    if (!interaction.deferred && !interaction.replied) {
      await interaction.deferReply({ ephemeral: false }).catch(() => {});
    }

    // 管理者権限チェック
    if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator) &&
        !interaction.member.permissions.has(PermissionFlagsBits.ManageGuild)) {
      await interaction.followUp({
        content: "⚠️ このコマンドを実行する権限がありません（管理者専用）。",
        ephemeral: true,
      });
      return;
    }

    const guildId = interaction.guild.id;
    const targetUser = interaction.options.getUser("user");
    const amount = interaction.options.getInteger("amount");
    const reason = interaction.options.getString("reason") || "管理者による手動没収・調整";

    const result = await adminRemoveMiles(guildId, targetUser.id, amount, interaction.user.id, reason);
    const cardData = await getResidentCardData(guildId, targetUser.id);
    const cardEmbed = buildResidentCardEmbed(cardData, targetUser);

    const embed = createBaseEmbed(
      "⚠️ マイルポイント手動没収完了",
      `管理者 ${interaction.user.toString()} により、${targetUser.toString()} さんのマイルポイントが減額・没収されました。\n\n` +
      `➖ **没収ポイント**: **-${result.deducted.toLocaleString()}** pt\n` +
      `🌟 **現在のマイル残高**: **${result.newMiles.toLocaleString()}** pt\n` +
      `📝 **理由**: ${reason}`,
      "#E74C3C"
    );

    await interaction.followUp({
      embeds: [embed, cardEmbed],
    });
  },
};

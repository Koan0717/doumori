import { SlashCommandBuilder } from "discord.js";
import { addTickets, getUser } from "../database/db.js";
import { checkPermission } from "../utils/permissionHelper.js";
import { createBaseEmbed } from "../utils/embedBuilder.js";

export const command = {
  ephemeral: false,
  data: new SlashCommandBuilder()
    .setName("チケット没収")
    .setDescription("【スタッフ専用】指定した住民から図鑑チケットを減額・没収します⚠️")
    .addUserOption((option) =>
      option
        .setName("user")
        .setDescription("チケットを没収する対象住民")
        .setRequired(true)
    )
    .addIntegerOption((option) =>
      option
        .setName("amount")
        .setDescription("没収するチケット枚数")
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

    const guildId = interaction.guild.id;

    // 権限チェック (管理者または ticket_grant ロール)
    const hasPerm = await checkPermission(interaction.member, guildId, "ticket_grant");
    if (!hasPerm) {
      await interaction.followUp({
        content: "⚠️ このコマンドを実行する権限がありません（チケット管理スタッフ専用）。",
        ephemeral: true,
      });
      return;
    }

    const targetUser = interaction.options.getUser("user");
    const amount = interaction.options.getInteger("amount");
    const reason = interaction.options.getString("reason") || "スタッフによる手動没収・調整";

    const userData = await getUser(guildId, targetUser.id);
    const actualDeduct = Math.min(userData.tickets || 0, amount);
    const newTickets = await addTickets(guildId, targetUser.id, -actualDeduct);

    const embed = createBaseEmbed(
      "⚠️ 図鑑チケット手動没収完了",
      `スタッフ ${interaction.user.toString()} により、${targetUser.toString()} さんの図鑑チケットが減額・没収されました。\n\n` +
      `➖ **没収枚数**: **-${actualDeduct.toLocaleString()}** 枚\n` +
      `🎫 **現在の所持チケット**: **${newTickets.toLocaleString()}** 枚\n` +
      `📝 **理由**: ${reason}`,
      "#E74C3C"
    );

    await interaction.followUp({
      embeds: [embed],
    });
  },
};

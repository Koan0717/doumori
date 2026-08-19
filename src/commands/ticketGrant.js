import { SlashCommandBuilder } from "discord.js";
import { addTickets, getUser } from "../database/db.js";
import { checkPermission } from "../utils/permissionHelper.js";
import { createBaseEmbed } from "../utils/embedBuilder.js";

export const command = {
  ephemeral: false,
  data: new SlashCommandBuilder()
    .setName("チケット付与")
    .setDescription("【スタッフ専用】指定した住民に図鑑チケットを手動で付与します🎫")
    .addUserOption((option) =>
      option
        .setName("user")
        .setDescription("チケットを付与する対象住民")
        .setRequired(true)
    )
    .addIntegerOption((option) =>
      option
        .setName("amount")
        .setDescription("付与するチケット枚数")
        .setRequired(true)
        .setMinValue(1)
    )
    .addStringOption((option) =>
      option
        .setName("reason")
        .setDescription("付与の理由・メモ (任意)")
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
    const reason = interaction.options.getString("reason") || "スタッフによる手動付与";

    const newTickets = await addTickets(guildId, targetUser.id, amount);

    const embed = createBaseEmbed(
      "🎫 図鑑チケット手動付与完了",
      `スタッフ ${interaction.user.toString()} により、${targetUser.toString()} さんへ図鑑チケットが付与されました！\n\n` +
      `➕ **付与枚数**: **+${amount.toLocaleString()}** 枚\n` +
      `🎫 **現在の所持チケット**: **${newTickets.toLocaleString()}** 枚\n` +
      `📝 **理由**: ${reason}`,
      "#2ECC71"
    );

    await interaction.followUp({
      embeds: [embed],
    });
  },
};

import { SlashCommandBuilder } from "discord.js";
import { adminAddMiles, getResidentCardData } from "../database/db.js";
import { buildResidentCardEmbed } from "./card.js";
import { createBaseEmbed } from "../utils/embedBuilder.js";
import { checkPermission } from "../utils/permissionHelper.js";

export const command = {
  ephemeral: false,
  data: new SlashCommandBuilder()
    .setName("マイル付与")
    .setDescription("【スタッフ専用】指定した住民にマイルポイントを手動で付与します🎁")
    .addUserOption((option) =>
      option
        .setName("user")
        .setDescription("マイルを付与する対象住民")
        .setRequired(true)
    )
    .addIntegerOption((option) =>
      option
        .setName("amount")
        .setDescription("付与するマイルポイント数")
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

    // 権限チェック (管理者または mile_grant ロール)
    const hasPerm = await checkPermission(interaction.member, guildId, "mile_grant");
    if (!hasPerm) {
      await interaction.followUp({
        content: "⚠️ このコマンドを実行する権限がありません（マイル付与スタッフ専用）。",
        ephemeral: true,
      });
      return;
    }
    const targetUser = interaction.options.getUser("user");
    const amount = interaction.options.getInteger("amount");
    const reason = interaction.options.getString("reason") || "管理者による手動付与";

    const newMiles = await adminAddMiles(guildId, targetUser.id, amount, interaction.user.id, reason);
    const member = interaction.guild
      ? await interaction.guild.members.fetch(targetUser.id).catch(() => null)
      : null;
    const cardData = await getResidentCardData(guildId, targetUser.id, member);
    const cardEmbed = buildResidentCardEmbed(cardData, targetUser);

    const embed = createBaseEmbed(
      "🎁 マイルポイント手動付与完了",
      `管理者 ${interaction.user.toString()} により、${targetUser.toString()} さんへマイルポイントが付与されました！\n\n` +
      `➕ **付与ポイント**: **+${amount.toLocaleString()}** pt\n` +
      `🌟 **現在のマイル残高**: **${newMiles.toLocaleString()}** pt\n` +
      `📝 **理由**: ${reason}`,
      "#2ECC71"
    );

    await interaction.followUp({
      embeds: [embed, cardEmbed],
    });
  },
};

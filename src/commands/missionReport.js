import {
  SlashCommandBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  PermissionFlagsBits,
  ComponentType,
} from "discord.js";
import {
  getUserMiles,
  getOrCreateDailyMission,
  submitMissionReport,
  approveMissionReport,
} from "../database/db.js";
import { createBaseEmbed } from "../utils/embedBuilder.js";

export const command = {
  data: new SlashCommandBuilder()
    .setName("ミッション報告")
    .setDescription("本日のデイリーミッション達成のスクリーンショットを添えて報告します📸")
    .addAttachmentOption((option) =>
      option
        .setName("screenshot")
        .setDescription("ミッション達成のスクリーンショット画像")
        .setRequired(true)
    ),

  async execute(interaction) {
    if (!interaction.deferred && !interaction.replied) {
      await interaction.deferReply({ ephemeral: false }).catch(() => {});
    }

    const guildId = interaction.guild.id;
    const userId = interaction.user.id;
    const attachment = interaction.options.getAttachment("screenshot");

    // 画像形式チェック
    if (!attachment || !attachment.contentType || !attachment.contentType.startsWith("image/")) {
      await interaction.followUp({
        content: "⚠️ 画像ファイル（スクリーンショット）を添付して報告してください！",
        ephemeral: true,
      });
      return;
    }

    const userMiles = await getUserMiles(guildId, userId);
    const mission = await getOrCreateDailyMission(guildId, userId, userMiles.rank_level);

    if (mission.status === "approved") {
      await interaction.followUp({
        content: "✅ 本日のデイリーミッションはすでに達成・承認済みです！",
        ephemeral: true,
      });
      return;
    }

    // 報告を記録
    await submitMissionReport(guildId, userId, mission.date_key, attachment.url);

    const embed = createBaseEmbed(
      "📸 デイリーミッション達成報告",
      `**報告者**: ${interaction.user.mention}\n**ミッション**: ${mission.mission_desc}\n**報酬マイル**: **+${mission.reward_miles}** マイル`,
      "#3498DB"
    );

    embed.setImage(attachment.url);
    embed.setFooter({ text: `提出日: ${mission.date_key} | 運営の承認をお待ちください` });

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`approve_${userId}_${mission.date_key}`)
        .setLabel("✅ 承認してマイル付与")
        .setStyle(ButtonStyle.Success)
    );

    const reportMsg = await interaction.followUp({
      content: "📢 **新しいミッション達成報告が届きました！** (運営・管理者はボタンを押して承認できます)",
      embeds: [embed],
      components: [row],
    });

    // 承認ボタンコレクター
    const collector = reportMsg.createMessageComponentCollector({
      componentType: ComponentType.Button,
      time: 86400000, // 24時間受付
    });

    collector.on("collect", async (i) => {
      // 管理者権限のチェック
      if (!i.member.permissions.has(PermissionFlagsBits.ManageMessages)) {
        await i.reply({ content: "⚠️ 報告を承認する権限がありません（管理者専用）。", ephemeral: true });
        return;
      }

      await i.deferUpdate();

      const result = await approveMissionReport(guildId, userId, mission.date_key);
      if (!result) {
        await i.followUp({ content: "すでに承認済みです。", ephemeral: true });
        return;
      }

      const approvedEmbed = createBaseEmbed(
        "🎉 ミッション承認完了！",
        `${interaction.user.mention} さんのミッション報告が ${i.user.mention} によって承認されました！\n\n🎁 **+${result.rewardMiles}** マイル を獲得！ (現在の所持: **${result.newMiles}** マイル)`,
        "#2ECC71"
      );

      const disabledRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("approved")
          .setLabel(`✅ 承認済み (by ${i.user.displayName})`)
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(true)
      );

      await i.editReply({ embeds: [embed, approvedEmbed], components: [disabledRow] });
    });
  },
};

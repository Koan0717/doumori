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
  getResidentCardData,
} from "../database/db.js";
import { buildResidentCardEmbed } from "./card.js";
import { createBaseEmbed } from "../utils/embedBuilder.js";

export const command = {
  ephemeral: false,
  data: new SlashCommandBuilder()
    .setName("ミッション報告")
    .setDescription("ミッション達成のスクリーンショットを添えて報告します📸")
    .addAttachmentOption((option) =>
      option
        .setName("screenshot")
        .setDescription("ミッション達成のスクリーンショット画像")
        .setRequired(true)
    )
    .addIntegerOption((option) =>
      option
        .setName("count")
        .setDescription("ミッション達成回数 (省略時は1回)")
        .setRequired(false)
        .setMinValue(1)
        .setMaxValue(10)
    ),

  async execute(interaction) {
    if (!interaction.deferred && !interaction.replied) {
      await interaction.deferReply({ ephemeral: false }).catch(() => {});
    }

    const guildId = interaction.guild.id;
    const userId = interaction.user.id;
    const attachment = interaction.options.getAttachment("screenshot");
    const count = interaction.options.getInteger("count") || 1;

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

    const totalExpectedMiles = (mission.reward_miles || 30) * count;

    const embed = createBaseEmbed(
      "📸 デイリーミッション達成報告",
      `**報告者**: ${interaction.user.toString()}\n` +
      `**ミッション内容**: ${mission.mission_desc}\n` +
      `**達成回数**: **${count}** 回\n` +
      `**付与予定ポイント**: **+${totalExpectedMiles}** pt`,
      "#3498DB"
    );

    embed.setImage(attachment.url);
    embed.setFooter({ text: `提出日: ${mission.date_key} | 運営スタッフの承認をお待ちください` });

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`approve_${userId}_${mission.date_key}`)
        .setLabel(`✅ 承認する (+${totalExpectedMiles}pt / +${count}回)`)
        .setStyle(ButtonStyle.Success)
    );

    const reportMsg = await interaction.followUp({
      content: "📢 **新しいミッション達成報告が届きました！** (運営・管理者はボタンを押して承認できます)",
      embeds: [embed],
      components: [row],
    });

    // 承認ボタンコレクター (24時間受付)
    const collector = reportMsg.createMessageComponentCollector({
      componentType: ComponentType.Button,
      time: 86400000,
    });

    collector.on("collect", async (i) => {
      // 管理者/モデレーター権限のチェック
      if (!i.member.permissions.has(PermissionFlagsBits.ManageMessages)) {
        await i.reply({ content: "⚠️ 報告を承認する権限がありません（スタッフ・管理者専用）。", ephemeral: true });
        return;
      }

      await i.deferUpdate();

      const reportMember = interaction.guild
        ? await interaction.guild.members.fetch(userId).catch(() => interaction.member)
        : interaction.member;

      const result = await approveMissionReport(guildId, userId, mission.date_key, i.user.id, count, reportMember);
      if (!result) {
        await i.followUp({ content: "すでに承認済みです。", ephemeral: true });
        return;
      }

      // 最新の住民カード情報を取得 (ロール反映)
      const cardData = await getResidentCardData(guildId, userId, reportMember);
      const cardEmbed = buildResidentCardEmbed(cardData, interaction.user);

      const approvedEmbed = createBaseEmbed(
        "🎉 ミッション承認完了＆自動反映！",
        `**承認スタッフ**: ${i.user.toString()}\n` +
        `**対象者**: ${interaction.user.toString()}\n\n` +
        `💰 **獲得ポイント**: **+${result.rewardMiles}** pt\n` +
        `📈 **ミッション達成**: **+${result.countMultiplier}** 回\n` +
        `📝 **処理履歴**: 記録完了\n` +
        `🃏 **住民カード**: 最新情報に自動更新されました！`,
        "#2ECC71"
      );

      const disabledRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("approved")
          .setLabel(`✅ 承認完了 (by ${i.user.displayName})`)
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(true)
      );

      await i.editReply({
        content: `✅ ${interaction.user.toString()} さんのミッション報告が承認されました！`,
        embeds: [approvedEmbed, cardEmbed],
        components: [disabledRow],
      });
    });
  },
};

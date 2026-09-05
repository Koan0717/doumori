import {
  SlashCommandBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  PermissionFlagsBits,
  EmbedBuilder,
} from "discord.js";
import {
  getUserMiles,
  getOrCreateDailyMissions,
  submitMissionReportSlot,
  approveMissionSlot,
  getResidentCardData,
} from "../database/db.js";
import { buildResidentCardEmbed } from "./card.js";
import { createBaseEmbed } from "../utils/embedBuilder.js";
import { checkPermission } from "../utils/permissionHelper.js";

export const command = {
  ephemeral: false,
  data: new SlashCommandBuilder()
    .setName("ミッション報告")
    .setDescription("デイリーミッション達成のスクリーンショットを添えて報告します📸")
    .addAttachmentOption((option) =>
      option
        .setName("screenshot")
        .setDescription("ミッション達成のスクリーンショット画像")
        .setRequired(true)
    )
    .addIntegerOption((option) =>
      option
        .setName("slot")
        .setDescription("報告するミッション枠番号 (1〜30、省略時はすべての未達成枠)")
        .setRequired(false)
        .setMinValue(0)
        .setMaxValue(30)
    ),

  async execute(interaction) {
    if (!interaction.deferred && !interaction.replied) {
      await interaction.deferReply({ ephemeral: false }).catch(() => {});
    }

    const guildId = interaction.guild.id;
    const userId = interaction.user.id;
    const attachment = interaction.options.getAttachment("screenshot");
    const slot = interaction.options.getInteger("slot") ?? 0;

    // 画像形式チェック
    if (!attachment || !attachment.contentType || !attachment.contentType.startsWith("image/")) {
      await interaction.followUp({
        content: "⚠️ 画像ファイル（スクリーンショット）を添付して報告してください！",
        ephemeral: true,
      });
      return;
    }

    const userMiles = await getUserMiles(guildId, userId);
    const missions = await getOrCreateDailyMissions(guildId, userId, userMiles.rank_level);

    // 報告対象のミッションを特定
    const targetMissions = slot > 0
      ? missions.filter((m) => m.mission_slot === slot)
      : missions.filter((m) => m.status !== "approved");

    if (targetMissions.length === 0) {
      await interaction.followUp({
        content: "✅ 該当するミッションはすべて既に達成・承認済みです！",
        ephemeral: true,
      });
      return;
    }

    // 報告を記録
    const dateKey = targetMissions[0].date_key;
    await submitMissionReportSlot(guildId, userId, dateKey, slot, attachment.url);

    let totalExpectedMiles = 0;
    let missionListText = "";
    targetMissions.forEach((m) => {
      const reward = m.reward_miles || 100;
      totalExpectedMiles += reward;
      missionListText += `・**[枠${m.mission_slot}] ${m.mission_title}**: ${m.mission_desc} (+${reward}pt)\n`;
    });

    const embed = createBaseEmbed(
      "📸 デイリーミッション達成報告",
      `**報告者**: ${interaction.user.toString()}\n` +
      `**報告枠**: ${slot === 0 ? "すべての未達成ミッション" : `ミッション 枠${slot}`}\n\n` +
      `**【対象ミッション】**\n${missionListText}\n` +
      `💰 **付与予定ポイント**: **+${totalExpectedMiles}** pt`,
      "#3498DB"
    );

    embed.setImage(attachment.url);
    embed.setFooter({ text: `提出日: ${dateKey} | 運営スタッフの承認をお待ちください` });

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`approve_${userId}_${dateKey}_${slot}`)
        .setLabel(`✅ 承認する (+${totalExpectedMiles}pt / ${targetMissions.length}枠)`)
        .setStyle(ButtonStyle.Success)
    );

    await interaction.followUp({
      content: "📢 **新しいミッション達成報告が届きました！** (運営・管理者はボタンを押して承認できます)",
      embeds: [embed],
      components: [row],
    });
  },
};

/**
 * デイリーミッション承認ボタンのグローバルハンドラー
 * @param {import("discord.js").ButtonInteraction} interaction
 */
export async function handleMissionApproval(interaction) {
  // 1. 即時 deferUpdate でDiscordの3秒タイムアウトを防止
  await interaction.deferUpdate().catch(() => {});

  const guildId = interaction.guildId;
  const staffMember = interaction.member;
  const staffUser = interaction.user;

  try {
    // 2. スタッフ/管理者権限のチェック (mission_staff_role_ids or admin or ManageMessages)
    const hasStaff = await checkPermission(
      staffMember,
      guildId,
      "mission_staff",
      interaction.memberPermissions
    );
    if (!hasStaff) {
      await interaction.followUp({
        content: "⚠️ 報告を承認する権限がありません（ミッション承認スタッフ・管理者専用）。",
        ephemeral: true,
      });
      return;
    }

    // 3. customId の解析: approve_${userId}_${dateKey}_${slot} (旧形式: approve_${userId}_${dateKey})
    const parts = interaction.customId.split("_");
    const targetUserId = parts[1];
    const dateKey = parts[2];
    const slot = parts[3] !== undefined ? parseInt(parts[3], 10) : 0;

    if (!targetUserId || !dateKey) {
      await interaction.followUp({
        content: "⚠️ 無効な承認リクエストです。",
        ephemeral: true,
      });
      return;
    }

    // 4. 対象メンバー・ユーザーの取得
    const targetMember = interaction.guild
      ? await interaction.guild.members.fetch(targetUserId).catch(() => null)
      : null;
    const targetUser = targetMember?.user || await interaction.client.users.fetch(targetUserId).catch(() => null);
    const targetMention = targetUser ? targetUser.toString() : `<@${targetUserId}>`;

    // 5. 承認処理の実行
    const result = await approveMissionSlot(guildId, targetUserId, dateKey, slot, staffUser.id, targetMember);
    if (!result) {
      // 既に承認済みの場合、ボタンを無効化して通知
      const disabledRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("approved_already")
          .setLabel("✅ 承認済み")
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(true)
      );
      await interaction.editReply({ components: [disabledRow] }).catch(() => {});
      await interaction.followUp({ content: "⚠️ このミッション報告はすでに承認済みです。", ephemeral: true });
      return;
    }

    // 6. 最新の住民カード情報を取得
    const cardData = await getResidentCardData(guildId, targetUserId, targetMember);
    const cardEmbed = targetUser ? buildResidentCardEmbed(cardData, targetUser) : null;

    const approvedEmbed = createBaseEmbed(
      "🎉 ミッション承認完了＆自動反映！",
      `**承認スタッフ**: ${staffUser.toString()}\n` +
      `**対象者**: ${targetMention}\n\n` +
      `💰 **獲得ポイント**: **+${result.rewardMiles}** pt\n` +
      `📈 **承認ミッション枠数**: **${result.approvedCount}** 枠\n` +
      `📝 **処理履歴**: 記録完了\n` +
      `🃏 **住民カード**: 最新情報に自動更新されました！`,
      "#2ECC71"
    );

    const disabledRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("approved")
        .setLabel(`✅ 承認完了 (by ${staffUser.displayName || staffUser.username})`)
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(true)
    );

    const embedsToSend = [approvedEmbed];
    if (cardEmbed) {
      embedsToSend.push(cardEmbed);
    }

    await interaction.editReply({
      content: `✅ ${targetMention} さんのミッション報告が承認されました！`,
      embeds: embedsToSend,
      components: [disabledRow],
    });
  } catch (error) {
    console.error("❌ ミッション承認処理エラー:", error);
    await interaction.followUp({
      content: `❌ 承認処理中にエラーが発生しました: \`${error.message || error}\``,
      ephemeral: true,
    }).catch(() => {});
  }
}

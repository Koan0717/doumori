import {
  SlashCommandBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  RoleSelectMenuBuilder,
  ChannelSelectMenuBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
} from "discord.js";
import { getDoumoriSettings, saveDoumoriSettings } from "../database/db.js";
import { checkPermission } from "../utils/permissionHelper.js";
import { createBaseEmbed } from "../utils/embedBuilder.js";

function formatRolesText(roleIds) {
  if (!Array.isArray(roleIds) || roleIds.length === 0) {
    return "*(未設定 - サーバー管理者のみ許可)*";
  }
  return roleIds.map((id) => `<@&${id}>`).join(" ");
}

function formatChannelText(channelId) {
  if (!channelId) return "*(未設定)*";
  return `<#${channelId}>`;
}

function buildMainMenuEmbed(settings) {
  const adminRoles = formatRolesText(settings.admin_role_ids);
  const mileRoles = formatRolesText(settings.mile_grant_role_ids);
  const ticketRoles = formatRolesText(settings.ticket_grant_role_ids);
  const staffRoles = formatRolesText(settings.mission_staff_role_ids);
  const ticketChannel = formatChannelText(settings.ticket_notify_channel_id);
  const missionChannel = formatChannelText(settings.mission_report_channel_id);

  const embed = createBaseEmbed(
    "⚙️ どうぶつの森林 - サーバー設定パネル",
    "Botの各種ロール権限（付与・承認スタッフ・管理者）や通知先チャンネルを設定できます。\n下のメニューから設定したい項目を選択してください。\n*(※デイリーミッション枠数等はダッシュボードから設定可能です)*",
    "#2ECC71"
  );

  embed.addFields(
    {
      name: "👑 管理者ロール (Bot全権限・設定操作)",
      value: adminRoles,
      inline: false,
    },
    {
      name: "🌟 マイル付与ロール (手動マイル付与・没収)",
      value: mileRoles,
      inline: false,
    },
    {
      name: "🎫 チケット付与ロール (手動チケット付与・没収)",
      value: ticketRoles,
      inline: false,
    },
    {
      name: "📸 ミッション承認スタッフロール (達成報告承認)",
      value: staffRoles,
      inline: false,
    },
    {
      name: "🎫 チケット獲得通知チャンネル",
      value: ticketChannel,
      inline: true,
    },
    {
      name: "📸 ミッション報告受付チャンネル",
      value: missionChannel,
      inline: true,
    }
  );

  embed.setFooter({ text: "💡 項目を選んでロールや設定を変更してください（即時反映されます）" });
  return embed;
}

function buildMainMenuComponents() {
  const selectMenu = new StringSelectMenuBuilder()
    .setCustomId("menu_select_category")
    .setPlaceholder("⚙️ 設定する項目を選択してください")
    .addOptions(
      {
        label: "👑 管理者ロール設定",
        description: "Botの全権限・設定変更を許可するロールを設定",
        value: "opt_admin_roles",
        emoji: "👑",
      },
      {
        label: "🌟 マイル付与ロール設定",
        description: "マイルの手動付与・没収ができるスタッフロールを設定",
        value: "opt_mile_grant_roles",
        emoji: "🌟",
      },
      {
        label: "🎫 チケット付与ロール設定",
        description: "チケットの手動付与・没収ができるスタッフロールを設定",
        value: "opt_ticket_grant_roles",
        emoji: "🎫",
      },
      {
        label: "📸 ミッション承認スタッフロール設定",
        description: "ミッション報告を承認・マイル付与できるロールを設定",
        value: "opt_mission_staff_roles",
        emoji: "📸",
      },
      {
        label: "📢 通知・報告チャンネル設定",
        description: "チケット獲得通知やミッション報告のチャンネルを設定",
        value: "opt_notify_channels",
        emoji: "📢",
      }
    );

  return [new ActionRowBuilder().addComponents(selectMenu)];
}

export const command = {
  ephemeral: true,
  data: new SlashCommandBuilder()
    .setName("設定パネル")
    .setDescription("【管理者専用】Botのロール権限や通知チャンネルを設定します⚙️"),

  async execute(interaction) {
    if (!interaction.deferred && !interaction.replied) {
      await interaction.deferReply({ ephemeral: true }).catch(() => {});
    }

    const guildId = interaction.guild.id;

    // 権限チェック (管理者権限または admin_role_ids)
    const hasAdmin = await checkPermission(interaction.member, guildId, "admin");
    if (!hasAdmin) {
      await interaction.followUp({
        content: "⚠️ このコマンドを実行する権限がありません（管理者専用）。",
        ephemeral: true,
      });
      return;
    }

    let settings = await getDoumoriSettings(guildId);

    const initialEmbed = buildMainMenuEmbed(settings);
    const initialRows = buildMainMenuComponents();

    const response = await interaction.followUp({
      embeds: [initialEmbed],
      components: initialRows,
      ephemeral: true,
    });

    const collector = response.createMessageComponentCollector({
      time: 900000, // 15分間受付
    });

    collector.on("collect", async (i) => {
      // 本人のみ操作可能
      if (i.user.id !== interaction.user.id) {
        await i.reply({ content: "⚠️ コマンド実行者のみ操作できます。", ephemeral: true });
        return;
      }

      await i.deferUpdate().catch(() => {});

      // A. メインメニューの選択
      if (i.isStringSelectMenu() && i.customId === "menu_select_category") {
        const category = i.values[0];

        // 1. 管理者ロール設定
        if (category === "opt_admin_roles") {
          const current = formatRolesText(settings.admin_role_ids);
          const embed = createBaseEmbed(
            "👑 管理者ロール設定",
            "**Botのすべての権限（設定変更、全コマンド操作）を持つロールを設定します。**\n\n" +
            `現在設定中のロール: ${current}\n\n` +
            "※ 下のロール選択メニューから1つまたは複数選択してください（選択解除する場合は空で送信）。",
            "#F1C40F"
          );

          const roleSelect = new RoleSelectMenuBuilder()
            .setCustomId("role_select_admin")
            .setPlaceholder("👑 管理者ロールを選択（複数選択可）")
            .setMinValues(0)
            .setMaxValues(25);

          const backBtn = new ButtonBuilder()
            .setCustomId("btn_back_main")
            .setLabel("🔙 メイン設定に戻る")
            .setStyle(ButtonStyle.Secondary);

          await i.editReply({
            embeds: [embed],
            components: [
              new ActionRowBuilder().addComponents(roleSelect),
              new ActionRowBuilder().addComponents(backBtn),
            ],
          });
        }
        // 2. マイル付与ロール設定
        else if (category === "opt_mile_grant_roles") {
          const current = formatRolesText(settings.mile_grant_role_ids);
          const embed = createBaseEmbed(
            "🌟 マイル付与ロール設定",
            "**`/マイル付与` や `/マイル没収` を実行できるスタッフロールを設定します。**\n\n" +
            `現在設定中のロール: ${current}\n\n` +
            "※ このロールを持つメンバーは住民へのマイル付与・没収操作が可能になります。",
            "#3498DB"
          );

          const roleSelect = new RoleSelectMenuBuilder()
            .setCustomId("role_select_mile_grant")
            .setPlaceholder("🌟 マイル付与ロールを選択（複数選択可）")
            .setMinValues(0)
            .setMaxValues(25);

          const backBtn = new ButtonBuilder()
            .setCustomId("btn_back_main")
            .setLabel("🔙 メイン設定に戻る")
            .setStyle(ButtonStyle.Secondary);

          await i.editReply({
            embeds: [embed],
            components: [
              new ActionRowBuilder().addComponents(roleSelect),
              new ActionRowBuilder().addComponents(backBtn),
            ],
          });
        }
        // 3. チケット付与ロール設定
        else if (category === "opt_ticket_grant_roles") {
          const current = formatRolesText(settings.ticket_grant_role_ids);
          const embed = createBaseEmbed(
            "🎫 チケット付与ロール設定",
            "**`/チケット付与` や `/チケット没収` を実行できるスタッフロールを設定します。**\n\n" +
            `現在設定中のロール: ${current}\n\n` +
            "※ このロールを持つメンバーは住民への図鑑チケット付与・没収操作が可能になります。",
            "#E67E22"
          );

          const roleSelect = new RoleSelectMenuBuilder()
            .setCustomId("role_select_ticket_grant")
            .setPlaceholder("🎫 チケット付与ロールを選択（複数選択可）")
            .setMinValues(0)
            .setMaxValues(25);

          const backBtn = new ButtonBuilder()
            .setCustomId("btn_back_main")
            .setLabel("🔙 メイン設定に戻る")
            .setStyle(ButtonStyle.Secondary);

          await i.editReply({
            embeds: [embed],
            components: [
              new ActionRowBuilder().addComponents(roleSelect),
              new ActionRowBuilder().addComponents(backBtn),
            ],
          });
        }
        // 4. ミッション承認スタッフロール設定
        else if (category === "opt_mission_staff_roles") {
          const current = formatRolesText(settings.mission_staff_role_ids);
          const embed = createBaseEmbed(
            "📸 ミッション承認スタッフロール設定",
            "**`/ミッション報告` で送信された達成報告を承認できるスタッフロールを設定します。**\n\n" +
            `現在設定中のロール: ${current}\n\n` +
            "※ このロールを持つメンバーは承認ボタンを押してマイルを付与できます。",
            "#2ECC71"
          );

          const roleSelect = new RoleSelectMenuBuilder()
            .setCustomId("role_select_mission_staff")
            .setPlaceholder("📸 ミッション承認スタッフロールを選択（複数選択可）")
            .setMinValues(0)
            .setMaxValues(25);

          const backBtn = new ButtonBuilder()
            .setCustomId("btn_back_main")
            .setLabel("🔙 メイン設定に戻る")
            .setStyle(ButtonStyle.Secondary);

          await i.editReply({
            embeds: [embed],
            components: [
              new ActionRowBuilder().addComponents(roleSelect),
              new ActionRowBuilder().addComponents(backBtn),
            ],
          });
        }
        // 5. 通知・報告チャンネル設定
        else if (category === "opt_notify_channels") {
          const ticketChannel = formatChannelText(settings.ticket_notify_channel_id);
          const missionChannel = formatChannelText(settings.mission_report_channel_id);

          const embed = createBaseEmbed(
            "📢 通知・報告チャンネル設定",
            "**チケット獲得通知やミッション報告を受信するチャンネルを設定します。**\n\n" +
            `・**チケット獲得通知先**: ${ticketChannel}\n` +
            `・**ミッション報告受付先**: ${missionChannel}\n\n` +
            "※ 下のチャンネル選択メニューから各通知先チャンネルを設定してください。",
            "#34495E"
          );

          const ticketChannelSelect = new ChannelSelectMenuBuilder()
            .setCustomId("channel_select_ticket_notify")
            .setPlaceholder("🎫 チケット獲得通知チャンネルを選択")
            .setChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement);

          const missionChannelSelect = new ChannelSelectMenuBuilder()
            .setCustomId("channel_select_mission_report")
            .setPlaceholder("📸 ミッション報告受付チャンネルを選択")
            .setChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement);

          const backBtn = new ButtonBuilder()
            .setCustomId("btn_back_main")
            .setLabel("🔙 メイン設定に戻る")
            .setStyle(ButtonStyle.Secondary);

          await i.editReply({
            embeds: [embed],
            components: [
              new ActionRowBuilder().addComponents(ticketChannelSelect),
              new ActionRowBuilder().addComponents(missionChannelSelect),
              new ActionRowBuilder().addComponents(backBtn),
            ],
          });
        }
      }

      // B. ロール選択の保存
      else if (i.isRoleSelectMenu()) {
        const selectedRoleIds = i.values;

        if (i.customId === "role_select_admin") {
          settings.admin_role_ids = selectedRoleIds;
          await saveDoumoriSettings(guildId, { admin_role_ids: selectedRoleIds });
        } else if (i.customId === "role_select_mile_grant") {
          settings.mile_grant_role_ids = selectedRoleIds;
          await saveDoumoriSettings(guildId, { mile_grant_role_ids: selectedRoleIds });
        } else if (i.customId === "role_select_ticket_grant") {
          settings.ticket_grant_role_ids = selectedRoleIds;
          await saveDoumoriSettings(guildId, { ticket_grant_role_ids: selectedRoleIds });
        } else if (i.customId === "role_select_mission_staff") {
          settings.mission_staff_role_ids = selectedRoleIds;
          await saveDoumoriSettings(guildId, { mission_staff_role_ids: selectedRoleIds });
        }

        settings = await getDoumoriSettings(guildId);
        const updatedEmbed = buildMainMenuEmbed(settings);
        const updatedRows = buildMainMenuComponents();

        await i.editReply({
          content: "✅ **ロール設定を保存しました！**",
          embeds: [updatedEmbed],
          components: updatedRows,
        });
      }

      // C. チャンネル選択の保存
      else if (i.isChannelSelectMenu()) {
        const channelId = i.values[0];

        if (i.customId === "channel_select_ticket_notify") {
          settings.ticket_notify_channel_id = channelId;
          await saveDoumoriSettings(guildId, { ticket_notify_channel_id: channelId });
        } else if (i.customId === "channel_select_mission_report") {
          settings.mission_report_channel_id = channelId;
          await saveDoumoriSettings(guildId, { mission_report_channel_id: channelId });
        }

        settings = await getDoumoriSettings(guildId);
        const updatedEmbed = buildMainMenuEmbed(settings);
        const updatedRows = buildMainMenuComponents();

        await i.editReply({
          content: "✅ **通知チャンネル設定を保存しました！**",
          embeds: [updatedEmbed],
          components: updatedRows,
        });
      }

      // D. メインメニューに戻るボタン
      else if (i.isButton() && i.customId === "btn_back_main") {
        settings = await getDoumoriSettings(guildId);
        const mainEmbed = buildMainMenuEmbed(settings);
        const mainRows = buildMainMenuComponents();

        await i.editReply({
          content: null,
          embeds: [mainEmbed],
          components: mainRows,
        });
      }
    });
  },
};

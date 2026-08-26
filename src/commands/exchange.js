import {
  SlashCommandBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
} from "discord.js";
import { CONFIG } from "../config.js";
import {
  getUser,
  getUserMiles,
  buyTicketsWithMiles,
  getDoumoriSettings,
} from "../database/db.js";
import { createBaseEmbed } from "../utils/embedBuilder.js";

export const command = {
  ephemeral: true,
  data: new SlashCommandBuilder()
    .setName("両替")
    .setDescription("マイルポイントを図鑑チケットに両替します（100pt ➔ 1枚）🔀")
    .addIntegerOption((option) =>
      option
        .setName("amount")
        .setDescription("両替するチケット枚数（1枚 = 100pt）")
        .setRequired(false)
        .setMinValue(1)
    ),

  async execute(interaction) {
    if (!interaction.deferred && !interaction.replied) {
      await interaction.deferReply({ ephemeral: true }).catch(() => {});
    }

    const guildId = interaction.guild.id;
    const userId = interaction.user.id;
    const specifiedAmount = interaction.options && interaction.options.getInteger("amount");

    const settings = await getDoumoriSettings(guildId);
    const mileRate = (settings.miles_per_ticket && !isNaN(parseInt(settings.miles_per_ticket, 10)))
      ? parseInt(settings.miles_per_ticket, 10)
      : (CONFIG.EXCHANGE_RATES.MILES_PER_TICKET || 100);

    let userMiles = await getUserMiles(guildId, userId);
    let userData = await getUser(guildId, userId);

    // 枚数指定がある場合は即時両替実行
    if (specifiedAmount && specifiedAmount >= 1) {
      const result = await buyTicketsWithMiles(guildId, userId, specifiedAmount);
      if (!result.success) {
        const errorEmbed = createBaseEmbed(
          "⚠️ マイルポイント不足",
          `図鑑チケット **${specifiedAmount}** 枚と両替するには **${result.needed.toLocaleString()}** pt が必要です。\n（現在の所持マイル: **${result.current.toLocaleString()}** pt）`,
          "#E74C3C"
        );
        await interaction.followUp({ embeds: [errorEmbed] });
        return;
      }

      const embed = createBaseEmbed(
        "🔀 マイル両替完了！",
        `**${result.spentMiles.toLocaleString()}** pt を両替して、**図鑑チケット ×${result.ticketCount}** を入手しました！`,
        "#2ECC71"
      );

      embed.addFields(
        { name: "🎫 所持チケット", value: `**${result.newTickets}** 枚`, inline: true },
        { name: "🌟 所持マイル", value: `**${result.newMiles.toLocaleString()}** pt`, inline: true }
      );

      await interaction.followUp({ embeds: [embed] });
      return;
    }

    // オプション未指定（またはパネルボタンからの実行）時はインタラクティブメニューを表示
    const buildExchangeEmbed = (uMiles, uData, notice = "") => {
      const embed = createBaseEmbed(
        "🔀 案内所両替所 - マイル両替",
        notice
          ? `${notice}\n\n・🌟 **${mileRate} マイル** ➔ 🎫 **図鑑チケット ×1**\n\n下のボタンを押すと指定枚数に両替できます。`
          : "マイルポイントを図鑑チケットに両替します！\n\n" +
            `・🌟 **${mileRate} マイル** ➔ 🎫 **図鑑チケット ×1**\n\n` +
            "下のボタンを押すと指定枚数に両替できます。\n*(※任意の枚数を指定したい場合は `/両替 amount:[枚数]` を実行してください)*",
        "#3498DB"
      );

      embed.addFields(
        { name: "🌟 所持マイル", value: `**${uMiles.miles.toLocaleString()}** pt`, inline: true },
        { name: "🎫 所持チケット", value: `**${uData.tickets}** 枚`, inline: true }
      );

      return embed;
    };

    const buildExchangeRows = (uMiles) => {
      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("ex_miles_1")
          .setLabel(`🎫 チケット×1に両替 (${mileRate}pt)`)
          .setStyle(ButtonStyle.Primary)
          .setDisabled(uMiles.miles < mileRate),
        new ButtonBuilder()
          .setCustomId("ex_miles_5")
          .setLabel(`🎫 チケット×5に両替 (${mileRate * 5}pt)`)
          .setStyle(ButtonStyle.Primary)
          .setDisabled(uMiles.miles < mileRate * 5),
        new ButtonBuilder()
          .setCustomId("ex_miles_10")
          .setLabel(`🎫 チケット×10に両替 (${(mileRate * 10).toLocaleString()}pt)`)
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(uMiles.miles < mileRate * 10)
      );

      return [row];
    };

    const menuEmbed = buildExchangeEmbed(userMiles, userData);
    const rows = buildExchangeRows(userMiles);

    const replyMsg = await interaction.followUp({
      embeds: [menuEmbed],
      components: rows,
    });

    const collector = replyMsg.createMessageComponentCollector({
      componentType: ComponentType.Button,
      time: 60000,
    });

    collector.on("collect", async (i) => {
      if (i.user.id !== userId) {
        await i.reply({ content: "他のユーザーの両替操作は行えません。", ephemeral: true });
        return;
      }

      await i.deferUpdate();

      let buyCount = 1;
      if (i.customId === "ex_miles_5") buyCount = 5;
      if (i.customId === "ex_miles_10") buyCount = 10;

      const res = await buyTicketsWithMiles(guildId, userId, buyCount);
      let noticeText = "";

      if (!res.success) {
        noticeText = `⚠️ **マイルが不足しています**（必要: ${res.needed.toLocaleString()}pt / 所持: ${res.current.toLocaleString()}pt）`;
      } else {
        noticeText = `✅ **${res.spentMiles.toLocaleString()}** pt を両替して **図鑑チケット ×${res.ticketCount}** を入手しました！`;
      }

      // 最新残高再取得
      userMiles = await getUserMiles(guildId, userId);
      userData = await getUser(guildId, userId);

      const updatedEmbed = buildExchangeEmbed(userMiles, userData, noticeText);
      const updatedRows = buildExchangeRows(userMiles);

      await i.editReply({ embeds: [updatedEmbed], components: updatedRows });
    });

    collector.on("end", async () => {
      await interaction.editReply({ components: [] }).catch(() => {});
    });
  },
};


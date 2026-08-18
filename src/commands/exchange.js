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
  addTickets,
  getManybotBalance,
  addManybotBalance,
  buyTicketsWithMiles,
} from "../database/db.js";
import { createBaseEmbed } from "../utils/embedBuilder.js";

export const command = {
  ephemeral: true,
  data: new SlashCommandBuilder()
    .setName("両替")
    .setDescription("マイルやベルを使って図鑑チケットと交換・両替します🔀")
    .addStringOption((option) =>
      option
        .setName("action")
        .setDescription("両替・購入の種別を選択してください")
        .setRequired(false)
        .addChoices(
          { name: "🌟 マイル ➔ 🎫 図鑑チケット (100ptで1枚)", value: "miles_to_ticket" },
          { name: "🪙 ベル ➔ 🎫 図鑑チケット (500ベルで1枚)", value: "to_ticket" },
          { name: "🎫 図鑑チケット ➔ 🪙 ベル (1枚で500ベル)", value: "to_coin" }
        )
    )
    .addIntegerOption((option) =>
      option
        .setName("amount")
        .setDescription("交換する数量（チケット枚数、またはベル数に応じた数量）")
        .setRequired(false)
        .setMinValue(1)
    ),

  async execute(interaction) {
    if (!interaction.deferred && !interaction.replied) {
      await interaction.deferReply({ ephemeral: true }).catch(() => {});
    }

    const guildId = interaction.guild.id;
    const userId = interaction.user.id;
    const hasExplicitOption = interaction.options && interaction.options.getString("action");
    let action = hasExplicitOption ? interaction.options.getString("action") : null;
    let amount = (interaction.options && interaction.options.getInteger("amount")) || 1;

    const bellRate = CONFIG.EXCHANGE_RATES.MANYBOT_PER_TICKET || 500;
    const mileRate = CONFIG.EXCHANGE_RATES.MILES_PER_TICKET || 100;

    let manybotBalance = await getManybotBalance(guildId, userId);
    let userMiles = await getUserMiles(guildId, userId);
    let userData = await getUser(guildId, userId);

    // オプション未指定（またはパネルボタンからの実行）時はインタラクティブメニューを表示
    if (!action) {
      const menuEmbed = createBaseEmbed(
        "🔀 案内所両替所 - 両替メニュー",
        "交換したい両替メニューを下のボタンから選択してください！\n\n" +
        `・🌟 **マイル ➔ チケット**: **${mileRate}** pt ➔ チケット ×1\n` +
        `・🪙 **ベル ➔ チケット**: **${bellRate.toLocaleString()}** ベル ➔ チケット ×1\n` +
        `・🎫 **チケット ➔ ベル**: チケット ×1 ➔ **${bellRate.toLocaleString()}** ベル\n\n` +
        "※複数枚をまとめて交換したい場合は `/両替 action:[種別] amount:[枚数]` を実行してください。",
        "#3498DB"
      );

      menuEmbed.addFields(
        { name: "🌟 所持マイル", value: `**${userMiles.miles.toLocaleString()}** pt`, inline: true },
        { name: "🪙 ベル残高", value: `**${manybotBalance.toLocaleString()}** ベル`, inline: true },
        { name: "🎫 所持チケット", value: `**${userData.tickets}** 枚`, inline: true }
      );

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("ex_miles_to_ticket")
          .setLabel(`🌟 マイル➔チケット (${mileRate}pt)`)
          .setStyle(ButtonStyle.Primary)
          .setDisabled(userMiles.miles < mileRate),
        new ButtonBuilder()
          .setCustomId("ex_to_ticket")
          .setLabel(`🪙 ベル➔チケット (${bellRate}ベル)`)
          .setStyle(ButtonStyle.Success)
          .setDisabled(manybotBalance < bellRate),
        new ButtonBuilder()
          .setCustomId("ex_to_coin")
          .setLabel(`🎫 チケット➔ベル (${bellRate}ベル)`)
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(userData.tickets < 1)
      );

      const replyMsg = await interaction.followUp({
        embeds: [menuEmbed],
        components: [row],
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

        if (i.customId === "ex_miles_to_ticket") {
          const res = await buyTicketsWithMiles(guildId, userId, 1);
          if (!res.success) {
            await i.followUp({ content: `⚠️ マイルが不足しています（必要: ${res.needed}pt / 所持: ${res.current}pt）`, ephemeral: true });
            return;
          }
        } else if (i.customId === "ex_to_ticket") {
          const curBal = await getManybotBalance(guildId, userId);
          if (curBal < bellRate) {
            await i.followUp({ content: `⚠️ ベルが不足しています（必要: ${bellRate}ベル）`, ephemeral: true });
            return;
          }
          await addManybotBalance(guildId, userId, -bellRate);
          await addTickets(guildId, userId, 1);
        } else if (i.customId === "ex_to_coin") {
          const curUser = await getUser(guildId, userId);
          if (curUser.tickets < 1) {
            await i.followUp({ content: "⚠️ チケットが不足しています", ephemeral: true });
            return;
          }
          await addTickets(guildId, userId, -1);
          await addManybotBalance(guildId, userId, bellRate);
        }

        // 最新残高再取得
        manybotBalance = await getManybotBalance(guildId, userId);
        userMiles = await getUserMiles(guildId, userId);
        userData = await getUser(guildId, userId);

        const updatedEmbed = createBaseEmbed(
          "✅ 両替が完了しました！",
          "最新の所持残高は以下の通りです。",
          "#2ECC71"
        );
        updatedEmbed.addFields(
          { name: "🌟 所持マイル", value: `**${userMiles.miles.toLocaleString()}** pt`, inline: true },
          { name: "🪙 ベル残高", value: `**${manybotBalance.toLocaleString()}** ベル`, inline: true },
          { name: "🎫 所持チケット", value: `**${userData.tickets}** 枚`, inline: true }
        );

        const updatedRow = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId("ex_miles_to_ticket")
            .setLabel(`🌟 マイル➔チケット (${mileRate}pt)`)
            .setStyle(ButtonStyle.Primary)
            .setDisabled(userMiles.miles < mileRate),
          new ButtonBuilder()
            .setCustomId("ex_to_ticket")
            .setLabel(`🪙 ベル➔チケット (${bellRate}ベル)`)
            .setStyle(ButtonStyle.Success)
            .setDisabled(manybotBalance < bellRate),
          new ButtonBuilder()
            .setCustomId("ex_to_coin")
            .setLabel(`🎫 チケット➔ベル (${bellRate}ベル)`)
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(userData.tickets < 1)
        );

        await i.editReply({ embeds: [updatedEmbed], components: [updatedRow] });
      });

      collector.on("end", async () => {
        await interaction.editReply({ components: [] }).catch(() => {});
      });

      return;
    }

    if (action === "miles_to_ticket") {
      const result = await buyTicketsWithMiles(guildId, userId, amount);
      if (!result.success) {
        const errorEmbed = createBaseEmbed(
          "⚠️ マイルポイント不足",
          `チケット **${amount}** 枚と交換するには **${result.needed}** pt が必要です。\n（現在の所持マイル: **${result.current}** pt）`,
          "#E74C3C"
        );
        await interaction.followUp({ embeds: [errorEmbed] });
        return;
      }

      const embed = createBaseEmbed(
        "🔀 マイル交換完了！",
        `**${result.spentMiles}** pt を消費して、**図鑑チケット ×${result.ticketCount}** を入手しました！`,
        "#2ECC71"
      );

      embed.addFields(
        { name: "🎫 所持チケット", value: `**${result.newTickets}** 枚`, inline: true },
        { name: "🌟 所持マイル", value: `**${result.newMiles}** pt`, inline: true }
      );

      await interaction.followUp({ embeds: [embed] });
    } else if (action === "to_ticket") {
      // 必要なベル
      const requiredBells = amount * bellRate;
      if (manybotBalance < requiredBells) {
        const errorEmbed = createBaseEmbed(
          "⚠️ ベル不足",
          `チケット **${amount}** 枚と交換するには **${requiredBells.toLocaleString()}** ベルが必要です。\n（現在の所持ベル: **${manybotBalance.toLocaleString()}** ベル）`,
          "#E74C3C"
        );
        await interaction.followUp({ embeds: [errorEmbed] });
        return;
      }

      // ベル減額 ＆ チケット増額
      await addManybotBalance(guildId, userId, -requiredBells);
      const newTickets = await addTickets(guildId, userId, amount);
      const newBalance = await getManybotBalance(guildId, userId);

      const embed = createBaseEmbed(
        "🔀 ベル両替完了！",
        `**${requiredBells.toLocaleString()}** ベル を消費して、**図鑑チケット ×${amount}** を入手しました！`,
        "#F1C40F"
      );

      embed.addFields(
        { name: "🎫 所持チケット", value: `**${newTickets}** 枚`, inline: true },
        { name: "🪙 ベル残高", value: `**${newBalance.toLocaleString()}** ベル`, inline: true }
      );

      await interaction.followUp({ embeds: [embed] });
    } else if (action === "to_coin") {
      if (userData.tickets < amount) {
        const errorEmbed = createBaseEmbed(
          "⚠️ チケット不足",
          `両替に必要な図鑑チケットが不足しています。\n（所持チケット: **${userData.tickets}** 枚 / 必要: **${amount}** 枚）`,
          "#E74C3C"
        );
        await interaction.followUp({ embeds: [errorEmbed] });
        return;
      }

      const gainedBells = amount * bellRate;

      // チケット減額 ＆ ベル増額
      await addTickets(guildId, userId, -amount);
      await addManybotBalance(guildId, userId, gainedBells);

      const newTickets = await addTickets(guildId, userId, 0);
      const newBalance = await getManybotBalance(guildId, userId);

      const embed = createBaseEmbed(
        "🔀 ベル換金完了！",
        `**図鑑チケット ×${amount}** を消費して、**${gainedBells.toLocaleString()}** ベル を獲得しました！`,
        "#F1C40F"
      );

      embed.addFields(
        { name: "🎫 所持チケット", value: `**${newTickets}** 枚`, inline: true },
        { name: "🪙 ベル残高", value: `**${newBalance.toLocaleString()}** ベル`, inline: true }
      );

      await interaction.followUp({ embeds: [embed] });
    }
  },
};

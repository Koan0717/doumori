import { SlashCommandBuilder } from "discord.js";
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
          { name: "🔔 ベル ➔ 🎫 図鑑チケット (500ベルで1枚)", value: "to_ticket" },
          { name: "🎫 図鑑チケット ➔ 🔔 ベル (1枚で500ベル)", value: "to_coin" }
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
      await interaction.deferReply({ ephemeral: interaction.isButton() }).catch(() => {});
    }

    const guildId = interaction.guild.id;
    const userId = interaction.user.id;
    const action = interaction.options ? (interaction.options.getString("action") || "miles_to_ticket") : "miles_to_ticket";
    const amount = interaction.options ? (interaction.options.getInteger("amount") || 1) : 1;

    const bellRate = CONFIG.EXCHANGE_RATES.MANYBOT_PER_TICKET || 500;
    const mileRate = CONFIG.EXCHANGE_RATES.MILES_PER_TICKET || 100;

    const manybotBalance = await getManybotBalance(guildId, userId);
    const userMiles = await getUserMiles(guildId, userId);
    const userData = await getUser(guildId, userId);

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
        { name: "🔔 ベル残高", value: `**${newBalance.toLocaleString()}** ベル`, inline: true }
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
        { name: "🔔 ベル残高", value: `**${newBalance.toLocaleString()}** ベル`, inline: true }
      );

      await interaction.followUp({ embeds: [embed] });
    }
  },
};

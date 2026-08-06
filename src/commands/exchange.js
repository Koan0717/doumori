import { SlashCommandBuilder } from "discord.js";
import { CONFIG } from "../config.js";
import { getUser, addTickets, getManybotBalance, addManybotBalance } from "../database/db.js";
import { createBaseEmbed } from "../utils/embedBuilder.js";

export const command = {
  data: new SlashCommandBuilder()
    .setName("exchange")
    .setDescription("manybotの通貨と図鑑チケットを交換・相互両替します🔀")
    .addStringOption((option) =>
      option
        .setName("action")
        .setDescription("両替の方向を選択してください")
        .setRequired(true)
        .addChoices(
          { name: "🪙 manybotコイン ➔ 🎫 図鑑チケット (500コインで1枚)", value: "to_ticket" },
          { name: "🎫 図鑑チケット ➔ 🪙 manybotコイン (1枚で500コイン)", value: "to_coin" }
        )
    )
    .addIntegerOption((option) =>
      option
        .setName("amount")
        .setDescription("両替する数量（チケット枚数、またはコイン数に応じた数量）")
        .setRequired(false)
        .setMinValue(1)
    ),

  async execute(interaction) {
    await interaction.deferReply();

    const guildId = interaction.guild.id;
    const userId = interaction.user.id;
    const action = interaction.options.getString("action");
    const amount = interaction.options.getInteger("amount") || 1;

    const rate = CONFIG.EXCHANGE_RATES.MANYBOT_PER_TICKET; // 500
    const manybotBalance = await getManybotBalance(guildId, userId);
    const userData = await getUser(guildId, userId);

    if (action === "to_ticket") {
      // 必要なmanybotコイン
      const requiredCoins = amount * rate;
      if (manybotBalance < requiredCoins) {
        const errorEmbed = createBaseEmbed(
          "⚠️ コイン不足",
          `チケット **${amount}** 枚と交換するには **${requiredCoins}** コインが必要です。\n（現在の所持コイン: **${manybotBalance}** コイン）`,
          "#E74C3C"
        );
        await interaction.followup.send({ embeds: [errorEmbed] });
        return;
      }

      // manybotコイン減額 ＆ チケット増額
      await addManybotBalance(guildId, userId, -requiredCoins);
      const newTickets = await addTickets(guildId, userId, amount);
      const newBalance = await getManybotBalance(guildId, userId);

      const embed = createBaseEmbed(
        "🔀 通貨両替完了！",
        `**${requiredCoins}** manybotコイン を消費して、**図鑑チケット ×${amount}** を入手しました！`,
        "#F1C40F"
      );

      embed.addFields(
        { name: "🎫 所持チケット", value: `**${newTickets}** 枚`, inline: true },
        { name: "🪙 manybot残高", value: `**${newBalance}** コイン`, inline: true }
      );

      await interaction.followup.send({ embeds: [embed] });
    } else if (action === "to_coin") {
      if (userData.tickets < amount) {
        const errorEmbed = createBaseEmbed(
          "⚠️ チケット不足",
          `両替に必要な図鑑チケットが不足しています。\n（所持チケット: **${userData.tickets}** 枚 / 必要: **${amount}** 枚）`,
          "#E74C3C"
        );
        await interaction.followup.send({ embeds: [errorEmbed] });
        return;
      }

      const gainedCoins = amount * rate;

      // チケット減額 ＆ manybotコイン増額
      await addTickets(guildId, userId, -amount);
      await addManybotBalance(guildId, userId, gainedCoins);

      const newTickets = await addTickets(guildId, userId, 0);
      const newBalance = await getManybotBalance(guildId, userId);

      const embed = createBaseEmbed(
        "🔀 通貨両替完了！",
        `**図鑑チケット ×${amount}** を消費して、**${gainedCoins}** manybotコイン を獲得しました！`,
        "#F1C40F"
      );

      embed.addFields(
        { name: "🎫 所持チケット", value: `**${newTickets}** 枚`, inline: true },
        { name: "🪙 manybot残高", value: `**${newBalance}** コイン`, inline: true }
      );

      await interaction.followup.send({ embeds: [embed] });
    }
  },
};

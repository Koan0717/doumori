import {
  SlashCommandBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
} from "discord.js";
import { getUser, addTickets, addInventoryItem, getItemCount } from "../database/db.js";
import { createBaseEmbed } from "../utils/embedBuilder.js";

export const command = {
  data: new SlashCommandBuilder()
    .setName("shop")
    .setDescription("図鑑チケットを使って道具（つりざお・虫取り網）を交換します🏪"),

  async execute(interaction) {
    await interaction.deferReply();

    const guildId = interaction.guild.id;
    const userId = interaction.user.id;

    const userData = await getUser(guildId, userId);
    const rodCount = await getItemCount(guildId, userId, "fishing_rod");
    const netCount = await getItemCount(guildId, userId, "bug_net");

    const embed = createBaseEmbed(
      "🏪 タヌキ道具店 - アイテム交換",
      "所持している **図鑑チケット** を使って採集道具と交換できます！\n※道具は1回使用すると消費されます。",
      "#2ECC71"
    );

    embed.addFields(
      { name: "🎫 所持チケット", value: `**${userData.tickets}** 枚`, inline: false },
      { name: "🐟 魚釣りセット", value: `・つりざお (チケット ×1)\n・現在の所持数: **${rodCount}** 本`, inline: true },
      { name: "🦋 虫取りセット", value: `・虫取り網 (チケット ×1)\n・現在の所持数: **${netCount}** 本`, inline: true }
    );

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("buy_rod")
        .setLabel("🐟 つりざおを交換 (1枚)")
        .setStyle(ButtonStyle.Primary)
        .setDisabled(userData.tickets < 1),
      new ButtonBuilder()
        .setCustomId("buy_net")
        .setLabel("🦋 虫取り網を交換 (1枚)")
        .setStyle(ButtonStyle.Success)
        .setDisabled(userData.tickets < 1)
    );

    const replyMsg = await interaction.followup.send({
      embeds: [embed],
      components: [row],
    });

    const collector = replyMsg.createMessageComponentCollector({
      componentType: ComponentType.Button,
      time: 60000,
    });

    collector.on("collect", async (i) => {
      if (i.user.id !== userId) {
        await i.reply({ content: "他のユーザーのショップ操作は行えません。", ephemeral: true });
        return;
      }

      await i.deferUpdate();

      // 最新のチケット数を再取得
      const currentMember = await getUser(guildId, userId);
      if (currentMember.tickets < 1) {
        await i.followup({ content: "図鑑チケットが不足しています！", ephemeral: true });
        return;
      }

      let boughtItemName = "";
      if (i.customId === "buy_rod") {
        await addTickets(guildId, userId, -1);
        await addInventoryItem(guildId, userId, "fishing_rod", 1);
        boughtItemName = "🐟 つりざお";
      } else if (i.customId === "buy_net") {
        await addTickets(guildId, userId, -1);
        await addInventoryItem(guildId, userId, "bug_net", 1);
        boughtItemName = "🦋 虫取り網";
      }

      // 表示更新
      const updatedUser = await getUser(guildId, userId);
      const updatedRod = await getItemCount(guildId, userId, "fishing_rod");
      const updatedNet = await getItemCount(guildId, userId, "bug_net");

      const newEmbed = createBaseEmbed(
        "🏪 タヌキ道具店 - アイテム交換",
        `✅ **${boughtItemName}** を1つ交換しました！`,
        "#2ECC71"
      );

      newEmbed.addFields(
        { name: "🎫 所持チケット", value: `**${updatedUser.tickets}** 枚`, inline: false },
        { name: "🐟 魚釣りセット", value: `・つりざお (チケット ×1)\n・現在の所持数: **${updatedRod}** 本`, inline: true },
        { name: "🦋 虫取りセット", value: `・虫取り網 (チケット ×1)\n・現在の所持数: **${updatedNet}** 本`, inline: true }
      );

      const newRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("buy_rod")
          .setLabel("🐟 つりざおを交換 (1枚)")
          .setStyle(ButtonStyle.Primary)
          .setDisabled(updatedUser.tickets < 1),
        new ButtonBuilder()
          .setCustomId("buy_net")
          .setLabel("🦋 虫取り網を交換 (1枚)")
          .setStyle(ButtonStyle.Success)
          .setDisabled(updatedUser.tickets < 1)
      );

      await i.editReply({ embeds: [newEmbed], components: [newRow] });
    });

    collector.on("end", async () => {
      const disabledRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId("buy_rod").setLabel("🐟 つりざおを交換").setStyle(ButtonStyle.Primary).setDisabled(true),
        new ButtonBuilder().setCustomId("buy_net").setLabel("🦋 虫取り網を交換").setStyle(ButtonStyle.Success).setDisabled(true)
      );
      await interaction.editReply({ components: [disabledRow] }).catch(() => {});
    });
  },
};

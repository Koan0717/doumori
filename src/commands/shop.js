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
  addInventoryItem,
  getItemCount,
  buyTicketsWithMiles,
  getDoumoriSettings,
} from "../database/db.js";
import { createBaseEmbed } from "../utils/embedBuilder.js";

export const command = {
  ephemeral: true,
  data: new SlashCommandBuilder()
    .setName("ショップ")
    .setDescription("マイルでチケットを購入したり、チケットで道具（つりざお・虫取り網）を交換します🏪"),

  async execute(interaction) {
    if (!interaction.deferred && !interaction.replied) {
      await interaction.deferReply({ ephemeral: true }).catch(() => {});
    }

    const guildId = interaction.guild.id;
    const userId = interaction.user.id;

    const settings = await getDoumoriSettings(guildId);
    const mileRate = (settings.miles_per_ticket && !isNaN(parseInt(settings.miles_per_ticket, 10)))
      ? parseInt(settings.miles_per_ticket, 10)
      : (CONFIG.EXCHANGE_RATES.MILES_PER_TICKET || 100);

    const userData = await getUser(guildId, userId);
    const userMiles = await getUserMiles(guildId, userId);
    const rodCount = await getItemCount(guildId, userId, "fishing_rod");
    const netCount = await getItemCount(guildId, userId, "bug_net");

    const buildShopEmbed = (uData, mMiles, rCount, nCount, notice = "") => {
      const embed = createBaseEmbed(
        "🏪 タヌキ商店＆案内所 - ショップ",
        notice
          ? `${notice}\n\n**【マイルポイント】** でチケットを購入し、チケットで採集道具を揃えられます！`
          : "所持している **マイルポイント** でチケットを購入したり、**図鑑チケット** を使って採集道具と交換できます！\n※道具は1回使用すると消費されます。",
        "#2ECC71"
      );

      embed.addFields(
        {
          name: "💰 残高情報",
          value: `・🌟 **所持マイル**: **${mMiles.miles}** pt\n・🎫 **所持チケット**: **${uData.tickets}** 枚`,
          inline: false,
        },
        {
          name: "🎫 チケット購入 (マイル交換)",
          value: `・図鑑チケット ×1 (${mileRate}pt)\n・図鑑チケット ×5 (${mileRate * 5}pt)`,
          inline: true,
        },
        {
          name: "🎒 採集道具 (チケット交換)",
          value: `・🐟 つりざお (1枚) [所持: **${rCount}** 本]\n・🦋 虫取り網 (1枚) [所持: **${nCount}** 本]`,
          inline: true,
        }
      );
      return embed;
    };

    const buildRows = (uData, mMiles) => {
      const row1 = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("buy_ticket_1")
          .setLabel(`🎫 チケット×1購入 (${mileRate}pt)`)
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(mMiles.miles < mileRate),
        new ButtonBuilder()
          .setCustomId("buy_ticket_5")
          .setLabel(`🎫 チケット×5購入 (${mileRate * 5}pt)`)
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(mMiles.miles < mileRate * 5)
      );

      const row2 = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("buy_rod")
          .setLabel("🐟 つりざおを交換 (1枚)")
          .setStyle(ButtonStyle.Primary)
          .setDisabled(uData.tickets < 1),
        new ButtonBuilder()
          .setCustomId("buy_net")
          .setLabel("🦋 虫取り網を交換 (1枚)")
          .setStyle(ButtonStyle.Success)
          .setDisabled(uData.tickets < 1)
      );

      return [row1, row2];
    };

    const embed = buildShopEmbed(userData, userMiles, rodCount, netCount);
    const rows = buildRows(userData, userMiles);

    const replyMsg = await interaction.followUp({
      embeds: [embed],
      components: rows,
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

      let noticeText = "";

      if (i.customId === "buy_ticket_1" || i.customId === "buy_ticket_5") {
        const count = i.customId === "buy_ticket_5" ? 5 : 1;
        const result = await buyTicketsWithMiles(guildId, userId, count);
        if (!result.success) {
          await i.followUp({
            content: `⚠️ マイルポイントが不足しています！（必要: ${result.needed}pt / 所持: ${result.current}pt）`,
            ephemeral: true,
          });
          return;
        }
        noticeText = `✅ **${result.spentMiles}** pt を消費して **図鑑チケット ×${result.ticketCount}** を購入しました！`;
      } else if (i.customId === "buy_rod") {
        const curMember = await getUser(guildId, userId);
        if (curMember.tickets < 1) {
          await i.followUp({ content: "図鑑チケットが不足しています！", ephemeral: true });
          return;
        }
        await addTickets(guildId, userId, -1);
        await addInventoryItem(guildId, userId, "fishing_rod", 1);
        noticeText = `✅ **🐟 つりざお** を1つ交換しました！`;
      } else if (i.customId === "buy_net") {
        const curMember = await getUser(guildId, userId);
        if (curMember.tickets < 1) {
          await i.followUp({ content: "図鑑チケットが不足しています！", ephemeral: true });
          return;
        }
        await addTickets(guildId, userId, -1);
        await addInventoryItem(guildId, userId, "bug_net", 1);
        noticeText = `✅ **🦋 虫取り網** を1つ交換しました！`;
      }

      // 最新のデータを再取得
      const updatedUser = await getUser(guildId, userId);
      const updatedMiles = await getUserMiles(guildId, userId);
      const updatedRod = await getItemCount(guildId, userId, "fishing_rod");
      const updatedNet = await getItemCount(guildId, userId, "bug_net");

      const newEmbed = buildShopEmbed(updatedUser, updatedMiles, updatedRod, updatedNet, noticeText);
      const newRows = buildRows(updatedUser, updatedMiles);

      await i.editReply({ embeds: [newEmbed], components: newRows });
    });

    collector.on("end", async () => {
      const disabledRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId("disabled_1").setLabel("🎫 チケット購入").setStyle(ButtonStyle.Secondary).setDisabled(true),
        new ButtonBuilder().setCustomId("disabled_2").setLabel("🐟 つりざお").setStyle(ButtonStyle.Primary).setDisabled(true),
        new ButtonBuilder().setCustomId("disabled_3").setLabel("🦋 虫取り網").setStyle(ButtonStyle.Success).setDisabled(true)
      );
      await interaction.editReply({ components: [disabledRow] }).catch(() => {});
    });
  },
};

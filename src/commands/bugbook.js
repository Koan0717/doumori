import {
  SlashCommandBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
} from "discord.js";
import { BUG_LIST } from "../data/bugs.js";
import { getUserCollection } from "../database/db.js";
import { createBaseEmbed, createProgressBar } from "../utils/embedBuilder.js";

export const command = {
  data: new SlashCommandBuilder()
    .setName("虫図鑑")
    .setDescription("虫図鑑と図鑑達成率を確認します🦋"),

  async execute(interaction) {
    if (!interaction.deferred && !interaction.replied) {
      await interaction.deferReply().catch(() => {});
    }

    const guildId = interaction.guild.id;
    const userId = interaction.user.id;

    const userCatches = await getUserCollection(guildId, userId, "bug");
    const catchMap = new Map(userCatches.map((c) => [c.creature_id, c]));

    const totalBugCount = BUG_LIST.length;
    const caughtUniqueCount = catchMap.size;

    const pageSize = 10;
    const totalPages = Math.ceil(totalBugCount / pageSize);
    let currentPage = 0;

    const generatePageEmbed = (page) => {
      const embed = createBaseEmbed(
        "📖 虫図鑑 (Bug Book)",
        `収集状況: ${createProgressBar(caughtUniqueCount, totalBugCount)}`,
        "#2ECC71"
      );

      const start = page * pageSize;
      const end = start + pageSize;
      const currentList = BUG_LIST.slice(start, end);

      currentList.forEach((bug, idx) => {
        const numStr = String(start + idx + 1).padStart(2, "0");
        const catchData = catchMap.get(bug.id);

        if (catchData) {
          const shinyMark = catchData.has_shiny ? "✨ [金色]" : "";
          embed.addFields({
            name: `#${numStr} ${bug.emoji} ${bug.name} ${shinyMark}`,
            value: `レア度: \`${bug.rarity}\` | 捕獲数: **${catchData.count}** 匹\n*${bug.desc}*`,
            inline: false,
          });
        } else {
          embed.addFields({
            name: `#${numStr} ❓ ？？？`,
            value: `レア度: \`${bug.rarity}\` | 未入手`,
            inline: false,
          });
        }
      });

      embed.setFooter({
        text: `ページ ${page + 1} / ${totalPages} | 🍃 どうぶつの森林 Bot`,
      });

      return embed;
    };

    const getButtons = (page) => {
      return new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("prev")
          .setLabel("◀️ 前のページ")
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(page === 0),
        new ButtonBuilder()
          .setCustomId("next")
          .setLabel("次のページ ▶️")
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(page >= totalPages - 1)
      );
    };

    const replyMsg = await interaction.followUp({
      embeds: [generatePageEmbed(currentPage)],
      components: totalPages > 1 ? [getButtons(currentPage)] : [],
    });

    if (totalPages <= 1) return;

    const collector = replyMsg.createMessageComponentCollector({
      componentType: ComponentType.Button,
      time: 120000,
    });

    collector.on("collect", async (i) => {
      if (i.user.id !== userId) {
        await i.reply({ content: "他のユーザーの図鑑操作は行えません。", ephemeral: true });
        return;
      }

      await i.deferUpdate();

      if (i.customId === "prev" && currentPage > 0) {
        currentPage--;
      } else if (i.customId === "next" && currentPage < totalPages - 1) {
        currentPage++;
      }

      await i.editReply({
        embeds: [generatePageEmbed(currentPage)],
        components: [getButtons(currentPage)],
      });
    });

    collector.on("end", async () => {
      await interaction.editReply({ components: [] }).catch(() => {});
    });
  },
};

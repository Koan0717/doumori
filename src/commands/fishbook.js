import {
  SlashCommandBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
} from "discord.js";
import { FISH_LIST } from "../data/fish.js";
import { getUserCollection } from "../database/db.js";
import { createBaseEmbed, createProgressBar } from "../utils/embedBuilder.js";

export const command = {
  ephemeral: true,
  data: new SlashCommandBuilder()
    .setName("魚図鑑")
    .setDescription("魚図鑑と図鑑達成率を確認します🐟"),

  async execute(interaction) {
    if (!interaction.deferred && !interaction.replied) {
      await interaction.deferReply({ ephemeral: true }).catch(() => {});
    }

    const guildId = interaction.guild.id;
    const userId = interaction.user.id;

    const userCatches = await getUserCollection(guildId, userId, "fish");
    const catchMap = new Map(userCatches.map((c) => [c.creature_id, c]));

    const totalFishCount = FISH_LIST.length;
    const caughtUniqueCount = catchMap.size;

    const pageSize = 10;
    const totalPages = Math.ceil(totalFishCount / pageSize);
    let currentPage = 0;

    const generatePageEmbed = (page) => {
      const embed = createBaseEmbed(
        "📖 魚図鑑 (Fish Book)",
        `収集状況: ${createProgressBar(caughtUniqueCount, totalFishCount)}`,
        "#3498DB"
      );

      const start = page * pageSize;
      const end = start + pageSize;
      const currentList = FISH_LIST.slice(start, end);

      currentList.forEach((fish, idx) => {
        const numStr = String(start + idx + 1).padStart(2, "0");
        const catchData = catchMap.get(fish.id);

        if (catchData) {
          const shinyMark = catchData.has_shiny ? "✨ [金色]" : "";
          embed.addFields({
            name: `#${numStr} ${fish.emoji} ${fish.name} ${shinyMark}`,
            value: `レア度: \`${fish.rarity}\` | 捕獲数: **${catchData.count}** 匹\n*${fish.desc}*`,
            inline: false,
          });
        } else {
          embed.addFields({
            name: `#${numStr} ❓ ？？？`,
            value: `レア度: \`${fish.rarity}\` | 未入手`,
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

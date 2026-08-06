import { SlashCommandBuilder } from "discord.js";
import { FISH_LIST } from "../data/fish.js";
import { BUG_LIST } from "../data/bugs.js";
import {
  getUser,
  getManybotBalance,
  getItemCount,
  getUserCollection,
} from "../database/db.js";
import { createBaseEmbed, createProgressBar } from "../utils/embedBuilder.js";

export const command = {
  data: new SlashCommandBuilder()
    .setName("profile")
    .setDescription("自分の図鑑収集状況・チケット・所持アイテムを確認します📊"),

  async execute(interaction) {
    await interaction.deferReply();

    const guildId = interaction.guild.id;
    const targetUser = interaction.options.getUser("user") || interaction.user;
    const userId = targetUser.id;

    const userData = await getUser(guildId, userId);
    const manybotBalance = await getManybotBalance(guildId, userId);
    const rodCount = await getItemCount(guildId, userId, "fishing_rod");
    const netCount = await getItemCount(guildId, userId, "bug_net");

    const fishCatches = await getUserCollection(guildId, userId, "fish");
    const bugCatches = await getUserCollection(guildId, userId, "bug");

    const fishProgress = createProgressBar(fishCatches.length, FISH_LIST.length);
    const bugProgress = createProgressBar(bugCatches.length, BUG_LIST.length);

    const totalHours = (userData.vc_total_seconds / 3600).toFixed(1);

    const embed = createBaseEmbed(
      `📊 住民プロフィール - ${targetUser.displayName}`,
      `あつまれ どうぶつの森 Bot の冒険者データです。`,
      "#2ECC71"
    );

    embed.setThumbnail(targetUser.displayAvatarURL({ dynamic: true }));

    embed.addFields(
      { name: "🎫 所持チケット", value: `**${userData.tickets}** 枚`, inline: true },
      { name: "🪙 manybot残高", value: `**${manybotBalance}** コイン`, inline: true },
      { name: "⏱️ 通算浮上時間", value: `**${totalHours}** 時間`, inline: true },
      { name: "🎒 所持道具", value: `・つりざお: **${rodCount}** 本\n・虫取り網: **${netCount}** 本`, inline: false },
      { name: "🐟 魚図鑑達成率", value: fishProgress, inline: false },
      { name: "🦋 虫図鑑達成率", value: bugProgress, inline: false }
    );

    await interaction.followup.send({ embeds: [embed] });
  },
};

import { SlashCommandBuilder } from "discord.js";
import { CONFIG } from "../config.js";
import { BUG_LIST } from "../data/bugs.js";
import { getItemCount, addInventoryItem, recordCatch } from "../database/db.js";
import { checkAndAwardCompletionRole } from "../services/roleReward.js";
import { createBaseEmbed } from "../utils/embedBuilder.js";

export const command = {
  data: new SlashCommandBuilder()
    .setName("bug")
    .setDescription("虫取り網を1つ消費して虫を捕まえます🦋"),

  async execute(interaction) {
    if (!interaction.deferred && !interaction.replied) {
      await interaction.deferReply().catch(() => {});
    }

    const guildId = interaction.guild.id;
    const userId = interaction.user.id;

    // 虫取り網所持チェック
    const netCount = await getItemCount(guildId, userId, "bug_net");
    if (netCount <= 0) {
      const noItemEmbed = createBaseEmbed(
        "🦋 虫取り網がありません！",
        "虫を捕まえるには **虫取り網** が必要です。\n`/shop` コマンドで図鑑チケットを使って虫取り網を交換してください！",
        "#E74C3C"
      );
      await interaction.followUp({ embeds: [noItemEmbed] });
      return;
    }

    // 虫取り網を1つ消費
    await addInventoryItem(guildId, userId, "bug_net", -1);

    // 時間帯チェック (JST時間)
    const currentHour = new Date(Date.now() + 9 * 3600 * 1000).getUTCHours();
    const isDaytime = currentHour >= 6 && currentHour < 18;
    const timeFilter = isDaytime ? "day" : "night";

    // 出現可能な虫のリストをフィルター
    const availableBugs = BUG_LIST.filter(
      (b) => b.time === "all" || b.time === timeFilter
    );

    // 重み付けランダム抽選
    const totalWeight = availableBugs.reduce((acc, b) => acc + b.weight, 0);
    let randomNum = Math.random() * totalWeight;
    let caughtBug = availableBugs[0];

    for (const bug of availableBugs) {
      if (randomNum < bug.weight) {
        caughtBug = bug;
        break;
      }
      randomNum -= bug.weight;
    }

    // 色違い (0.5%) 判定
    const isShiny = Math.random() < CONFIG.SHINY_CHANCE;

    // 図鑑に記録
    const isFirstTime = await recordCatch(guildId, userId, "bug", caughtBug.id, isShiny);

    // ロールチェック
    const roleResult = await checkAndAwardCompletionRole(
      interaction.guild,
      interaction.member,
      "bug"
    );

    // Embed作成
    let rarityColor = "#2ECC71";
    if (caughtBug.rarity === "RARE") rarityColor = "#3498DB";
    if (caughtBug.rarity === "SUPER_RARE") rarityColor = "#9B59B6";
    if (caughtBug.rarity === "LEGENDARY") rarityColor = "#F1C40F";
    if (isShiny) rarityColor = "#FFD700";

    const titlePrefix = isShiny ? "✨ 【金色・色違い】" : "";
    const bugName = isShiny ? `金色の${caughtBug.name}` : caughtBug.name;

    const embed = createBaseEmbed(
      `🦋 虫を捕まえました！ ${caughtBug.emoji}`,
      `**${titlePrefix}${bugName}** をゲットしました！\n\n*${caughtBug.desc}*`,
      rarityColor
    );

    embed.addFields(
      { name: "レア度", value: `\`${caughtBug.rarity}\``, inline: true },
      { name: "図鑑登録", value: isFirstTime ? "🌟 **NEW! (初GET)**" : "✅ 登録済み", inline: true }
    );

    if (isShiny) {
      embed.addFields({
        name: "✨ 超激レア！",
        value: "0.5% の確率で出現する金色個体です！大発見！",
        inline: false,
      });
    }

    let extraMsg = "";
    if (roleResult.awarded) {
      extraMsg = `\n\n🏆 **【コンプリート達成！】** 虫図鑑をすべて埋めました！限定ロール **「${roleResult.roleName}」** を付与しました！`;
    }

    await interaction.followUp({
      content: `${interaction.user.mention} さんの成果です！${extraMsg}`,
      embeds: [embed],
    });
  },
};

import { SlashCommandBuilder } from "discord.js";
import { CONFIG } from "../config.js";
import { FISH_LIST } from "../data/fish.js";
import { getItemCount, addInventoryItem, recordCatch } from "../database/db.js";
import { checkAndAwardCompletionRole } from "../services/roleReward.js";
import { createBaseEmbed } from "../utils/embedBuilder.js";

export const command = {
  data: new SlashCommandBuilder()
    .setName("釣り")
    .setDescription("つりざおを1つ消費して魚を釣ります🎣"),

  async execute(interaction) {
    if (!interaction.deferred && !interaction.replied) {
      await interaction.deferReply().catch(() => {});
    }

    const guildId = interaction.guild.id;
    const userId = interaction.user.id;

    // つりざお所持チェック
    const rodCount = await getItemCount(guildId, userId, "fishing_rod");
    if (rodCount <= 0) {
      const noItemEmbed = createBaseEmbed(
        "🎣 つりざおがありません！",
        "魚を釣るには **つりざお** が必要です。\n`/ショップ` コマンド（または操作パネル）で図鑑チケットを使ってつりざおを交換してください！",
        "#E74C3C"
      );
      await interaction.followUp({ embeds: [noItemEmbed] });
      return;
    }

    // つりざおを1つ消費
    await addInventoryItem(guildId, userId, "fishing_rod", -1);

    // 時間帯チェック (JST時間)
    const currentHour = new Date(Date.now() + 9 * 3600 * 1000).getUTCHours();
    const isDaytime = currentHour >= 6 && currentHour < 18;
    const timeFilter = isDaytime ? "day" : "night";

    // 出現可能な魚のリストをフィルター
    const availableFish = FISH_LIST.filter(
      (f) => f.time === "all" || f.time === timeFilter
    );

    // 重み付けランダム抽選
    const totalWeight = availableFish.reduce((acc, f) => acc + f.weight, 0);
    let randomNum = Math.random() * totalWeight;
    let caughtFish = availableFish[0];

    for (const fish of availableFish) {
      if (randomNum < fish.weight) {
        caughtFish = fish;
        break;
      }
      randomNum -= fish.weight;
    }

    // 色違い (0.5%) 判定
    const isShiny = Math.random() < CONFIG.SHINY_CHANCE;

    // 図鑑に記録
    const isFirstTime = await recordCatch(guildId, userId, "fish", caughtFish.id, isShiny);

    // ロールチェック
    const roleResult = await checkAndAwardCompletionRole(
      interaction.guild,
      interaction.member,
      "fish"
    );

    // Embed作成
    let rarityColor = "#2ECC71";
    if (caughtFish.rarity === "RARE") rarityColor = "#3498DB";
    if (caughtFish.rarity === "SUPER_RARE") rarityColor = "#9B59B6";
    if (caughtFish.rarity === "LEGENDARY") rarityColor = "#F1C40F";
    if (isShiny) rarityColor = "#FFD700";

    const titlePrefix = isShiny ? "✨ 【金色・色違い】" : "";
    const fishName = isShiny ? `金色の${caughtFish.name}` : caughtFish.name;

    const embed = createBaseEmbed(
      `🎣 魚が釣れました！ ${caughtFish.emoji}`,
      `**${titlePrefix}${fishName}** を釣り上げました！\n\n*${caughtFish.desc}*`,
      rarityColor
    );

    embed.addFields(
      { name: "レア度", value: `\`${caughtFish.rarity}\``, inline: true },
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
      extraMsg = `\n\n🏆 **【コンプリート達成！】** 魚図鑑をすべて埋めました！限定ロール **「${roleResult.roleName}」** を付与しました！`;
    }

    await interaction.followUp({
      content: `${interaction.user.mention} さんの釣果です！${extraMsg}`,
      embeds: [embed],
    });
  },
};

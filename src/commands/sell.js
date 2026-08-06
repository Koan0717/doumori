import { SlashCommandBuilder } from "discord.js";
import { CONFIG } from "../config.js";
import { FISH_LIST } from "../data/fish.js";
import { BUG_LIST } from "../data/bugs.js";
import { doumoriPool, addManybotBalance, getManybotBalance } from "../database/db.js";
import { createBaseEmbed } from "../utils/embedBuilder.js";

export const command = {
  data: new SlashCommandBuilder()
    .setName("sell")
    .setDescription("重複した生き物（2匹目以降）を売却して 通貨 に換金します💰"),

  async execute(interaction) {
    if (!interaction.deferred && !interaction.replied) {
      await interaction.deferReply().catch(() => {});
    }

    const guildId = interaction.guild.id;
    const userId = interaction.user.id;

    // 捕獲数が2以上の生き物を取得
    const res = await doumoriPool.query(
      "SELECT * FROM doumori_collection WHERE guild_id = $1 AND user_id = $2 AND count > 1",
      [guildId, userId]
    );

    if (res.rows.length === 0) {
      const emptyEmbed = createBaseEmbed(
        "💰 たぬき売却処 - 売却アイテムなし",
        "売却できる重複した生き物（2匹以上捕まえた生き物）がありません！\n`/fish` や `/bug` でたくさん採集しましょう！",
        "#E74C3C"
      );
      await interaction.followUp({ embeds: [emptyEmbed] });
      return;
    }

    const allMap = new Map();
    FISH_LIST.forEach((f) => allMap.set(f.id, f));
    BUG_LIST.forEach((b) => allMap.set(b.id, b));

    let totalEarnedCoins = 0;
    let soldCount = 0;

    for (const row of res.rows) {
      const itemInfo = allMap.get(row.creature_id);
      if (!itemInfo) continue;

      const excessCount = row.count - 1; // 1匹残して売却
      const basePrice = CONFIG.SELL_PRICES[itemInfo.rarity] || 100;
      const pricePerUnit = row.has_shiny
        ? basePrice * CONFIG.SELL_PRICES.SHINY_MULTIPLIER
        : basePrice;

      const itemTotalPrice = pricePerUnit * excessCount;
      totalEarnedCoins += itemTotalPrice;
      soldCount += excessCount;

      // カウントを 1 に更新
      await doumoriPool.query(
        "UPDATE doumori_collection SET count = 1 WHERE guild_id = $1 AND user_id = $2 AND category = $3 AND creature_id = $4",
        [guildId, userId, row.category, row.creature_id]
      );
    }

    // 通貨を加算
    await addManybotBalance(guildId, userId, totalEarnedCoins);
    const newBalance = await getManybotBalance(guildId, userId);

    const embed = createBaseEmbed(
      "💰 たぬき売却処 - 売却完了！",
      `重複した生き物 **合計 ${soldCount} 匹** を売却し、**${totalEarnedCoins}** 通貨 を手に入れました！`,
      "#F1C40F"
    );

    embed.addFields({
      name: "🪙 通貨残高",
      value: `**${newBalance}** 通貨`,
      inline: false,
    });

    await interaction.followUp({ embeds: [embed] });
  },
};

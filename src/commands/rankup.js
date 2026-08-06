import { SlashCommandBuilder } from "discord.js";
import { CONFIG } from "../config.js";
import { getUserMiles, setRankLevel } from "../database/db.js";
import { createBaseEmbed } from "../utils/embedBuilder.js";

export const command = {
  data: new SlashCommandBuilder()
    .setName("ランクアップ")
    .setDescription("貯まったマイルポイントを使って次のランクへ昇格します⬆️"),

  async execute(interaction) {
    if (!interaction.deferred && !interaction.replied) {
      await interaction.deferReply({ ephemeral: false }).catch(() => {});
    }

    const guildId = interaction.guild.id;
    const userId = interaction.user.id;

    const userMiles = await getUserMiles(guildId, userId);
    const currentRank = CONFIG.RANKS.find((r) => r.level === userMiles.rank_level) || CONFIG.RANKS[0];
    const nextRank = CONFIG.RANKS.find((r) => r.level === userMiles.rank_level + 1);

    if (!nextRank) {
      const maxEmbed = createBaseEmbed(
        "🏆 ランクアップ不可",
        "すでに最高ランク（マスター）に到達しています！",
        "#F1C40F"
      );
      await interaction.followUp({ embeds: [maxEmbed] });
      return;
    }

    if (userMiles.miles < nextRank.requiredMiles) {
      const needed = nextRank.requiredMiles - userMiles.miles;
      const notEnoughEmbed = createBaseEmbed(
        "⚠️ マイルポイント不足",
        `**${nextRank.name}** へ昇格するには **${nextRank.requiredMiles}** マイルが必要です。\n（現在の所持: **${userMiles.miles}** マイル / あと **${needed}** マイル必要）\n\nデイリーミッションやDIY作業台でマイルを貯めましょう！`,
        "#E74C3C"
      );
      await interaction.followUp({ embeds: [notEnoughEmbed] });
      return;
    }

    // ランク昇格処理
    await setRankLevel(guildId, userId, nextRank.level);

    // サーバー内ロールの自動作成・付与
    let roleGrantedText = "";
    try {
      const guild = interaction.guild;
      const member = interaction.member;
      let role = guild.roles.cache.find((r) => r.name === nextRank.name);

      if (!role) {
        role = await guild.roles.create({
          name: nextRank.name,
          color: nextRank.color,
          reason: `ステップアップランク昇格報酬 (${nextRank.name})`,
          hoist: true,
        });
      }

      if (member && !member.roles.cache.has(role.id)) {
        await member.roles.add(role);
        roleGrantedText = `\n🏅 限定ランク用ロール **「${nextRank.name}」** を自動付与しました！`;
      }
    } catch (err) {
      console.error("❌ ランクアップロール付与エラー:", err);
    }

    const successEmbed = createBaseEmbed(
      "🎉 ランクアップ成功！",
      `${interaction.user.mention} さんが **${nextRank.name}** に昇格しました！${roleGrantedText}`,
      nextRank.color
    );

    await interaction.followUp({ embeds: [successEmbed] });
  },
};

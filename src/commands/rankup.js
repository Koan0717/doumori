import { SlashCommandBuilder } from "discord.js";
import { CONFIG, resolveRankFromMember } from "../config.js";
import { getUserMiles, doumoriPool, getResidentCardData } from "../database/db.js";
import { buildResidentCardEmbed } from "./card.js";
import { createBaseEmbed } from "../utils/embedBuilder.js";

export const command = {
  data: new SlashCommandBuilder()
    .setName("ランクアップ")
    .setDescription("貯まったマイルポイントを使って次の階級へ昇格します⬆️"),

  async execute(interaction) {
    if (!interaction.deferred && !interaction.replied) {
      await interaction.deferReply({ ephemeral: false }).catch(() => {});
    }

    const guildId = interaction.guild.id;
    const userId = interaction.user.id;

    const userMiles = await getUserMiles(guildId, userId);
    const currentRank = resolveRankFromMember(interaction.member, userMiles.rank_level);
    const nextRank = CONFIG.RANKS.find((r) => r.level === currentRank.level + 1);

    if (!nextRank) {
      const maxEmbed = createBaseEmbed(
        "🏆 階級アップ不可",
        "すでに最高階級（人気住人）に到達しています！",
        "#F1C40F"
      );
      await interaction.followUp({ embeds: [maxEmbed] });
      return;
    }

    if (userMiles.miles < nextRank.requiredMiles) {
      const needed = nextRank.requiredMiles - userMiles.miles;
      const notEnoughEmbed = createBaseEmbed(
        "⚠️ マイルポイント不足",
        `**${nextRank.name}** へ昇格するには **${nextRank.requiredMiles.toLocaleString()}** pt が必要です。\n（現在の所持: **${userMiles.miles.toLocaleString()}** pt / あと **${needed.toLocaleString()}** pt 必要）\n\nデイリーミッションやイベントでマイルを貯めましょう！`,
        "#E74C3C"
      );
      await interaction.followUp({ embeds: [notEnoughEmbed] });
      return;
    }

    // ランク昇格処理 (現在の階級ミッション回数は新階級用にリセット)
    await doumoriPool.query(
      `INSERT INTO doumori_miles (guild_id, user_id, rank_level, mission_count)
       VALUES ($1, $2, $3, 0)
       ON CONFLICT (guild_id, user_id)
       DO UPDATE SET rank_level = $3, mission_count = 0`,
      [guildId, userId, nextRank.level]
    );

    // サーバー内ロールの自動付与（既存の階級ロールがある場合は検索、なければ作成）
    let roleGrantedText = "";
    try {
      const guild = interaction.guild;
      const member = interaction.member;

      if (guild && member) {
        // 次の階級名に一致するロールを検索（例: "人気住人", "人気住人ロール", "🌟 人気住人" など）
        const targetCleanName = nextRank.name.replace(/^[^\s]+ /, ""); // 絵文字を除いた名前
        let role = guild.roles.cache.find(
          (r) =>
            r.name === nextRank.name ||
            r.name === targetCleanName ||
            r.name === `${targetCleanName}ロール` ||
            r.name.includes(targetCleanName)
        );

        if (!role) {
          role = await guild.roles.create({
            name: nextRank.name,
            color: nextRank.color,
            reason: `ステップアップ階級昇格報酬 (${nextRank.name})`,
            hoist: true,
          });
        }

        if (!member.roles.cache.has(role.id)) {
          await member.roles.add(role);
          roleGrantedText = `\n🏅 限定階級ロール **「${role.name}」** を付与しました！`;
        }
      }
    } catch (err) {
      console.error("❌ ランクアップロール付与エラー:", err);
    }

    const cardData = await getResidentCardData(guildId, userId, interaction.member);
    const cardEmbed = buildResidentCardEmbed(cardData, interaction.user);

    const successEmbed = createBaseEmbed(
      "🎉 階級アップ成功！",
      `${interaction.user.toString()} さんが **${nextRank.name}** に昇格しました！${roleGrantedText}`,
      nextRank.color
    );

    await interaction.followUp({ embeds: [successEmbed, cardEmbed] });
  },
};

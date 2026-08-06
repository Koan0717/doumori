import { EmbedBuilder } from "discord.js";

/**
 * どうぶつの森風のベースEmbedを作成
 */
export function createBaseEmbed(title, description, color = "#2ECC71") {
  return new EmbedBuilder()
    .setTitle(title)
    .setDescription(description)
    .setColor(color)
    .setFooter({ text: "🍃 あつまれ どうぶつの森 Bot", iconURL: "https://i.imgur.com/8Q9Z8qE.png" })
    .setTimestamp();
}

/**
 * プログレスバー（プログレス指示子）を文字列生成
 * 例: [████████░░] 80%
 */
export function createProgressBar(current, total, length = 10) {
  const percent = Math.min(100, Math.max(0, Math.floor((current / total) * 100)));
  const filled = Math.round((length * current) / total);
  const empty = length - filled;
  const bar = "█".repeat(filled) + "░".repeat(empty);
  return `\`[${bar}]\` **${percent}%** (${current}/${total})`;
}

import { CONFIG } from "../config.js";
import { FISH_LIST } from "../data/fish.js";
import { BUG_LIST } from "../data/bugs.js";
import { getUserCollection } from "../database/db.js";

/**
 * コレクション完了チェックおよび限定ロールの自動作成・付与
 */
export async function checkAndAwardCompletionRole(guild, member, category) {
  if (!guild || !member) return false;

  const totalItems = category === "fish" ? FISH_LIST.length : BUG_LIST.length;
  const userCatch = await getUserCollection(guild.id, member.id, category);
  
  // 種類数をカウント
  const uniqueCount = new Set(userCatch.map((c) => c.creature_id)).size;

  if (uniqueCount >= totalItems) {
    const roleConfig = CONFIG.COMPLETION_ROLES[category];
    if (!roleConfig) return false;

    try {
      // サーバー内に同名ロールが存在するか確認
      let role = guild.roles.cache.find((r) => r.name === roleConfig.name);
      
      // なければ自動生成
      if (!role) {
        role = await guild.roles.create({
          name: roleConfig.name,
          color: roleConfig.color,
          reason: `図鑑コンプリート自動報酬ロール (${category})`,
          hoist: true, // プロフィール・メンバー一覧で目立たせる
        });
      }

      // ユーザーにロールが付与されていなければ付与
      if (!member.roles.cache.has(role.id)) {
        await member.roles.add(role);
        return { awarded: true, roleName: roleConfig.name };
      }
    } catch (err) {
      console.error(`❌ ロール付与エラー (${category}):`, err);
    }
  }

  return { awarded: false };
}

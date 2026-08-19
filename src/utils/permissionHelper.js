import { PermissionFlagsBits } from "discord.js";
import { getDoumoriSettings } from "../database/db.js";

/**
 * 権限チェック共通ヘルパー
 * @param {import("discord.js").GuildMember} member
 * @param {string} guildId
 * @param {'admin'|'mile_grant'|'ticket_grant'|'mission_staff'} permType
 * @returns {Promise<boolean>}
 */
export async function checkPermission(member, guildId, permType = "admin") {
  if (!member) return false;

  // 1. Discord サーバー管理者 / サーバー管理権限を持つ場合は常にパス
  if (
    member.permissions && (
      member.permissions.has(PermissionFlagsBits.Administrator) ||
      member.permissions.has(PermissionFlagsBits.ManageGuild)
    )
  ) {
    return true;
  }

  // 2. DBから設定を取得
  const settings = await getDoumoriSettings(guildId).catch(() => ({}));
  const memberRoleIds = new Set(
    member.roles && member.roles.cache ? member.roles.cache.map((r) => r.id) : []
  );

  // 3. 管理者ロール（admin_role_ids）を持つ場合はすべての操作を許可
  const adminRoles = Array.isArray(settings.admin_role_ids) ? settings.admin_role_ids : [];
  if (adminRoles.some((rId) => memberRoleIds.has(rId))) {
    return true;
  }

  if (permType === "admin") {
    return false;
  }

  // 4. 特定機能の権限ロールのチェック
  let targetRoles = [];
  if (permType === "mile_grant") {
    targetRoles = Array.isArray(settings.mile_grant_role_ids) ? settings.mile_grant_role_ids : [];
  } else if (permType === "ticket_grant") {
    targetRoles = Array.isArray(settings.ticket_grant_role_ids) ? settings.ticket_grant_role_ids : [];
  } else if (permType === "mission_staff") {
    targetRoles = Array.isArray(settings.mission_staff_role_ids) ? settings.mission_staff_role_ids : [];
  }

  return targetRoles.some((rId) => memberRoleIds.has(rId));
}

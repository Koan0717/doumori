import { PermissionFlagsBits, PermissionsBitField } from "discord.js";
import { getDoumoriSettings } from "../database/db.js";

/**
 * 権限チェック共通ヘルパー
 * @param {import("discord.js").GuildMember | import("discord.js").APIInteractionGuildMember} member
 * @param {string} guildId
 * @param {'admin'|'mile_grant'|'ticket_grant'|'mission_staff'} permType
 * @param {import("discord.js").PermissionsBitField} [memberPermissions]
 * @returns {Promise<boolean>}
 */
export async function checkPermission(member, guildId, permType = "admin", memberPermissions = null) {
  if (!member) return false;

  // 1. PermissionsBitField の解決
  let perms = memberPermissions;
  if (!perms && member.permissions) {
    if (member.permissions instanceof PermissionsBitField) {
      perms = member.permissions;
    } else if (typeof member.permissions.has === "function") {
      perms = member.permissions;
    } else {
      try {
        perms = new PermissionsBitField(BigInt(member.permissions));
      } catch {
        perms = null;
      }
    }
  }

  // Discord サーバー管理者 / サーバー管理権限を持つ場合は常にパス
  if (perms) {
    if (
      perms.has(PermissionFlagsBits.Administrator) ||
      perms.has(PermissionFlagsBits.ManageGuild)
    ) {
      return true;
    }
    // ミッション承認スタッフの場合はメッセージ管理権限でも許可
    if (permType === "mission_staff" && perms.has(PermissionFlagsBits.ManageMessages)) {
      return true;
    }
  }

  // 2. DBから設定を取得
  const settings = await getDoumoriSettings(guildId).catch(() => ({}));
  const memberRoleIds = new Set(
    member.roles && member.roles.cache
      ? member.roles.cache.map((r) => r.id)
      : (Array.isArray(member.roles) ? member.roles : [])
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

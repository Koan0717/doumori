import { GUILD_ID } from '@/lib/db';

const API = 'https://discord.com/api/v10';

function authHeaders() {
  const token = process.env.DISCORD_BOT_TOKEN;
  return token ? { Authorization: `Bot ${token}` } : undefined;
}

export async function fetchGuildChannels() {
  const headers = authHeaders();
  if (!headers || !GUILD_ID) return [];
  const res = await fetch(`${API}/guilds/${GUILD_ID}/channels`, { headers, cache: 'no-store' }).catch(() => null);
  if (!res || !res.ok) return [];
  const data = await res.json();
  return Array.isArray(data) ? data : [];
}

export async function fetchGuildRoles() {
  const headers = authHeaders();
  if (!headers || !GUILD_ID) return [];
  const res = await fetch(`${API}/guilds/${GUILD_ID}/roles`, { headers, cache: 'no-store' }).catch(() => null);
  if (!res || !res.ok) return [];
  const data = await res.json();
  return Array.isArray(data) ? data : [];
}

export async function sendChannelMessage(channelId: string, payload: any) {
  const headers = authHeaders();
  if (!headers) return { ok: false, error: 'DISCORD_BOT_TOKEN が設定されていません' };

  const res = await fetch(`${API}/channels/${channelId}/messages`, {
    method: 'POST',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    return { ok: false, error: err.message || res.statusText };
  }
  return { ok: true };
}

import { NextResponse } from 'next/server';
import { pool, GUILD_ID } from '@/lib/db';

export async function GET() {
  try {
    const mileLogs = await pool
      .query(
        `SELECT id, user_id, admin_id, amount, action, reason, created_at
         FROM doumori_mile_logs WHERE guild_id = $1 ORDER BY created_at DESC LIMIT 30`,
        [GUILD_ID]
      )
      .then((res) => res.rows)
      .catch(() => []);

    return NextResponse.json({ mileLogs });
  } catch (error: any) {
    console.error('GET /api/miles error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { user_id, amount, op_type, reason } = await request.json();
    const numericAmount = Math.abs(parseInt(amount, 10) || 0);

    if (!user_id || numericAmount === 0) {
      return NextResponse.json({ error: '対象ユーザーIDと1以上のポイント数を指定してください。' }, { status: 400 });
    }

    const diff = op_type === 'revoke' ? -numericAmount : numericAmount;

    await pool.query(
      `INSERT INTO doumori_miles (guild_id, user_id, miles)
       VALUES ($1, $2, $3)
       ON CONFLICT (guild_id, user_id)
       DO UPDATE SET miles = GREATEST(0, doumori_miles.miles + $3)`,
      [GUILD_ID, user_id, diff]
    );

    await pool.query(
      `INSERT INTO doumori_mile_logs (guild_id, user_id, admin_id, amount, action, reason)
       VALUES ($1, $2, 0, $3, $4, $5)`,
      [GUILD_ID, user_id, numericAmount, op_type, reason || 'Dashboard操作']
    );

    return NextResponse.json({ success: true, message: `マイル${op_type === 'grant' ? '付与' : '没収'}が完了しました。` });
  } catch (error: any) {
    console.error('POST /api/miles error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// pm2 設定ファイル
// 起動:   pm2 start ecosystem.config.cjs
// 再起動: pm2 restart doumori-bot
// ログ:   pm2 logs doumori-bot
module.exports = {
  apps: [
    {
      name: "doumori-bot",
      script: "src/index.js",
      cwd: __dirname, // .env をこのフォルダから読み込むため
      instances: 1, // Discord Bot は必ず1プロセスのみ（複数起動すると二重応答になる）
      exec_mode: "fork",
      autorestart: true,
      max_restarts: 10,
      restart_delay: 5000,
      max_memory_restart: "400M",
      time: true, // ログに時刻を付ける
      env: {
        NODE_ENV: "production",
      },
    },

    // 管理ダッシュボード (dashboard/) も同じVPSで動かす場合はコメントを外す。
    // 事前に `cd dashboard && npm ci && npm run build` が必要。
    // ポートが manybot のダッシュボードと被らないように注意。
    // {
    //   name: "doumori-dashboard",
    //   script: "node_modules/next/dist/bin/next",
    //   args: "start -p 3001",
    //   cwd: __dirname + "/dashboard",
    //   instances: 1,
    //   autorestart: true,
    //   time: true,
    //   env: {
    //     NODE_ENV: "production",
    //   },
    // },
  ],
};

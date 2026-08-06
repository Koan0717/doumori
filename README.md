# 🍃 あつまれ どうぶつの森風 Discord Bot (`doumori`)

あつまれ どうぶつの森風のゲームシステム（浮上チケット・採集・図鑑・コンプリート自動限定ロール・manybot通貨連携）を備えた Discord Bot です。

---

## 🌟 主な機能

1. **🎫 浮上・チケット獲得システム**
   * Voice Channel (VC) やチャットでの浮上時間を計測。**累計 1 時間** ごとに「図鑑チケット ×1」を自動付与。
2. **🏪 ショップ (`/shop`)**
   * 図鑑チケットを使って「つりざお」や「虫取り網」を交換（ボタンUI）。
3. **🎣 採集 (`/fish`, `/bug`)**
   * 魚 20 種類、虫 20 種類を採集。時間帯制限やレア度出現率を設定。
   * **✨ 0.5% の確率で「金色・色違い個体」が出現！**
4. **📖 図鑑 (`/fishbook`, `/bugbook`)**
   * コレクション数・未入手「???」表示・収集率プログレスバー・ボタン付きページ切替。
5. **🏆 限定コンプリートロール付与**
   * 魚図鑑 100% コンプリート ➔ **「🎣 金のつりざお」** 限定ロール自動作成・付与
   * 虫図鑑 100% コンプリート ➔ **「🦋 金の虫取り網」** 限定ロール自動作成・付与
6. **🪙 manybot 通貨連携 (`/exchange`, `/sell`)**
   * `manybot` と `doumori` で**別々の Supabase データベース**を使用している場合でもスムーズに連携可能！
   * `/exchange`: `manybot` の通貨 (`balance`) と「図鑑チケット」を相互両替
   * `/sell`: 重複して捕まえた生き物を売却し、`manybot` の DB 内通貨を獲得
7. **📊 プロフィール & ランキング (`/profile`, `/leaderboard`)**
   * ステータス確認とサーバー内コレクション完成率ランキングを表示。

---

## 🚀 Render での環境変数設定 (Environment Variables)

Render の管理画面で、以下の **Environment Variables** を登録してください。

| キー (Key) | 値 (Value) の説明 |
| :--- | :--- |
| **`DISCORD_BOT_TOKEN`** | Discord Developer Portal で取得した Bot Token |
| **`DISCORD_CLIENT_ID`** | Discord Application (Client) ID |
| **`DOUMORI_DATABASE_URL`** | `doumori` Bot専用の Supabase 接続文字列 |
| **`MANYBOT_DATABASE_URL`** | `manybot` Bot専用の Supabase 接続文字列 (通貨連携用) |
| **`PORT`** | `8080` （RenderのダミーWebヘルスチェック用） |

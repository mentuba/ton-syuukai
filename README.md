# ToN 続行管理Bot

Terrors of Nowhere の周回続行テラーを Discord 上で提出・集計するための Bot です。
`ToN_ContinueBot_Specification.txt` の仕様に基づいて実装しています。

## セットアップ

```bash
npm install
cp .env.example .env
```

`.env` を編集し、以下を設定してください。

- `TOKEN`: Discord Developer Portal で発行した Bot トークン
- `APPLICATION_ID`: アプリケーションID（Application ID / Client ID）
- `GUILD_ID`: （任意・開発時推奨）動作確認用サーバーのID。指定するとコマンドが即座に反映されます。省略するとグローバル登録になり反映まで最大1時間程度かかります。
- `PORT`: （任意）keep-alive用HTTPサーバーが待機するポート。省略時は`3000`。
- `KEEP_ALIVE`: （任意）`false`にするとkeep-alive用HTTPサーバーを起動しません。ローカル開発時はfalse推奨。

コマンドを登録します。

```bash
npm run deploy
```

Bot を起動します。

```bash
npm start
```

## 外部ホスティング（Koyeb等）について

Koyebなどの無料枠でDockerデプロイする場合を想定して、`Dockerfile` と keep-alive用の簡易HTTPサーバー（`utils/keepAlive.js`）を同梱しています。

1. GitHubにこのプロジェクトをpush（`.env`は含めないでください）。
2. Koyebでサービス作成時、Builderを **Dockerfile** に設定。
3. Environment variables に `TOKEN`・`APPLICATION_ID`・（必要なら）`GUILD_ID` を設定。
4. Exposed ports を `3000`（`Dockerfile`の`EXPOSE`と合わせる。変更する場合は`PORT`も設定）に設定してデプロイ。
5. デプロイ後に発行されるURLを [UptimeRobot](https://uptimerobot.com/) 等で定期的にpingすることで、無料枠のスリープを防ぎ常時起動できます。

`utils/keepAlive.js` はDiscord Botとしての動作には不要ですが、上記のような外形監視での常時起動を目的とした簡易HTTPサーバーです。ローカル開発時は `.env` で `KEEP_ALIVE=false` にすると起動しません。

事前にコマンド登録（`npm run deploy`）はローカルまたはCI等で一度実行しておく必要があります（Koyeb起動時には自動実行されません）。

## Botに必要な権限・Intents

- Bot招待時のスコープ: `bot`, `applications.commands`
- 権限: メッセージ送信、埋め込みリンク、スラッシュコマンドの使用
- Gateway Intents: `Guilds`（本Botはメッセージ内容を読み取らないため最小限の設定です）

## 管理者権限について

`/session create`・`/session close`・`/cracked check`・`/ghost check`・`/alternate check` は、
サーバー管理権限（**サーバーの管理 / Manage Server**）を持つユーザーのみ実行できます。
権限の基準を変更したい場合は `utils/permissions.js` を編集してください。

## コマンド一覧

| コマンド | 説明 | 権限 |
|---|---|---|
| `/session create [date]` | セッションを作成（date省略時は当日の日付、既存の日付があれば作成しない） | 管理者 |
| `/session close` | セッションを終了し、提出受付を終了 | 管理者 |
| `/cracked add terror:` | Crackedのテラーを提出 | 全員 |
| `/cracked remove terror:` | Crackedの提出を取り消し | 全員 |
| `/cracked list` | 自分のCracked提出一覧を表示（本人のみ表示） | 全員 |
| `/cracked check` | Crackedの集計をEmbedで表示 | 管理者 |
| `/ghost add / remove / list / check` | Cracked と同様（`data/terrors.json` を使用） | 同上 |
| `/alternate add / remove / list / check` | Cracked と同様（`data/alternate.json` を使用） | 同上 |
| `/clear category: [user:] [date:]` | 提出データをクリア。`user`省略時はカテゴリ全体をクリア。`date`省略時は現在受付中のセッションが対象 | 管理者 |
| `/history list` | 過去の開催日一覧（受付中／終了）を表示 | 全員 |
| `/history view date: category:` | 過去の開催日の集計をEmbedで表示（`/check`の過去版） | 管理者 |
| `/export category: format: [date:]` | 提出データをCSVまたはJSONファイルとして出力。`date`省略時は現在受付中のセッションが対象 | 管理者 |

`terror:` オプションは Discord のオートコンプリートに対応しており、
Cracked / Ghost は `data/terrors.json`、Alternate は `data/alternate.json` の候補から選択できます。

## データ保存

`data/submissions.json` に保存されます（初回起動時に自動生成）。

```jsonc
{
  "currentSession": "2026-07-18",
  "sessions": {
    "2026-07-18": {
      "closed": false,
      "cracked": {
        "123456789012345678": { "displayName": "Alice", "terrors": ["Rush", "WhiteNight"] }
      },
      "ghost": {},
      "alternate": {}
    }
  }
}
```

## エラーメッセージ

- セッション未開始: 「現在開催中のセッションがありません。」
- 重複提出: 「○○ は既に提出済みです。」
- 未提出の削除: 「○○ は提出されていません。」

## 仕様書との差分・実装補足

- `/session create` の `date` パラメータは省略可能（今後の拡張予定に記載の「セッション作成時に日付は指定可能」に対応）。
- `check` は管理者専用として実装しました（仕様書「権限」セクションに準拠）。
- `add` は1テラー1コマンドの実行が必要です（複数テラーをまとめて提出したい場合は、コマンドを複数回実行してください）。
- `clear`・過去セッション閲覧（`/history`）・CSV/JSON出力（`/export`）を実装しました。仕様書に詳細な挙動の記載がなかったため、以下のように実装時に補いました。
  - `/clear`: `category`（cracked/ghost/alternate/all）は必須。`user`を指定するとそのユーザーの提出のみ、省略するとカテゴリ全体をクリアします。`date`省略時は現在受付中のセッションが対象です。
  - `/history list`: 過去の開催日と状態（受付中／終了）を全員に表示します（Ephemeral）。
  - `/history view`: 指定した過去の開催日・カテゴリの集計を `/check` と同じ形式のEmbedで表示します。`/check`同様、管理者専用としました。
  - `/export`: 提出データを「日付・カテゴリ・Discordユーザーid・表示名・テラー名」の1提出1行形式でCSV（BOM付きUTF-8）またはJSONとして出力します。ユーザーIDを含むため管理者専用としました。
- 以下は仕様書「今後の拡張予定」のうち未実装です:
  - 提出締切時刻・提出リマインダー
  - 管理者による提出編集

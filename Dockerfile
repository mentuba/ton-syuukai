# Node.jsのバージョン、必要に応じて変更してください。
FROM node:18

# 作業ディレクトリを /app に
WORKDIR /app

# 依存関係だけ先にコピーしてインストール（キャッシュ効率化）
COPY package*.json ./
RUN npm install --omit=dev

# 残りのファイルをコピー
COPY . .

# keep-alive用サーバーのポート（Koyebの Exposed ports もこれに合わせる）
EXPOSE 3000

# アプリの起動
CMD ["node", "index.js"]

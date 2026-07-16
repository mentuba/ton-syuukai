const http = require('http');

// Koyeb（無料枠）などは外部からのアクセスが一定時間ないとスリープするため、
// UptimeRobot等の外形監視から定期的にアクセスしてもらうための簡易HTTPサーバーです。
// Bot自体の動作には必須ではありませんが、無料ホスティングで常時起動させたい場合に使用します。
function startKeepAliveServer() {
  const port = process.env.PORT || 3000;

  const server = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('ToN ContinueBot is running.');
  });

  server.listen(port, () => {
    console.log(`Keep-aliveサーバーがポート ${port} で待機中です。`);
  });

  return server;
}

module.exports = { startKeepAliveServer };

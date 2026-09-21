const http = require('http');

const VERSION = process.env.APP_VERSION || 'v1';

function handler(req, res) {
  if (req.url === '/health') {
    res.writeHead(200);
    return res.end('ok');
  }
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end(`hello from example-project ${VERSION}\n`);
}

if (require.main === module) {
  http.createServer(handler).listen(3000, () => console.log('listening on 3000'));
}

module.exports = { handler };

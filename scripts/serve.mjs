import { createServer } from 'node:http';
import app from '../dist/server/index.js';

const server = createServer(async (req, res) => {
  try {
    const request = new Request(`http://${req.headers.host}${req.url}`, { method: req.method, headers: req.headers, body: ['GET', 'HEAD'].includes(req.method) ? undefined : req, duplex: 'half' });
    const response = await app.fetch(request, process.env);
    res.writeHead(response.status, Object.fromEntries(response.headers));
    res.end(Buffer.from(await response.arrayBuffer()));
  } catch { res.writeHead(500); res.end('Server error'); }
});
server.listen(8080, '127.0.0.1', () => console.log('LETITIA local server: http://localhost:8080'));

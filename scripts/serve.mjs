import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
const allowed = new Set(['index.html','demo.html','diff-view.js','demo.js','diff-view.css']);
createServer(async (request, response) => {
  const name = new URL(request.url, 'http://localhost').pathname.slice(1) || 'demo.html';
  if (!allowed.has(name)) { response.writeHead(404); response.end(); return; }
  try {
    const data = await readFile(new URL(`../dist/${name}`, import.meta.url));
    response.setHeader('Content-Type', name.endsWith('.js') ? 'text/javascript' : name.endsWith('.css') ? 'text/css' : 'text/html');
    response.end(data);
  } catch { response.writeHead(500); response.end(); }
}).listen(4173, '127.0.0.1', () => console.log('Demo: http://127.0.0.1:4173/demo.html'));

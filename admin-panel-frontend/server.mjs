import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));

function loadEnvFile() {
  const envPath = path.join(root, '.env');
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*([^#]*)\s*$/i);
    if (!match || process.env[match[1]] !== undefined) continue;
    process.env[match[1]] = match[2].trim().replace(/^['"]|['"]$/g, '');
  }
}

loadEnvFile();
const port = Number(process.env.PORT || 5173);
const backendUrl = process.env.BACKEND_URL || 'http://localhost:9999';

const mimeTypes = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon'
};

function readBody(request) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    request.on('data', (chunk) => chunks.push(chunk));
    request.on('end', () => resolve(Buffer.concat(chunks)));
    request.on('error', reject);
  });
}

async function proxyRequest(request, response) {
  const requestUrl = new URL(request.url, `http://${request.headers.host}`);
  const target = new URL(requestUrl.pathname.replace(/^\/api/, '') || '/', backendUrl);
  target.search = requestUrl.search;

  const headers = { ...request.headers };
  delete headers.host;
  delete headers.connection;

  try {
    const body = request.method === 'GET' || request.method === 'HEAD'
      ? undefined
      : await readBody(request);
    const upstream = await fetch(target, {
      method: request.method,
      headers,
      body
    });

    response.statusCode = upstream.status;
    // fetch already decompressed the body, so the upstream encoding/length headers no longer match it.
    // fetch بيفك الضغط لحالها، فلو مررنا content-encoding المتصفح بيفشل بقراءة الملف (زي socket.io.js)
    const skippedHeaders = new Set(['content-encoding', 'content-length', 'transfer-encoding']);
    upstream.headers.forEach((value, key) => {
      if (!skippedHeaders.has(key.toLowerCase())) response.setHeader(key, value);
    });
    response.end(Buffer.from(await upstream.arrayBuffer()));
  } catch (error) {
    response.statusCode = 502;
    response.setHeader('content-type', 'application/json; charset=utf-8');
    response.end(JSON.stringify({ message: `تعذر الاتصال بالـ backend: ${error.message}` }));
  }
}

function serveFile(request, response) {
  const requestUrl = new URL(request.url, `http://${request.headers.host}`);
  let pathname;
  try {
    pathname = decodeURIComponent(requestUrl.pathname);
  } catch {
    response.statusCode = 400;
    response.end('Bad request');
    return;
  }

  const relativePath = pathname === '/' ? '/index.html' : pathname;
  const filePath = path.resolve(root, `.${relativePath}`);
  if (!filePath.startsWith(root)) {
    response.statusCode = 403;
    response.end('Forbidden');
    return;
  }

  const fallback = path.join(root, 'index.html');
  const candidate = fs.existsSync(filePath) && fs.statSync(filePath).isFile() ? filePath : fallback;
  const extension = path.extname(candidate).toLowerCase();
  response.statusCode = 200;
  response.setHeader('content-type', mimeTypes[extension] || 'application/octet-stream');
  response.setHeader('cache-control', 'no-store');
  fs.createReadStream(candidate).pipe(response);
}

const server = http.createServer((request, response) => {
  if (request.url.startsWith('/api/')) {
    proxyRequest(request, response);
    return;
  }
  if (request.url.startsWith('/socket.io/socket.io.js')) {
    proxyRequest(request, response);
    return;
  }
  serveFile(request, response);
});

server.listen(port, () => {
  console.log(`Admin frontend is running at http://localhost:${port}`);
  console.log(`Backend proxy target: ${backendUrl}`);
});

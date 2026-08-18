const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const ARTZ_DIST = path.join(ROOT, 'artz', 'dist');
const PORT = process.env.PORT || 8080;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.webp': 'image/webp',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.otf': 'font/otf',
  '.txt': 'text/plain; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
  '.csv': 'text/csv; charset=utf-8',
  '.pdf': 'application/pdf',
  '.wasm': 'application/wasm',
  '.map': 'application/json',
};

function resolveRequest(req) {
  const requestUrl = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
  const pathname = decodeURIComponent(requestUrl.pathname);

  if (pathname === '/artz' || /^\/artz\/+$/u.test(pathname)) {
    return {
      fsPath: ARTZ_DIST,
      redirect: `/artz/${requestUrl.search}`,
    };
  }

  if (pathname.startsWith('/artz/')) {
    const relativePath = pathname.slice('/artz/'.length).replace(/^\/+/, '');
    return {
      fsPath: safeJoin(ARTZ_DIST, relativePath),
      redirect: null,
    };
  }

  return {
    fsPath: safeJoin(ROOT, pathname.slice(1)),
    redirect: null,
  };
}

function safeJoin(root, relativePath) {
  const resolvedRoot = path.resolve(root);
  const resolvedPath = path.resolve(resolvedRoot, relativePath);
  if (resolvedPath !== resolvedRoot && !resolvedPath.startsWith(`${resolvedRoot}${path.sep}`)) {
    return null;
  }
  return resolvedPath;
}

function listingHtml(dirPath, urlPath) {
  let entries;
  try {
    entries = fs.readdirSync(dirPath, { withFileTypes: true });
  } catch {
    return null;
  }
  const base = urlPath === '/' ? '' : urlPath;
  const rows = entries
    .map((e) => {
      const name = e.name;
      const href = `${base}${base.endsWith('/') ? '' : '/'}${encodeURIComponent(name)}${e.isDirectory() ? '/' : ''}`;
      return `<li><a href="${href}">${name}${e.isDirectory() ? '/' : ''}</a></li>`;
    })
    .join('\n');
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<style type="text/css">
:root { color-scheme: light dark; }
</style>
<title>Directory listing for ${urlPath}</title>
</head>
<body>
<h1>Directory listing for ${urlPath}</h1>
<hr>
<ul>
${rows}
</ul>
</body>
</html>
`;
}

const server = http.createServer((req, res) => {
  const route = resolveRequest(req);
  if (route.redirect && new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`).pathname !== '/artz/') {
    res.writeHead(301, { Location: route.redirect });
    res.end();
    return;
  }
  let fsPath = route.fsPath;

  let stat = fsPath ? tryStat(fsPath) : null;
  if (stat && stat.isDirectory()) {
    const indexPath = path.join(fsPath, 'index.html');
    const indexStat = tryStat(indexPath);
    if (indexStat && indexStat.isFile()) {
      fsPath = indexPath;
      stat = indexStat;
    } else {
      const html = listingHtml(fsPath, req.url.split('?')[0]);
      if (html === null) {
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('404 Not Found');
        return;
      }
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(html);
      return;
    }
  }

  if (!stat || !stat.isFile()) {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('404 Not Found');
    return;
  }

  const ext = path.extname(fsPath).toLowerCase();
  res.writeHead(200, {
    'Content-Type': MIME[ext] || 'application/octet-stream',
    'Content-Length': stat.size,
  });
  fs.createReadStream(fsPath).pipe(res);
});

function tryStat(p) {
  try {
    return fs.lstatSync(p);
  } catch {
    return null;
  }
}

let currentPort = parseInt(process.env.PORT || '8080', 10);

function startServer(port) {
  server.listen(port, () => {
    console.log(`devland static server listening on http://localhost:${port}`);
    console.log(`- /artz/              -> built artz app (artz/dist)`);
    console.log(`- /resume/            -> source`);
  });
}

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.log(`Port ${currentPort} is in use, trying port ${currentPort + 1}...`);
    currentPort += 1;
    startServer(currentPort);
  } else {
    console.error('Server error:', err);
  }
});

startServer(currentPort);

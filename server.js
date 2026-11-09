/**
 * Chart-Lab - Servidor Web Local sin Dependencias
 * Autor: Ey-Liam
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

const PORT = process.env.PORT || 3000;
const WEB_DIR = path.join(__dirname, 'web');

const MIME_TYPES = {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.ico': 'image/x-icon',
    '.mid': 'audio/midi',
    '.midi': 'audio/midi',
    '.ogg': 'audio/ogg',
    '.mp3': 'audio/mpeg',
    '.wav': 'audio/wav',
    '.flac': 'audio/flac',
    '.chart': 'text/plain; charset=utf-8',
    '.ini': 'text/plain; charset=utf-8'
};

const server = http.createServer((req, res) => {
    let reqUrl = decodeURIComponent(req.url.split('?')[0]);
    if (reqUrl === '/' || reqUrl === '/index.html') {
        reqUrl = '/index.html';
    } else if (reqUrl.startsWith('/web/')) {
        reqUrl = reqUrl.replace(/^\/web/, '');
    }

    const filePath = path.normalize(path.join(WEB_DIR, reqUrl));
    if (!filePath.startsWith(WEB_DIR)) {
        res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('Acceso denegado');
        return;
    }

    fs.stat(filePath, (err, stats) => {
        if (err || !stats.isFile()) {
            res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
            res.end('Recurso no encontrado');
            return;
        }

        const ext = path.extname(filePath).toLowerCase();
        const contentType = MIME_TYPES[ext] || 'application/octet-stream';
        res.writeHead(200, { 'Content-Type': contentType });
        fs.createReadStream(filePath).pipe(res);
    });
});

server.listen(PORT, () => {
    const url = `http://localhost:${PORT}`;
    console.log(`Servidor Chart-Lab activo en: ${url}`);
    if (process.platform === 'win32') {
        exec(`start ${url}`);
    }
});
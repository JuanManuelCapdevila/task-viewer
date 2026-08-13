#!/usr/bin/env node
'use strict';

// Servidor local sin dependencias externas (solo módulos built-in de Node)
// para navegar los .tasks/** de todos los proyectos hermanos dentro de
// GENESYS_DIR: expone un listado de proyectos, el listado de tasks de
// cada uno y el contenido crudo de cada .md, y sirve la página estática
// (index.html) que los renderiza con un selector de proyecto.
//
// La lógica de lectura/escritura de .tasks/ vive en lib/core.js, compartida
// con la extensión de VS Code (extension.js) para no duplicarla.

const http = require('http');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');
const core = require('./lib/core');

// task-viewer vive como proyecto hermano dentro de la carpeta que agrupa
// todos los repos (p.ej. .../genesys/task-viewer) — GENESYS_DIR es esa carpeta.
const GENESYS_DIR = path.resolve(__dirname, '..');
const SELF_DIR_NAME = path.basename(__dirname);
const PORT = process.env.TASKS_VIEWER_PORT ? Number(process.env.TASKS_VIEWER_PORT) : 4756;

function sendJson(res, status, data) {
  const body = JSON.stringify(data);
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Content-Length': Buffer.byteLength(body) });
  res.end(body);
}

function sendFile(res, status, filePath, contentType) {
  const body = fs.readFileSync(filePath);
  res.writeHead(status, { 'Content-Type': contentType, 'Content-Length': body.length });
  res.end(body);
}

const MAX_BODY_SIZE = 5 * 1024 * 1024; // cota de seguridad, ningún .md de tasks se acerca a esto

function readRequestBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    let size = 0;
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY_SIZE) {
        reject(new Error('Payload too large'));
        req.destroy();
        return;
      }
      data += chunk;
    });
    req.on('end', () => resolve(data));
    req.on('error', reject);
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);

  try {
    if (req.method === 'PUT') {
      const fileMatch = url.pathname.match(/^\/api\/projects\/([^/]+)\/tasks\/([^/]+)\/files\/([^/]+)$/);
      if (!fileMatch) return sendJson(res, 404, { error: 'Not found' });
      const projectId = decodeURIComponent(fileMatch[1]);
      const taskId = decodeURIComponent(fileMatch[2]);
      const fileName = decodeURIComponent(fileMatch[3]);

      const body = await readRequestBody(req);
      let parsed;
      try {
        parsed = JSON.parse(body);
      } catch {
        return sendJson(res, 400, { error: 'Invalid JSON body' });
      }
      if (typeof parsed.content !== 'string') return sendJson(res, 400, { error: 'content must be a string' });

      const result = core.saveFileContent(GENESYS_DIR, projectId, taskId, fileName, parsed.content);
      return sendJson(res, result.error ? 404 : 200, result);
    }

    if (req.method !== 'GET') return sendJson(res, 405, { error: 'Method not allowed' });

    if (url.pathname === '/' || url.pathname === '/index.html') {
      return sendFile(res, 200, path.join(__dirname, 'index.html'), 'text/html; charset=utf-8');
    }

    if (url.pathname === '/api/meta') {
      return sendJson(res, 200, { genesysDir: GENESYS_DIR });
    }

    if (url.pathname === '/api/projects') {
      return sendJson(res, 200, core.getProjects(GENESYS_DIR, SELF_DIR_NAME));
    }

    const tasksMatch = url.pathname.match(/^\/api\/projects\/([^/]+)\/tasks$/);
    if (tasksMatch) {
      const projectId = decodeURIComponent(tasksMatch[1]);
      const tasks = core.getTasks(GENESYS_DIR, projectId);
      if (!tasks) return sendJson(res, 404, { error: 'Project not found' });
      return sendJson(res, 200, tasks);
    }

    const fileMatch = url.pathname.match(/^\/api\/projects\/([^/]+)\/tasks\/([^/]+)\/files\/([^/]+)$/);
    if (fileMatch) {
      const projectId = decodeURIComponent(fileMatch[1]);
      const taskId = decodeURIComponent(fileMatch[2]);
      const fileName = decodeURIComponent(fileMatch[3]);
      const result = core.getFileContent(GENESYS_DIR, projectId, taskId, fileName);
      return sendJson(res, result.error ? 404 : 200, result);
    }

    return sendJson(res, 404, { error: 'Not found' });
  } catch (error) {
    return sendJson(res, 500, { error: error.message });
  }
});

server.listen(PORT, () => {
  console.log(`Tasks viewer disponible en http://localhost:${PORT}`);
  console.log(`Leyendo proyectos desde: ${GENESYS_DIR}`);
});

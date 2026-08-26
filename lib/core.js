'use strict';

// Lógica pura (sin HTTP) para listar/leer/escribir los .tasks/** de los
// proyectos hermanos dentro de un GENESYS_DIR. La usan tanto server.js
// (modo standalone) como extension.js (modo extensión de VS Code), cada
// uno resolviendo GENESYS_DIR a su manera.

const fs = require('fs');
const path = require('path');

// Orden de las solapas: sigue el flujo de la skill simple-spec-builder
// (requerimiento → plantillas → open questions → plan → specs), con status.md
// primero porque es el tablero de avance de la task.
const FILE_KIND_ORDER = ['status.md', 'index-spec.md', 'open-questions.md', 'implementation-plan.md', 'solution-diagrams.md'];

function classifyFile(fileName) {
  if (fileName === 'status.md') return 'status';
  if (fileName === 'index-spec.md') return 'index';
  if (fileName === 'open-questions.md') return 'open-questions';
  if (fileName === 'implementation-plan.md') return 'plan';
  if (fileName === 'solution-diagrams.md') return 'diagrams';
  if (/^spec-\d+/.test(fileName)) return 'spec';
  return 'other';
}

function humanizeSlug(slug) {
  return slug
    .replace(/^\d+-/, '')
    .replace(/-/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function firstHeading(content) {
  const match = content.match(/^#\s+(.+)$/m);
  return match ? match[1].trim() : null;
}

// Los index-spec.md se titulan "<id> — <descripción> — índice de
// especificación", pero muchos no traen descripción: "<id> — índice de
// especificación". Sacando solo el prefijo del id, esos quedaban titulados
// "índice de especificación" — el mismo texto para casi todas las tasks.
// El paréntesis opcional del final: hay headings que ponen la descripción
// ahí ("PBI-824 — Índice de Especificación (Modelo de Notificaciones)"),
// así que en vez de descartarla se la asciende a título.
const INDEX_SUFFIX_RE = /\s*[—–-]\s*(?:[ií]ndice de especificaci[oó]n(?:es)?|specification index)\s*(?:\(([^)]*)\))?\s*$/i;
// El prefijo necesita un dígito y la raya tiene que ir rodeada de espacios:
// sin eso, "857-back-agregar-filtro-…" (que es todo el id, lleno de guiones)
// se comería a sí mismo hasta el último guion y dejaría "tipo" como título.
const ID_PREFIX_RE = /^(?=\S*\d)[\w.-]+\s+[—–-]\s+/;

function titleFromHeading(heading, slug) {
  const stripped = heading
    .replace(INDEX_SUFFIX_RE, (_, paren) => (paren ? ` — ${paren}` : ''))
    .replace(ID_PREFIX_RE, '')
    .trim();
  if (!stripped) return humanizeSlug(slug);
  // Si lo que queda es un slug pelado (el heading era "<id> — índice…"), se
  // lo humaniza en vez de mostrar el kebab-case crudo.
  return /\s/.test(stripped) ? stripped : humanizeSlug(stripped);
}

// Nombres de carpeta reales (proyectos, tasks) pueden traer espacios,
// tildes u otros caracteres unicode — no son "slugs". La única regla dura
// es que no sea un separador de ruta ni un intento de traversal; el
// contenimiento real ya lo verifica cada `safe*Dir` comparando el
// directorio padre resuelto.
function isSafePathSegment(segment) {
  return typeof segment === 'string' && segment.length > 0 &&
    !segment.includes('/') && !segment.includes('\\') &&
    segment !== '.' && segment !== '..';
}

function sortFiles(files) {
  return [...files].sort((a, b) => {
    if (a.startsWith('spec-') && b.startsWith('spec-')) return a.localeCompare(b);
    const ai = FILE_KIND_ORDER.indexOf(a);
    const bi = FILE_KIND_ORDER.indexOf(b);
    if (ai === -1 && bi === -1) return a.localeCompare(b);
    if (ai === -1) return 1;
    if (bi === -1) return -1;
    return ai - bi;
  });
}

function listProjects(genesysDir, excludeDirName) {
  if (!fs.existsSync(genesysDir)) return [];

  return fs.readdirSync(genesysDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== excludeDirName)
    .map((entry) => {
      const tasksDir = path.join(genesysDir, entry.name, '.tasks');
      if (!fs.existsSync(tasksDir) || !fs.statSync(tasksDir).isDirectory()) return null;
      const taskCount = fs.readdirSync(tasksDir, { withFileTypes: true })
        .filter((e) => e.isDirectory() && !e.name.startsWith('.') && !e.name.startsWith('_'))
        .length;
      return { id: entry.name, taskCount };
    })
    .filter(Boolean)
    .sort((a, b) => a.id.localeCompare(b.id));
}

function safeProjectTasksDir(genesysDir, projectId) {
  if (!isSafePathSegment(projectId)) return null;
  const tasksDir = path.resolve(path.join(genesysDir, projectId, '.tasks'));
  if (path.dirname(path.dirname(tasksDir)) !== path.resolve(genesysDir)) return null;
  if (!fs.existsSync(tasksDir) || !fs.statSync(tasksDir).isDirectory()) return null;
  return tasksDir;
}

function listTasks(tasksDir) {
  return fs.readdirSync(tasksDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && !entry.name.startsWith('.') && !entry.name.startsWith('_'))
    .map((entry) => {
      const taskDir = path.join(tasksDir, entry.name);
      const files = sortFiles(fs.readdirSync(taskDir).filter((f) => f.endsWith('.md')));

      let title = humanizeSlug(entry.name);
      const indexPath = path.join(taskDir, 'index-spec.md');
      if (fs.existsSync(indexPath)) {
        const heading = firstHeading(fs.readFileSync(indexPath, 'utf8'));
        if (heading) title = titleFromHeading(heading, entry.name);
      }

      const mtimes = files.map((f) => fs.statSync(path.join(taskDir, f)).mtime.getTime());
      const lastUpdated = mtimes.length ? new Date(Math.max(...mtimes)).toISOString() : null;

      return {
        id: entry.name,
        title,
        specCount: files.filter((f) => f.startsWith('spec-')).length,
        hasOpenQuestions: files.includes('open-questions.md'),
        hasDiagrams: files.includes('solution-diagrams.md'),
        files: files.map((f) => ({ name: f, kind: classifyFile(f) })),
        lastUpdated
      };
    })
    .sort((a, b) => (b.lastUpdated || '').localeCompare(a.lastUpdated || ''));
}

function safeTaskDir(tasksDir, taskId) {
  if (!isSafePathSegment(taskId)) return null;
  const resolved = path.resolve(path.join(tasksDir, taskId));
  if (path.dirname(resolved) !== path.resolve(tasksDir)) return null;
  if (!fs.existsSync(resolved) || !fs.statSync(resolved).isDirectory()) return null;
  return resolved;
}

function safeFilePath(taskDir, fileName) {
  if (!isSafePathSegment(fileName) || !fileName.endsWith('.md')) return null;
  const filePath = path.join(taskDir, fileName);
  if (path.dirname(filePath) !== taskDir) return null;
  if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) return null;
  return filePath;
}

// --- Helpers de alto nivel, ya validados, para consumidores (server.js / extension.js) ---

function getProjects(genesysDir, excludeDirName) {
  return listProjects(genesysDir, excludeDirName);
}

function getTasks(genesysDir, projectId) {
  const tasksDir = safeProjectTasksDir(genesysDir, projectId);
  if (!tasksDir) return null;
  return listTasks(tasksDir);
}

function getFileContent(genesysDir, projectId, taskId, fileName) {
  const tasksDir = safeProjectTasksDir(genesysDir, projectId);
  if (!tasksDir) return { error: 'Project not found' };
  const taskDir = safeTaskDir(tasksDir, taskId);
  if (!taskDir) return { error: 'Task not found' };
  const filePath = safeFilePath(taskDir, fileName);
  if (!filePath) return { error: 'File not found' };
  return { content: fs.readFileSync(filePath, 'utf8') };
}

function saveFileContent(genesysDir, projectId, taskId, fileName, content) {
  const tasksDir = safeProjectTasksDir(genesysDir, projectId);
  if (!tasksDir) return { error: 'Project not found' };
  const taskDir = safeTaskDir(tasksDir, taskId);
  if (!taskDir) return { error: 'Task not found' };
  const filePath = safeFilePath(taskDir, fileName);
  if (!filePath) return { error: 'File not found' };
  fs.writeFileSync(filePath, content, 'utf8');
  return { ok: true };
}

module.exports = {
  classifyFile,
  titleFromHeading,
  humanizeSlug,
  firstHeading,
  sortFiles,
  listProjects,
  safeProjectTasksDir,
  listTasks,
  safeTaskDir,
  safeFilePath,
  getProjects,
  getTasks,
  getFileContent,
  saveFileContent
};

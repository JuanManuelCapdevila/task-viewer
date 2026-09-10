'use strict';

const vscode = require('vscode');
const path = require('path');
const fs = require('fs');
const os = require('os');
const crypto = require('crypto');
const core = require('./lib/core');

// Carpeta a la que se vuelve cuando no hay nada configurado.
function workspaceFallbackDir() {
  const folders = vscode.workspace.workspaceFolders;
  return folders && folders.length ? folders[0].uri.fsPath : null;
}

function resolveGenesysDir() {
  const configured = vscode.workspace.getConfiguration('taskViewer').get('genesysDir');
  if (configured) return configured;
  return workspaceFallbackDir();
}

function nonce() {
  return crypto.randomBytes(16).toString('base64');
}

// Tres roles tipográficos: texto general, títulos "pixel-art" (header y
// h1 de las specs) y monoespaciada (badges de id, código inline). El preset
// 'pixel' es el único que les da caras distintas a propósito (estética
// juego); el resto unifica todo a la misma fuente para no dejar mezclas raras.
// La tipografía es parte del tema y no se configura aparte: cada skin está
// diseñada alrededor de su fuente (métricas, tamaños, sombras), así que
// cruzarlas producía combinaciones rotas.
// decorative: la sombra dura sin blur (2px 2px 0 / 1px 1px 0) está afinada
// para las fuentes pixel-art de trazo grueso. Con cualquier otra fuente la
// misma sombra hace que el texto se vea "relleno"/borroneado, así que solo el
// preset 'pixel' la deja activa — el resto la apaga en buildHtml().
const FONT_PRESETS = {
  pixel: {
    content: "'Pixelify Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    heading: "'Press Start 2P', 'Pixelify Sans', monospace",
    mono: "'Pixelify Sans', monospace",
    decorative: true
  },
  'neo-retro': {
    content: "'Space Grotesk', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    heading: "'Archivo Black', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    mono: "'VT323', ui-monospace, Menlo, Consolas, monospace"
  },
  clean: {
    content: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    heading: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    mono: "ui-monospace, Menlo, Consolas, monospace"
  }
};

function resolveTheme() {
  const configured = (vscode.workspace.getConfiguration('taskViewer').get('theme') || '').trim();
  return configured === 'neo-retro' || configured === 'clean' ? configured : 'pixel';
}

function buildHtml(webview, extensionUri) {
  const htmlPath = vscode.Uri.joinPath(extensionUri, 'media', 'webview.html');
  let html = fs.readFileSync(htmlPath.fsPath, 'utf8');
  const vendorUri = (...segments) => webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, 'media', 'vendor', ...segments)).toString();
  const markedUri = vendorUri('marked.min.js');
  const mermaidUri = vendorUri('mermaid.min.js');
  const n = nonce();
  const theme = resolveTheme();
  const fonts = FONT_PRESETS[theme];
  const headingShadow = fonts.decorative ? '2px 2px 0 var(--wood-darker)' : 'none';
  const chipShadow = fonts.decorative ? '1px 1px 0 rgba(0, 0, 0, .3)' : 'none';

  return html
    .replace(/{{cspSource}}/g, webview.cspSource)
    .replace(/{{nonce}}/g, n)
    .replace(/{{markedUri}}/g, markedUri)
    .replace(/{{mermaidUri}}/g, mermaidUri)
    .replace(/{{themeClass}}/g, theme === 'pixel' ? '' : `theme-${theme}`)
    .replace(/{{contentFontFamily}}/g, fonts.content)
    .replace(/{{headingFontFamily}}/g, fonts.heading)
    .replace(/{{monoFontFamily}}/g, fonts.mono)
    .replace(/{{headingShadow}}/g, headingShadow)
    .replace(/{{chipShadow}}/g, chipShadow)
    .replace(/{{pixelify400Uri}}/g, vendorUri('fonts', 'pixelify-sans-400.woff2'))
    .replace(/{{pixelify500Uri}}/g, vendorUri('fonts', 'pixelify-sans-500.woff2'))
    .replace(/{{pixelify600Uri}}/g, vendorUri('fonts', 'pixelify-sans-600.woff2'))
    .replace(/{{pixelify700Uri}}/g, vendorUri('fonts', 'pixelify-sans-700.woff2'))
    .replace(/{{pressStart2pUri}}/g, vendorUri('fonts', 'press-start-2p-400.woff2'))
    .replace(/{{archivoBlackUri}}/g, vendorUri('fonts', 'archivo-black-400.woff2'))
    .replace(/{{spaceGrotesk400Uri}}/g, vendorUri('fonts', 'space-grotesk-400.woff2'))
    .replace(/{{spaceGrotesk700Uri}}/g, vendorUri('fonts', 'space-grotesk-700.woff2'))
    .replace(/{{vt323Uri}}/g, vendorUri('fonts', 'vt323-400.woff2'));
}

// ---------------------------------------------------------------------------
// Exportar un documento a PDF
// El webview arma el HTML (ver "Exportar el documento abierto a PDF" en
// media/webview.html) y acá se lo escribe en un temporal y se lo abre en el
// navegador del sistema, que es quien sabe imprimir a PDF: VS Code no expone
// ninguna API para generarlo y bloquea window.print() dentro del webview.
// ---------------------------------------------------------------------------

// El HTML exportado se abre fuera del webview (file://), donde las URIs
// vscode-resource de los @font-face no resuelven. Si la fuente no carga, el
// navegador remide el texto y los diagramas —cuyas cajas mermaid calculó con
// esa fuente— quedan con las etiquetas desbordadas, así que viajan embebidas.
// Solo las del tema activo: son las únicas que el stylesheet va a pedir.
const THEME_FONT_FILES = {
  pixel: [
    ['Pixelify Sans', 400, 'pixelify-sans-400.woff2'],
    ['Pixelify Sans', 500, 'pixelify-sans-500.woff2'],
    ['Pixelify Sans', 600, 'pixelify-sans-600.woff2'],
    ['Pixelify Sans', 700, 'pixelify-sans-700.woff2'],
    ['Press Start 2P', 400, 'press-start-2p-400.woff2']
  ],
  'neo-retro': [
    ['Space Grotesk', 400, 'space-grotesk-400.woff2'],
    ['Space Grotesk', 700, 'space-grotesk-700.woff2'],
    ['Archivo Black', 400, 'archivo-black-400.woff2'],
    ['VT323', 400, 'vt323-400.woff2']
  ],
  clean: [] // usa la tipografía del sistema, no hay nada que embeber
};

function exportFontFaces(extensionUri, theme) {
  return (THEME_FONT_FILES[theme] || []).map(([family, weight, file]) => {
    const fsPath = vscode.Uri.joinPath(extensionUri, 'media', 'vendor', 'fonts', file).fsPath;
    const data = fs.readFileSync(fsPath).toString('base64');
    return `@font-face { font-family: '${family}'; font-style: normal; font-weight: ${weight}; src: url("data:font/woff2;base64,${data}") format('woff2'); }`;
  }).join('\n');
}

// El nombre sale del id de la task y del .md abierto, pero termina siendo una
// ruta: se sanea igual, como cualquier otro segmento que venga del webview.
function exportFileName(base) {
  const clean = String(base || '').replace(/[^\w.-]+/g, '-').replace(/^[-.]+|-+$/g, '');
  return `${clean || 'documento'}.html`;
}

async function exportDoc(context, payload) {
  const html = String(payload.html)
    .replace('{{fontFaces}}', () => exportFontFaces(context.extensionUri, resolveTheme()));

  const dir = path.join(os.tmpdir(), 'task-guardian-export');
  fs.mkdirSync(dir, { recursive: true });
  // Nombre estable por documento: reexportar pisa el anterior en vez de dejar
  // una pila de copias en el temporal.
  const file = path.join(dir, exportFileName(payload.fileBase));
  fs.writeFileSync(file, html, 'utf8');

  const opened = await vscode.env.openExternal(vscode.Uri.file(file));
  if (!opened) {
    vscode.window.showWarningMessage(
      `No se pudo abrir el navegador. El documento quedó en ${file}: abrilo e imprimí a PDF.`
    );
  }
  return { ok: opened, path: file };
}

// La raíz se recuerda por workspace: es una preferencia de "para este
// checkout, mirá esta carpeta", y guardarla global haría que un solo pick
// pisara la raíz de todas las demás ventanas. Si ya hay un valor puesto a otro
// nivel se respeta ese, porque escribir en uno más débil sería un no-op
// invisible; y sin workspace abierto no queda más opción que la global.
function genesysDirTarget() {
  const info = vscode.workspace.getConfiguration('taskViewer').inspect('genesysDir') || {};
  if (info.workspaceFolderValue) return vscode.ConfigurationTarget.WorkspaceFolder;
  if (info.workspaceValue) return vscode.ConfigurationTarget.Workspace;
  if (info.globalValue) return vscode.ConfigurationTarget.Global;
  return vscode.workspace.workspaceFolders
    ? vscode.ConfigurationTarget.Workspace
    : vscode.ConfigurationTarget.Global;
}

// Borra el valor en todos los niveles donde esté puesto, no solo en el que
// escribiríamos: si quedó uno global de antes, limpiar solo el del workspace
// dejaría el visor apuntando igual a la carpeta vieja.
async function clearGenesysDir() {
  const config = vscode.workspace.getConfiguration('taskViewer');
  const info = config.inspect('genesysDir') || {};
  const targets = [
    [info.workspaceFolderValue, vscode.ConfigurationTarget.WorkspaceFolder],
    [info.workspaceValue, vscode.ConfigurationTarget.Workspace],
    [info.globalValue, vscode.ConfigurationTarget.Global]
  ];
  for (const [value, target] of targets) {
    if (value) await config.update('genesysDir', undefined, target);
  }
}

async function browseForGenesysDir(current) {
  const picked = await vscode.window.showOpenDialog({
    canSelectFolders: true,
    canSelectFiles: false,
    canSelectMany: false,
    openLabel: 'Usar como raíz',
    title: 'Carpeta que agrupa los proyectos con .tasks/',
    defaultUri: current ? vscode.Uri.file(current) : undefined
  });
  return picked && picked.length ? picked[0].fsPath : null;
}

// Devuelve la raíz vigente aunque se cancele, así el webview siempre puede
// refrescar su estado.
async function pickGenesysDir() {
  const current = resolveGenesysDir();
  const fallback = workspaceFallbackDir();
  const configured = vscode.workspace.getConfiguration('taskViewer').get('genesysDir');

  // Con un valor guardado que tapa la carpeta del workspace, el diálogo solo
  // no alcanza: haría falta editar settings.json a mano para volver atrás.
  const canReset = configured && fallback && path.resolve(configured) !== path.resolve(fallback);
  if (canReset) {
    const BROWSE = 'Elegir otra carpeta…';
    const RESET = 'Usar la carpeta del workspace';
    const choice = await vscode.window.showQuickPick(
      [{ label: BROWSE }, { label: RESET, description: fallback }],
      { title: `Carpeta raíz — actual: ${current}` }
    );
    if (!choice) return { genesysDir: current, cancelled: true };
    if (choice.label === RESET) {
      await clearGenesysDir();
      return { genesysDir: fallback, cancelled: false };
    }
  }

  const chosen = await browseForGenesysDir(current);
  if (!chosen) return { genesysDir: current, cancelled: true };
  // Elegir justo la carpeta del workspace se trata como "volver al default":
  // deja la config limpia en vez de fijar una ruta que ya era la implícita.
  if (fallback && path.resolve(chosen) === path.resolve(fallback)) {
    await clearGenesysDir();
    return { genesysDir: fallback, cancelled: false };
  }
  await vscode.workspace.getConfiguration('taskViewer')
    .update('genesysDir', chosen, genesysDirTarget());
  return { genesysDir: chosen, cancelled: false };
}

// ---------------------------------------------------------------------------
// Auto-refresh de la task abierta
// El visor suele estar abierto al lado de un agente que va reescribiendo las
// specs; antes había que apretar "Actualizar" para ver texto que ya estaba en
// disco. Se vigila solo la carpeta de la task abierta (un watcher por webview,
// recreado en cada cambio de selección): es lo único que se está mirando, y un
// watcher sobre la raíz entera dispararía por cualquier proyecto.
// ---------------------------------------------------------------------------

// Una escritura puede llegar como varios eventos (create + change), y un agente
// que reescribe varias specs seguidas dispararía un repintado por cada una.
const WATCH_DEBOUNCE_MS = 250;

// Ventana en la que se ignoran los cambios de un archivo que acabamos de
// escribir nosotros (checkbox / campo "Other" del propio visor). Sin esto cada
// guardado volvería como "cambio externo" y repintaría el documento justo
// debajo del cursor.
const SELF_WRITE_WINDOW_MS = 2000;

const watchers = new Map(); // webview -> { key, dispose }
const selfWrites = new Map(); // fsPath -> timestamp

function markSelfWrite(fsPath) {
  const now = Date.now();
  for (const [p, at] of selfWrites) {
    if (now - at > SELF_WRITE_WINDOW_MS) selfWrites.delete(p);
  }
  selfWrites.set(fsPath, now);
}

function isSelfWrite(fsPath) {
  const at = selfWrites.get(fsPath);
  return at !== undefined && Date.now() - at < SELF_WRITE_WINDOW_MS;
}

function resolveTaskDir(genesysDir, projectId, taskId) {
  const tasksDir = core.safeProjectTasksDir(genesysDir, projectId);
  return tasksDir ? core.safeTaskDir(tasksDir, taskId) : null;
}

function stopWatching(webview) {
  const entry = watchers.get(webview);
  if (!entry) return;
  entry.dispose();
  watchers.delete(webview);
}

// `taskId` nulo (o carpeta inexistente) deja al webview sin watcher: es el caso
// de "ningún proyecto/task seleccionado".
function watchTask(webview, projectId, taskId) {
  const genesysDir = resolveGenesysDir();
  const taskDir = genesysDir && projectId && taskId
    ? resolveTaskDir(genesysDir, projectId, taskId)
    : null;

  const current = watchers.get(webview);
  if (current && current.key === taskDir) return { watching: !!taskDir };
  stopWatching(webview);
  if (!taskDir) return { watching: false };

  const watcher = vscode.workspace.createFileSystemWatcher(
    new vscode.RelativePattern(vscode.Uri.file(taskDir), '*.md')
  );
  let timer = null;
  const schedule = () => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      webview.postMessage({ type: 'taskChanged', project: projectId, task: taskId });
    }, WATCH_DEBOUNCE_MS);
  };
  // El filtro de escrituras propias solo aplica a modificaciones: un alta o una
  // baja nunca las origina el visor, y perdérselas dejaría solapas fantasma.
  watcher.onDidChange((uri) => { if (!isSelfWrite(uri.fsPath)) schedule(); });
  watcher.onDidCreate(schedule);
  watcher.onDidDelete(schedule);

  watchers.set(webview, {
    key: taskDir,
    dispose: () => { clearTimeout(timer); watcher.dispose(); }
  });
  return { watching: true };
}

// La raíz se resuelve en cada mensaje, no una sola vez al crear el webview:
// si quedara capturada en el closure, cambiarla desde la UI no tendría efecto
// hasta recargar la ventana.
async function handleMessage(excludeDirName, msg) {
  const { type, payload } = msg;
  const genesysDir = resolveGenesysDir();

  if (type === 'meta') return { genesysDir };
  if (type === 'pickRoot') return pickGenesysDir();
  // Sin raíz no hay nada que listar ni que escribir; se responde vacío para
  // que el webview muestre su estado vacío en vez de un error opaco.
  if (!genesysDir) {
    if (type === 'projects') return [];
    throw new Error('No hay carpeta raíz configurada');
  }

  switch (type) {
    case 'projects':
      return core.getProjects(genesysDir, excludeDirName);
    case 'tasks': {
      const tasks = core.getTasks(genesysDir, payload.project);
      if (!tasks) throw new Error('Project not found');
      return tasks;
    }
    case 'file':
      return core.getFileContent(genesysDir, payload.project, payload.task, payload.file);
    case 'saveFile': {
      const result = core.saveFileContent(genesysDir, payload.project, payload.task, payload.file, payload.content);
      if (result.ok) {
        const taskDir = resolveTaskDir(genesysDir, payload.project, payload.task);
        if (taskDir) markSelfWrite(path.join(taskDir, payload.file));
      }
      return result;
    }
    default:
      throw new Error(`Unknown message type: ${type}`);
  }
}

const liveWebviews = new Set();

function wireWebview(webview, context) {
  webview.options = {
    enableScripts: true,
    localResourceRoots: [vscode.Uri.joinPath(context.extensionUri, 'media')]
  };

  // Se monta el visor aunque no haya raíz: su estado vacío incluye el botón
  // para elegirla, cosa que el cartel de error que había antes no ofrecía.
  webview.html = buildHtml(webview, context.extensionUri);
  webview.onDidReceiveMessage(async (msg) => {
    try {
      // 'watch' y 'exportDoc' se atienden acá y no en handleMessage porque no
      // les alcanza con la carpeta raíz: uno necesita el webview (el watcher es
      // por vista, no global) y el otro las fuentes de la extensión.
      let result;
      if (msg.type === 'watch') result = watchTask(webview, msg.payload.project, msg.payload.task);
      else if (msg.type === 'exportDoc') result = await exportDoc(context, msg.payload);
      else result = await handleMessage(path.basename(context.extensionPath), msg);
      webview.postMessage({ id: msg.id, result });
    } catch (err) {
      webview.postMessage({ id: msg.id, error: err.message });
    }
  }, undefined, context.subscriptions);

  liveWebviews.add(webview);
}

function disposeWebview(webview) {
  stopWatching(webview);
  liveWebviews.delete(webview);
}

function openPanel(context) {
  const panel = vscode.window.createWebviewPanel(
    'taskViewer',
    'Task Guardian',
    vscode.ViewColumn.One,
    { retainContextWhenHidden: true }
  );
  wireWebview(panel.webview, context);
  panel.onDidDispose(() => disposeWebview(panel.webview), undefined, context.subscriptions);
}

class TaskViewerViewProvider {
  constructor(context) {
    this.context = context;
  }
  resolveWebviewView(webviewView) {
    wireWebview(webviewView.webview, this.context);
    webviewView.onDidDispose(() => disposeWebview(webviewView.webview));
  }
}

function activate(context) {
  context.subscriptions.push(
    vscode.commands.registerCommand('taskViewer.open', () => openPanel(context)),
    // Mismo picker que el link del header, accesible desde la paleta cuando
    // el visor no está abierto.
    vscode.commands.registerCommand('taskViewer.pickRoot', () => pickGenesysDir()),
    vscode.window.registerWebviewViewProvider(
      'taskViewer.view',
      new TaskViewerViewProvider(context),
      { webviewOptions: { retainContextWhenHidden: true } }
    ),
    vscode.workspace.onDidChangeConfiguration((e) => {
      // El tema cambia CSS y fuentes: hay que reconstruir el HTML entero.
      if (e.affectsConfiguration('taskViewer.theme')) {
        for (const webview of liveWebviews) {
          webview.html = buildHtml(webview, context.extensionUri);
        }
        return;
      }
      // La raíz solo cambia los datos. Se avisa en vez de reconstruir para no
      // perder la task y la solapa abiertas cuando el cambio no vino de la UI
      // (settings.json a mano, sync entre ventanas).
      if (e.affectsConfiguration('taskViewer.genesysDir')) {
        const genesysDir = resolveGenesysDir();
        for (const webview of liveWebviews) {
          webview.postMessage({ type: 'rootChanged', genesysDir });
        }
      }
    })
  );
}

function deactivate() {
  for (const webview of [...watchers.keys()]) stopWatching(webview);
}

module.exports = { activate, deactivate };

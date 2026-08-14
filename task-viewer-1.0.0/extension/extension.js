'use strict';

const vscode = require('vscode');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const core = require('./lib/core');

function resolveGenesysDir() {
  const configured = vscode.workspace.getConfiguration('taskViewer').get('genesysDir');
  if (configured) return configured;
  const folders = vscode.workspace.workspaceFolders;
  if (folders && folders.length) return folders[0].uri.fsPath;
  return null;
}

function nonce() {
  return crypto.randomBytes(16).toString('base64');
}

// Tres roles tipográficos: texto general, títulos "pixel-art" (header y
// h1 de las specs) y monoespaciada (badges de id, código inline). El preset
// 'pixel' es el único que les da caras distintas a propósito (estética
// juego); el resto de los presets unifica todo a la misma fuente para no
// dejar mezclas raras.
const FONT_PRESETS = {
  pixel: {
    content: "'Pixelify Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    heading: "'Press Start 2P', 'Pixelify Sans', monospace",
    mono: "'Pixelify Sans', monospace"
  },
  'neo-retro': {
    content: "'Space Grotesk', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    heading: "'Archivo Black', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    mono: "'VT323', ui-monospace, Menlo, Consolas, monospace"
  },
  vscode: {
    content: "var(--vscode-font-family, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif)",
    heading: "var(--vscode-font-family, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif)",
    mono: "var(--vscode-editor-font-family, ui-monospace, Menlo, Consolas, monospace)"
  },
  system: {
    content: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    heading: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    mono: "ui-monospace, Menlo, Consolas, monospace"
  }
};

function resolveTheme() {
  const configured = (vscode.workspace.getConfiguration('taskViewer').get('theme') || '').trim();
  return configured === 'neo-retro' ? 'neo-retro' : 'pixel';
}

// El setting de fuente es una preferencia explícita del usuario y, si está
// seteado a un valor concreto (vscode/system/custom), pisa la tipografía por
// defecto de cualquier tema. Si se lo deja en 'pixel' (el default del
// setting), se interpreta como "no elegí nada" y cada tema usa la suya.
function resolveFontFamilies(theme) {
  const configured = (vscode.workspace.getConfiguration('taskViewer').get('fontFamily') || '').trim();
  if (!configured || configured === 'pixel') return FONT_PRESETS[theme] || FONT_PRESETS.pixel;
  if (FONT_PRESETS[configured]) return FONT_PRESETS[configured];
  // Valor libre: se asume una lista de font-family CSS tipeada a mano,
  // aplicada por igual a texto general y títulos.
  return {
    content: `${configured}, sans-serif`,
    heading: `${configured}, sans-serif`,
    mono: `${configured}, ui-monospace, Menlo, Consolas, monospace`
  };
}

function buildHtml(webview, extensionUri) {
  const htmlPath = vscode.Uri.joinPath(extensionUri, 'media', 'webview.html');
  let html = fs.readFileSync(htmlPath.fsPath, 'utf8');
  const vendorUri = (...segments) => webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, 'media', 'vendor', ...segments)).toString();
  const markedUri = vendorUri('marked.min.js');
  const mermaidUri = vendorUri('mermaid.min.js');
  const n = nonce();
  const theme = resolveTheme();
  const fonts = resolveFontFamilies(theme);

  return html
    .replace(/{{cspSource}}/g, webview.cspSource)
    .replace(/{{nonce}}/g, n)
    .replace(/{{markedUri}}/g, markedUri)
    .replace(/{{mermaidUri}}/g, mermaidUri)
    .replace(/{{themeClass}}/g, theme === 'neo-retro' ? 'theme-neo-retro' : '')
    .replace(/{{contentFontFamily}}/g, fonts.content)
    .replace(/{{headingFontFamily}}/g, fonts.heading)
    .replace(/{{monoFontFamily}}/g, fonts.mono)
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

async function handleMessage(genesysDir, excludeDirName, msg) {
  const { type, payload } = msg;
  switch (type) {
    case 'meta':
      return { genesysDir };
    case 'projects':
      return core.getProjects(genesysDir, excludeDirName);
    case 'tasks': {
      const tasks = core.getTasks(genesysDir, payload.project);
      if (!tasks) throw new Error('Project not found');
      return tasks;
    }
    case 'file':
      return core.getFileContent(genesysDir, payload.project, payload.task, payload.file);
    case 'saveFile':
      return core.saveFileContent(genesysDir, payload.project, payload.task, payload.file, payload.content);
    default:
      throw new Error(`Unknown message type: ${type}`);
  }
}

const liveWebviews = new Set();

function wireWebview(webview, context) {
  const genesysDir = resolveGenesysDir();
  webview.options = {
    enableScripts: true,
    localResourceRoots: [vscode.Uri.joinPath(context.extensionUri, 'media')]
  };

  if (!genesysDir) {
    webview.html = '<body style="font-family: sans-serif; padding: 16px;">Abrí una carpeta (workspace) que contenga los proyectos con <code>.tasks/</code>, o configurá <code>taskViewer.genesysDir</code>.</body>';
    return;
  }

  webview.html = buildHtml(webview, context.extensionUri);
  webview.onDidReceiveMessage(async (msg) => {
    try {
      const result = await handleMessage(genesysDir, path.basename(context.extensionPath), msg);
      webview.postMessage({ id: msg.id, result });
    } catch (err) {
      webview.postMessage({ id: msg.id, error: err.message });
    }
  }, undefined, context.subscriptions);

  liveWebviews.add(webview);
}

function openPanel(context) {
  const panel = vscode.window.createWebviewPanel(
    'taskViewer',
    'Task Guardian',
    vscode.ViewColumn.One,
    { retainContextWhenHidden: true }
  );
  wireWebview(panel.webview, context);
  panel.onDidDispose(() => liveWebviews.delete(panel.webview), undefined, context.subscriptions);
}

class TaskViewerViewProvider {
  constructor(context) {
    this.context = context;
  }
  resolveWebviewView(webviewView) {
    wireWebview(webviewView.webview, this.context);
    webviewView.onDidDispose(() => liveWebviews.delete(webviewView.webview));
  }
}

function activate(context) {
  context.subscriptions.push(
    vscode.commands.registerCommand('taskViewer.open', () => openPanel(context)),
    vscode.window.registerWebviewViewProvider(
      'taskViewer.view',
      new TaskViewerViewProvider(context),
      { webviewOptions: { retainContextWhenHidden: true } }
    ),
    vscode.workspace.onDidChangeConfiguration((e) => {
      if (!e.affectsConfiguration('taskViewer.fontFamily') && !e.affectsConfiguration('taskViewer.theme')) return;
      for (const webview of liveWebviews) {
        webview.html = buildHtml(webview, context.extensionUri);
      }
    })
  );
}

function deactivate() {}

module.exports = { activate, deactivate };

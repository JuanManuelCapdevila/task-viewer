# task-viewer

Visor único de `.tasks/` para todos los proyectos hermanos dentro de `genesys/`.
No tiene dependencias externas (solo `http`/`fs` built-in de Node).

Funciona en dos modos, ambos sobre la misma lógica compartida en `lib/core.js`:

- **Standalone**: servidor HTTP (`server.js`) + `index.html` estático.
- **Extensión de VS Code**: comando `Task Guardian: Abrir visor de tasks`, que abre
  un webview equivalente sin necesidad de levantar ningún servidor.

## Uso standalone

```bash
node server.js
# o
npm start
```

Por defecto escucha en `http://localhost:4756` (configurable con `TASKS_VIEWER_PORT`).

El servidor escanea todas las carpetas hermanas de `task-viewer/` (es decir,
todo lo que hay en `genesys/`) y lista como "proyecto" a cada una que tenga
una carpeta `.tasks/`. El selector de proyecto en la UI permite cambiar entre
ellos sin reiniciar el servidor; la última selección se recuerda en
`localStorage` y también queda en la URL (`?project=...&task=...&file=...`)
para poder compartir un link directo.

Al mover o renombrar un proyecto dentro de `genesys/`, no hace falta tocar
nada acá: el listado de proyectos se recalcula en cada request a
`/api/projects`.

## Uso como extensión de VS Code

1. Abrí esta carpeta (`task-viewer/`) en VS Code.
2. F5 (o "Run and Debug" → "Run Task Guardian extension") abre una segunda
   ventana de VS Code ("Extension Development Host") con la carpeta
   `genesys/` (la carpeta padre) como workspace.
3. En esa ventana, `Ctrl+Shift+P` → `Task Guardian: Abrir visor de tasks`.

Por defecto la extensión usa la raíz del workspace abierto como `GENESYS_DIR`.
Se puede sobreescribir con la config `taskViewer.genesysDir` (Settings →
buscar "Task Guardian").

El webview no depende de red: `marked` y `mermaid` están vendorizados en
`media/vendor/` y se cargan vía `asWebviewUri`. La comunicación con el
extension host (listar proyectos/tasks, leer y guardar archivos) va por
`postMessage`, reemplazando los `fetch()` a `/api/*` de la versión standalone.

### Empaquetar (.vsix)

```bash
npx @vscode/vsce package
```

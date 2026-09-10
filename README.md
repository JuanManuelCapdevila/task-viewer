# Task Guardian

Visor de specs y tasks en Markdown para VS Code. Recorre las carpetas `.tasks/`
de todos tus proyectos y las muestra como un tablero navegable: listado de
tasks, solapas por documento, diagramas Mermaid renderizados y checkboxes que
se guardan al archivo.

No tiene dependencias externas: `marked` y `mermaid` van vendorizados, así que
el visor funciona sin red.

## La convención de carpetas

La extensión espera una carpeta raíz que agrupe varios proyectos, y en cada uno
una carpeta `.tasks/` con una subcarpeta por task:

```
mi-raiz/
├── proyecto-a/
│   └── .tasks/
│       ├── 101-alta-de-clientes/
│       │   ├── status.md
│       │   ├── index-spec.md
│       │   ├── open-questions.md
│       │   ├── implementation-plan.md
│       │   ├── solution-diagrams.md
│       │   └── spec-01-alta.md
│       └── 102-baja-de-clientes/
└── proyecto-b/
    └── .tasks/
```

Los nombres de archivo conocidos (`status.md`, `index-spec.md`,
`open-questions.md`, `implementation-plan.md`, `solution-diagrams.md`,
`spec-NN-*.md`) se ordenan y etiquetan siguiendo ese flujo. Cualquier otro
`.md` de la carpeta se muestra igual, al final.

## Qué hace

- **Listado por proyecto**, con contador de specs, indicadores de preguntas
  abiertas y diagramas, y última modificación. El título de cada task sale del
  primer encabezado de su `index-spec.md`.
- **Panel de avance** para `status.md`: porcentaje, stepper de etapas y las
  specs como fichas, en vez del markdown crudo.
- **Diagramas Mermaid** con zoom, pan y pantalla completa.
- **Edición liviana**: los checkboxes de listas de tareas y los campos
  `**Other:**` de los open questions se escriben de vuelta al archivo.
- **Exportar a PDF**: el botón **🖨️ PDF** de la barra de solapas se lleva el
  documento abierto —diagramas incluidos— a un HTML autocontenido que se abre en
  el navegador con el diálogo de impresión ya arriba: eligiendo *Guardar como
  PDF* queda un archivo para compartir, con el texto seleccionable y los
  diagramas vectoriales. Pasa por el navegador porque VS Code no sabe generar
  PDFs y bloquea la impresión dentro de un webview.
- **Refresco automático**: mientras tenés una task abierta, la extensión vigila
  su carpeta y recarga sola cuando los `.md` cambian en disco — pensado para
  trabajar al lado de un agente que va escribiendo las specs. Si estás editando
  un campo en ese momento, el refresco espera a que sueltes el foco para no
  pisarte lo que estás tipeando.

## Uso

Se abre de dos formas:

- El ícono **Task Guardian** en la barra lateral.
- `Ctrl+Shift+P` → **Task Guardian: Abrir visor de tasks (pestaña)**, que lo
  abre como pestaña ancha (mejor para la tabla de 6 columnas).

Por defecto usa la raíz del workspace abierto. Para apuntar a otra carpeta:
el link **cambiar** debajo del título, o `Ctrl+Shift+P` → **Task Guardian:
Elegir carpeta raíz**. La elección se guarda por workspace, así cada ventana
recuerda la suya.

## Configuración

| Setting | Default | Qué hace |
| --- | --- | --- |
| `taskViewer.genesysDir` | `""` | Carpeta que agrupa los proyectos con `.tasks/`. Vacía = raíz del workspace |
| `taskViewer.theme` | `pixel` | `pixel` (estética retro), `neo-retro` (bordes duros, paleta cobalto/rojo) o `clean` (minimal, tipografía del sistema) |

Cada tema trae su propia tipografía: están diseñados alrededor de ella
(métricas, tamaños, sombras), por eso no se configuran por separado.

## Modo standalone

La misma lógica (`lib/core.js`) corre como servidor HTTP, sin VS Code:

```bash
node server.js   # o: npm start
```

Escucha en `http://localhost:4756` (configurable con `TASKS_VIEWER_PORT`) y
sirve `index.html`. Lista como proyecto a cada carpeta hermana de
`task-viewer/` que tenga un `.tasks/`. La selección queda en la URL
(`?project=...&task=...&file=...`) para compartir un link directo.

> El modo standalone quedó atrás en funcionalidad respecto de la extensión
> (no tiene temas, panel de status ni refresco automático).

## Desarrollo

1. Abrí esta carpeta en VS Code.
2. F5 → "Run Task Guardian extension" abre una segunda ventana (Extension
   Development Host) con la carpeta padre como workspace.
3. Ahí, `Ctrl+Shift+P` → **Task Guardian: Abrir visor de tasks**.

El webview se comunica con el extension host por `postMessage` (listar
proyectos y tasks, leer y guardar archivos, registrar el watcher), reemplazando
los `fetch()` a `/api/*` del modo standalone.

Para empaquetar:

```bash
npx @vscode/vsce package
```

## Licencia

MIT — ver [LICENSE](LICENSE).

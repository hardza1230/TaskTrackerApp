# TaskTrackerApp — RAG Knowledge Base for AI Assistants

> **Purpose**: เอกสารนี้ให้บริบทครบถ้วนแก่ AI เพื่อให้สามารถช่วยแก้บัค เพิ่มฟีเจอร์ และบำรุงรักษาโค้ดได้อย่างถูกต้องโดยไม่ต้องอ่านไฟล์ซ้ำ

---

## 1. Project Overview

| Item | Value |
|---|---|
| App Name | Planner Want to Go Home |
| Type | Electron Desktop App |
| Platform | Windows |
| Entry Point | `main.js` (Electron main process) |
| Renderer Entry | `js/main.js` (ES Module) |
| Styling | Tailwind CSS (CDN), Custom CSS in `<style>` tag |
| Icons | Font Awesome 6 (CDN) |
| Drag & Drop | Sortable.js (CDN) |

---

## 2. File Structure

```
TaskTrackerApp/
├── main.js               # Electron main process — IPC handlers
├── preload.js            # Context bridge — exposes electronAPI to renderer
├── index.html            # Single HTML page with all layout
├── js/
│   ├── main.js           # Renderer entry point — init, global window fns
│   ├── state.js          # App state, localStorage persistence, migrations
│   ├── ui.js             # Render functions (tasks, shortcuts, edit mode)
│   ├── automation.js     # Python runner, Excel refresh, macro runner
│   ├── modal.js          # Automation modal + Excel Toast Modal logic
│   ├── logger.js         # logBot() — standalone, MUST NOT import other app modules
│   ├── events.js         # Event listeners, toggleEditMode, toggleTask, etc.
│   └── canvas.js         # (UNUSED — do not import) Legacy canvas code
├── .github/workflows/    # GitHub Actions — builds portable .exe only
└── *.py                  # Python automation scripts (external deps like playwright)
```

---

## 3. Module Import Graph (Dependency Order)

```
state.js          ← no app imports
logger.js         ← no app imports  ← NEVER add imports here (avoids circular deps)
   ↑
modal.js          ← imports: logger.js
ui.js             ← imports: state.js
automation.js     ← imports: state.js, ui.js, logger.js, modal.js
events.js         ← imports: state.js, ui.js, logger.js
js/main.js        ← imports: state.js, ui.js, automation.js, logger.js, events.js, modal.js
```

> ⚠️ **Critical Rule**: `logger.js` MUST remain import-free. Adding imports to it will recreate the circular dependency bug that was previously fixed.

---

## 4. Key Data Structures

### `appState` (in `state.js`)

```js
{
  currentDate: Date,
  isEditMode: boolean,
  masterData: Workflow[],  // array of workflow groups
  shortcuts: Shortcut[],
  progress: { [key: string]: string },  // key = "wfIdx_tIdx", value = timeStr
  collapsedCards: { [wfIdx: number]: boolean },
  sidebarCollapsed: boolean,
  appTitle: string,
  scratchpadText: string
}
```

### `Workflow`

```js
{
  id: number,           // Date.now()
  title: string,
  tasks: Task[]
}
```

### `Task`

```js
{
  name: string,
  link: string,         // file path (.py, .xlsx, .xlsm, .exe, .bat) or URL
  time: string,         // e.g. "5m", display only
  favorite: boolean,
  subtasks: string[],
  refreshExcel: boolean // if true and link is Excel → use Auto Refresh flow
}
```

### `Shortcut`

```js
{
  name: string,
  link: string,
  icon: string  // Font Awesome class e.g. "fa-bolt"
}
```

---

## 5. IPC API (Electron)

### `preload.js` → `window.electronAPI`

| Method | Main Process Handler | Description |
|---|---|---|
| `openFile(path)` | `open-file` | Opens file with default OS app via `shell.openPath()` |
| `refreshExcel(path)` | `refresh-excel` | Runs PowerShell script to Open → RefreshAll → Save → Close Excel |
| `runPython(path)` | `run-python` | Spawns `python` process with `shell:true`, streams stdout/stderr |
| `dialogChooseFile()` | `dialog-choose-file` | Opens file picker, returns selected path |
| `onPythonLog(cb)` | IPC event `python-log` | Streams stdout/stderr from Python process to renderer |

### PowerShell Excel Refresh Flow (in `main.js`)
1. Writes a temp `.ps1` file to `os.tmpdir()`
2. Calls `Excel.Application` COM object
3. Opens file → `RefreshAll()` → waits for queries → `Save()` → `Close()` → `Quit()`
4. Deletes temp `.ps1` file on completion

---

## 6. Automation Flows

### Python Script Execution (`openLinkWithConfig`)
1. Detects `.py` extension on `task.link`
2. Shows `showAutomationModal()` (big center modal) unless `skipModal=true`
3. Calls `window.electronAPI.runPython(path)` → awaits result
4. On success: marks task done, calls `saveProgress()`, `renderTasks()`
5. On failure: surfaces `stderr` in Log panel and modal
6. Playwright missing: main process appends Thai-language install tip to error message

### Excel Auto Refresh (`refreshExcelData`)
1. Only runs if `task.refreshExcel === true`
2. Shows small **Toast Modal** (bottom-right, `#excel-toast-modal`) instead of large modal
3. Calls `window.electronAPI.refreshExcel(path)` → awaits result
4. On success: marks task done, calls `hideExcelToast()` after 2.5s

### Launch All / Macro (`runMacro`)
- Iterates all tasks in a workflow that have a `link`
- For Excel + `refreshExcel` tasks → calls `refreshExcelData(..., skipModal=true)`
- For all others → calls `openLinkWithConfig(..., skipModal=true)`
- Shows the large Automation Modal with step count and progress bar

---

## 7. UI Rendering Rules

### `renderTasks()` in `ui.js`
- Clears `#task-grid` and re-renders all cards from `appState.masterData`
- **Edit Mode (`appState.isEditMode === true`)**: Shows inputs for name, time, link (with Browse button), subtasks, delete buttons
- **Normal Mode**: Shows checklist view with checkboxes, timestamps, link/run buttons
- Input fields use `onblur` (NOT `onchange`) to save — prevents focus loss on re-render
- `initSortable()` is called after render in Edit Mode to enable drag-drop reorder

### `updateEditModeUI()` in `ui.js`
- Changes `#edit-mode-btn` text/style between "Edit Mode" and "Done ✓"
- Shows/hides the `#add-workflow-fab` float button

### `updateProgressBar()` in `ui.js`
- Updates `#overall-progress-bar` width, `#progress-percent`, `#progress-count`
- Called on init and every 60 seconds

---

## 8. Event Binding Rules

> ⚠️ **Avoid Double Binding**: The `edit-mode-btn` is bound **only via `addEventListener`** in `events.js`. Do NOT add `onclick="toggleEditMode()"` to the HTML element — this causes double-firing.

### Pattern for HTML inline events (from rendered innerHTML)
Functions called from `innerHTML` strings (e.g., `onclick="toggleTask(0,1)"`) must be on `window`:
```js
window.toggleTask = toggleTask;       // from events.js
window.openLinkWithConfig = ...;      // from automation.js
window.updateTask = ...;              // lambda in main.js
window.addTask = ...;                 // lambda in main.js
// etc.
```

### Events bound via `addEventListener` (in `events.js`)
- `#date-picker` → change
- `#today-btn` → click
- `#edit-mode-btn` → click → `toggleEditMode()`
- `#sidebar-toggle` → click → `window.toggleSidebar()`
- `#add-shortcut-btn` → click → `window.addShortcut()`
- `#add-workflow-fab` → click → `window.addWorkflow()`
- `#reset-day-btn` → click → confirm + `localStorage.clear()`
- `#export-btn`, `#import-btn`, `#import-file-input` → export/import JSON
- `#app-title-input` → blur (updates appTitle)
- `python-log` IPC → streams to `logBot()`

---

## 9. LocalStorage Keys

| Key | Value |
|---|---|
| `taskMasterData` | `JSON.stringify(appState.masterData)` |
| `shortcutData` | `JSON.stringify(appState.shortcuts)` |
| `collapsedCards` | `JSON.stringify(appState.collapsedCards)` |
| `sidebarCollapsed` | `'true'` or `'false'` |
| `appTitle` | string |
| `scratchpadText` | string |
| `progress_YYYY-MM-DD` | `JSON.stringify(appState.progress)` per-day |

---

## 10. HTML Elements Reference

| Element ID | Purpose |
|---|---|
| `#task-grid` | Task cards container (masonry layout) |
| `#edit-mode-btn` | Toggle Edit Mode |
| `#add-workflow-fab` | FAB to add new workflow (visible in Edit Mode) |
| `#sidebar` | Left sidebar (collapsible via `.collapsed` class) |
| `#shortcuts-container` | Shortcut buttons area |
| `#log-panel` | Sliding Bot Output panel (bottom-right) |
| `#log-content` | Log entries container |
| `#log-badge` | Dot pulse indicator for new logs |
| `#log-chevron` | Chevron icon on log panel header |
| `#clock-display` | Live clock in header |
| `#overall-progress-bar` | Water-flow progress bar |
| `#progress-percent` | e.g. "45%" |
| `#progress-count` | e.g. "5/11 Tasks" |
| `#date-picker` | Date input (ISO format) |
| `#today-btn` | Jump to today |
| `#toast` | Center toast notification |
| `#toast-message` | Toast text |
| `#toast-icon` / `#toast-icon-container` | Toast icon |
| `#automation-modal` | Large center modal for Python/macro runs |
| `#excel-toast-modal` | Small bottom-right toast for Excel refresh |
| `#excel-toast-title` | Excel toast title text |
| `#excel-toast-msg` | Excel toast status message |
| `#excel-toast-icon` | Excel toast icon |
| `#excel-toast-spinner` | Spinning border ring |
| `#app-title-input` | Sidebar app title input (NOT #header-title) |
| `#scratchpad-input` | Scratchpad textarea |
| `#import-file-input` | Hidden file input for JSON import |

---

## 11. Known Bugs Fixed (History)

| Bug | Root Cause | Fix Applied |
|---|---|---|
| App crashes on load | `modal.js` → `automation.js` → `modal.js` circular import | Created `logger.js` (import-free) |
| Edit Mode inputs go blank on type | `onchange` triggered full re-render, destroying focus | Changed to `onblur` |
| Edit Mode button fires twice | Bound both via addEventListener AND onclick attr in HTML | Removed onclick from HTML button |
| App title not loading | `getElementById('header-title')` but element ID is `app-title-input` | Fixed to use `.value` on input |
| Python ENOENT spawn error | `python` not found without `shell:true` | Added `shell: true` to spawn |
| Playwright error not visible | stderr not streamed to renderer | Stderr now sent via `python-log` IPC event |

---

## 12. GitHub Actions Build

- **Workflow file**: `.github/workflows/build.yml`
- **Output**: Portable `.exe` only (no NSIS installer)
- **Tool**: `electron-builder`
- **Trigger**: Push to `main` branch

---

## 13. Common AI Task Patterns

### Adding a new field to Task
1. Add migration in `state.js` `loadData()`:  
   `wf.tasks.forEach(t => { if (t.newField === undefined) t.newField = defaultValue; })`
2. Add UI in `ui.js` `renderTasks()` — both **Edit Mode** and **Normal Mode** branches
3. Expose via `window.updateTask` in `js/main.js` (already handles any field via the generic updater)

### Adding a new IPC handler
1. Add handler in `main.js` (Electron main):  
   `ipcMain.handle('my-channel', async (event, ...args) => { ... })`
2. Expose in `preload.js`:  
   `myMethod: async (...args) => ipcRenderer.invoke('my-channel', ...args)`
3. Use in renderer:  
   `await window.electronAPI.myMethod(...)`

### Adding a new UI button (from JS-rendered HTML)
1. Add `onclick="window.myFn(...args)"` in the rendered HTML string inside `ui.js`
2. Define function and expose as `window.myFn = function(...) { ... }` in `js/main.js`

### Adding a new UI button (static HTML in index.html)
1. Add element with a unique `id` to `index.html`
2. Add `addEventListener` in `events.js` `setupEventListeners()`
3. Do NOT use both `onclick` attr AND `addEventListener` for the same button

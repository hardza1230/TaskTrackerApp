import { appState, ICONS, CARD_COLORS, saveData, saveProgress, CARD_MIN_W } from './state.js';

const GRID = 20;   // snap-to-grid step in px

// ─── Board scale/pan state ────────────────────────────────────────────────────
let boardScale = 1;
let boardPanX = 0;
let boardPanY = 0;

export function getBoardTransform() { return { scale: boardScale, panX: boardPanX, panY: boardPanY }; }
export function setBoardTransform(s, x, y) { boardScale = s; boardPanX = x; boardPanY = y; }

// ─── Public API ───────────────────────────────────────────────────────────────
export function renderAll() {
    renderShortcuts();
    renderAutomations();
    renderTasks();
    updateProgressBar();
    updateEditModeUI();
}

// ─── Shortcuts ────────────────────────────────────────────────────────────────
export function renderShortcuts() {
    const container = document.getElementById('shortcuts-container');
    if (!container) return;
    container.innerHTML = '';

    appState.shortcuts.forEach((sc, idx) => {
        const btn = document.createElement('div');
        const iconClass = sc.icon || 'fa-bolt';
        if (appState.isEditMode) {
            let iconOptions = ICONS.map(i => `<option value="${i.id}" ${iconClass === i.id ? 'selected' : ''}>${i.label}</option>`).join('');
            btn.className = 'flex flex-col gap-2 p-3 bg-white/10 rounded-xl border border-white/20 mb-2';
            btn.innerHTML = `
                <div class="flex gap-2">
                    <select class="text-xs w-10 bg-black/20 text-white rounded p-1 border border-white/10 focus:outline-none" onchange="updateShortcut(${idx},'icon',this.value)">${iconOptions}</select>
                    <input type="text" value="${sc.name}" class="w-full text-xs bg-black/20 text-white rounded p-1.5 border border-white/10 focus:outline-none" onblur="updateShortcut(${idx},'name',this.value)">
                </div>
                <input type="text" value="${sc.link}" class="w-full text-xs bg-black/20 text-indigo-100 rounded p-1.5 border border-white/10 focus:outline-none" onblur="updateShortcut(${idx},'link',this.value)">
                <button onclick="deleteShortcut(${idx})" class="text-xs text-red-300 bg-red-500/20 py-1 rounded w-full hover:bg-red-500/30">Delete</button>
            `;
        } else {
            btn.className = 'flex items-center gap-3 px-3 py-2.5 rounded-xl text-indigo-50 hover:bg-white/10 transition-all cursor-pointer border border-transparent hover:border-white/10 sidebar-icon-only';
            btn.onclick = () => window.electronAPI.openFile(sc.link);
            btn.innerHTML = `
                <div class="w-7 h-7 flex items-center justify-center flex-shrink-0 bg-white/5 rounded-lg"><i class="fa-solid ${iconClass} text-xs text-yellow-300"></i></div>
                <span class="whitespace-nowrap text-sm font-medium truncate sidebar-text">${sc.name}</span>
            `;
        }
        container.appendChild(btn);
    });
}

// ─── Automations (sidebar tab) ────────────────────────────────────────────────
export function renderAutomations() {
    const container = document.getElementById('automate-container');
    if (!container) return;
    container.innerHTML = '';

    appState.automations.forEach((a, idx) => {
        const item = document.createElement('div');
        if (appState.isEditMode) {
            item.className = 'bg-white/10 rounded-xl p-3 mb-2 flex flex-col gap-2';
            item.innerHTML = `
                <input type="text" value="${a.name}" class="text-xs bg-black/20 text-white rounded p-1.5 border border-white/10 focus:outline-none w-full" placeholder="ชื่อ" onblur="updateAutomation(${idx},'name',this.value)">
                <div class="flex gap-1">
                    <input type="text" value="${a.path}" class="text-xs bg-black/20 text-white rounded p-1.5 border border-white/10 focus:outline-none flex-grow" placeholder="Path .py" onblur="updateAutomation(${idx},'path',this.value)">
                    <button onclick="browseAutomationPath(${idx})" class="text-xs px-2 bg-indigo-500/30 text-indigo-200 rounded hover:bg-indigo-500/50">📂</button>
                </div>
                <button onclick="deleteAutomation(${idx})" class="text-xs text-red-300 bg-red-500/20 py-1 rounded w-full hover:bg-red-500/30">Delete</button>
            `;
        } else {
            item.className = 'flex items-center gap-3 px-3 py-2.5 rounded-xl text-orange-100 hover:bg-white/10 transition-all cursor-pointer border border-transparent hover:border-white/10 group';
            item.innerHTML = `
                <div class="w-7 h-7 flex items-center justify-center flex-shrink-0 bg-orange-500/20 rounded-lg flex-shrink-0">
                    <i class="fa-brands fa-python text-xs text-orange-300"></i>
                </div>
                <span class="text-sm font-medium truncate flex-grow sidebar-text">${a.name}</span>
                <button onclick="event.stopPropagation(); runAutomation(${idx})" 
                    class="w-6 h-6 bg-orange-500/20 rounded-lg flex items-center justify-center hover:bg-orange-500/60 transition-colors flex-shrink-0 opacity-0 group-hover:opacity-100" 
                    title="Run">
                    <i class="fa-solid fa-play text-[10px] text-orange-200"></i>
                </button>
            `;
        }
        container.appendChild(item);
    });
}

// ─── Tasks (Board View) ───────────────────────────────────────────────────────
export function renderTasks() {
    const container = document.getElementById('board-pan-container');
    if (!container) return;
    container.innerHTML = '';

    const query = (appState.searchQuery || '').trim().toLowerCase();

    appState.masterData.forEach((wf, wfIdx) => {
        let isCollapsed = appState.collapsedCards[wfIdx] !== false; // default collapsed

        if (query) {
            const matchTitle = wf.title.toLowerCase().includes(query);
            const matchAnyTask = wf.tasks.some(t => t.name.toLowerCase().includes(query));
            if (!matchTitle && !matchAnyTask) {
                return; // Hide this card if it doesn't match the search
            }
            if (matchAnyTask) isCollapsed = false; // force expand if a task matches
        }

        const color = CARD_COLORS[wfIdx % CARD_COLORS.length];
        const completedCount = wf.tasks.filter((_, tIdx) => appState.progress[`${wfIdx}_${tIdx}`]).length;
        const total = wf.tasks.length;
        const percent = total === 0 ? 0 : Math.round((completedCount / total) * 100);

        const card = document.createElement('div');
        card.id = `board-card-${wfIdx}`;
        card.className = [
            'absolute bg-white rounded-2xl shadow-lg border-2 flex flex-col overflow-visible',
            'transition-shadow duration-200 select-none',
            'border-slate-200 hover:shadow-xl',
            query ? 'ring-2 ring-amber-400' : '' // highlight card slightly when searching
        ].join(' ');
        card.style.left = (wf.boardX || 24) + 'px';
        card.style.top = (wf.boardY || 24) + 'px';
        card.style.width = (wf.boardW || CARD_MIN_W) + 'px';
        card.style.cursor = 'grab';

        if (appState.isEditMode) {
            card.innerHTML = buildEditCard(wf, wfIdx, color);
        } else {
            card.innerHTML = buildViewCard(wf, wfIdx, color, isCollapsed, completedCount, total, percent, query);
        }

        // Apply saved custom height if exists and not collapsed
        if (wf.boardH && !isCollapsed && !appState.isEditMode) {
            card.style.height = wf.boardH + 'px';
            const listContainer = card.querySelector('.custom-scrollbar');
            if (listContainer) {
                listContainer.style.maxHeight = 'none';
                listContainer.classList.add('flex-grow');
            }
        }

        // Add Resize Handle
        const resizeHandle = document.createElement('div');
        resizeHandle.className = 'absolute bottom-0 right-0 w-5 h-5 cursor-se-resize flex items-end justify-end p-1 text-slate-300 hover:text-teal-500 transition-colors z-10';
        resizeHandle.innerHTML = '<i class="fa-solid fa-caret-down -rotate-45 text-[10px]"></i>';
        card.appendChild(resizeHandle);

        makeBoardCardDraggable(card, wfIdx);
        makeBoardCardResizable(card, resizeHandle, wfIdx);
        container.appendChild(card);
    });

    if (appState.isEditMode) initSortable();
}

// ─── Card HTML builders ───────────────────────────────────────────────────────
function buildViewCard(wf, wfIdx, color, isCollapsed, done, total, percent, query) {
    const chevron = isCollapsed ? 'fa-chevron-down' : 'fa-chevron-up';
    let taskListHtml = '';

    if (!isCollapsed) {
        wf.tasks.forEach((task, tIdx) => {
            if (query && !task.name.toLowerCase().includes(query) && !wf.title.toLowerCase().includes(query)) {
                return; // skip rendering this task if it doesn't match and the card title doesn't match
            }

            const isDone = !!appState.progress[`${wfIdx}_${tIdx}`];
            const timestamp = isDone && typeof appState.progress[`${wfIdx}_${tIdx}`] === 'string'
                ? appState.progress[`${wfIdx}_${tIdx}`] : '';

            let btns = '';
            if (task.link) {
                const isPy = task.link.toLowerCase().endsWith('.py');
                const isXls = task.link.toLowerCase().match(/\.(xlsx|xlsm|xls)$/);
                if (isXls && task.refreshExcel) {
                    btns += `<button onclick="refreshExcelData(${wfIdx},${tIdx});event.stopPropagation();" class="p-1 hover:bg-orange-50 rounded" title="Refresh Excel"><i id="btn-refresh-${wfIdx}-${tIdx}" class="fa-solid fa-arrows-rotate text-orange-500 text-xs"></i></button>`;
                }
                const runIcon = isPy ? 'fa-brands fa-python text-amber-500' : 'fa-solid fa-arrow-up-right-from-square text-teal-500';
                btns += `<button onclick="openLinkWithConfig(${wfIdx},${tIdx});event.stopPropagation();" class="p-1 hover:bg-teal-50 rounded"><i id="btn-open-${wfIdx}-${tIdx}" class="fa-solid ${runIcon} text-xs"></i></button>`;
            }

            taskListHtml += `
                <div class="flex items-start gap-2 py-1.5 px-3 hover:bg-slate-50 rounded-lg cursor-pointer group task-item-row" onclick="toggleTask(${wfIdx},${tIdx})">
                    <div class="pt-0.5 flex-shrink-0">
                        <input type="checkbox" class="custom-checkbox" ${isDone ? 'checked' : ''} onclick="event.stopPropagation();toggleTask(${wfIdx},${tIdx});">
                    </div>
                    <div class="flex-grow min-w-0 pt-0.5">
                        <span class="text-xs ${isDone ? 'line-through text-slate-400' : 'text-slate-700'} font-medium leading-snug block truncate">${task.name}</span>
                        ${task.time ? `<span class="text-[10px] text-slate-400 font-mono"><i class="fa-regular fa-clock mr-0.5"></i>${task.time}</span>` : ''}
                        ${timestamp ? `<span class="text-[10px] text-teal-500 font-mono ml-1">✓${timestamp}</span>` : ''}
                    </div>
                    <div onclick="event.stopPropagation()" class="flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">${btns}</div>
                </div>
            `;
        });
    }

    const runAllBtn = !isCollapsed && wf.tasks.some(t => t.link)
        ? `<div class="px-3 pb-3"><button onclick="runMacro(${wfIdx})" id="macro-btn-${wfIdx}" class="w-full py-1.5 bg-slate-50 border border-slate-200 text-teal-700 rounded-lg text-xs font-bold hover:bg-teal-600 hover:text-white hover:border-teal-600 transition-all"><i class="fa-solid fa-rocket mr-1"></i>Launch All</button></div>`
        : '';

    return `
        <div class="h-1 rounded-t-2xl" style="background:${color}"></div>
        <div class="px-4 py-3 cursor-pointer hover:bg-slate-50 rounded-t-xl transition-colors card-header-handle">
            <div class="flex justify-between items-center mb-1.5">
                <h3 class="font-bold text-sm text-slate-800 line-clamp-1 flex-grow" style="color:${color}">${wf.title}</h3>
                <div class="flex items-center gap-2 flex-shrink-0">
                    <span class="text-xs font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">${done}/${total}</span>
                    <i class="fa-solid ${chevron} text-slate-300 text-xs transition-transform duration-200"></i>
                </div>
            </div>
            <div class="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                <div class="h-1.5 rounded-full transition-all duration-500" style="width:${percent}%;background:${color}"></div>
            </div>
        </div>
        ${isCollapsed ? '' : `<div class="px-1 pb-2 flex flex-col gap-0.5 max-h-72 overflow-y-auto custom-scrollbar">${taskListHtml}</div>`}
        ${runAllBtn}
    `;
}

function buildEditCard(wf, wfIdx, color) {
    let taskList = wf.tasks.map((task, tIdx) => {
        const isPython = task.link && task.link.toLowerCase().endsWith('.py');
        const isExcel = task.link && task.link.toLowerCase().match(/\.(xlsx|xlsm|xls)$/);
        const typeTag = isPython
            ? `<span class="text-[9px] px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded font-bold ml-1">PY</span>`
            : isExcel ? `<span class="text-[9px] px-1.5 py-0.5 bg-green-100 text-green-700 rounded font-bold ml-1">XLS</span>` : '';
        const excelToggle = isExcel ? `
            <label class="flex items-center gap-1 mt-1 text-[10px] text-slate-500 cursor-pointer">
                <input type="checkbox" ${task.refreshExcel ? 'checked' : ''} onchange="updateTask(${wfIdx},${tIdx},'refreshExcel',this.checked)" class="w-3 h-3">
                Auto Refresh
            </label>` : '';
        return `
            <div class="bg-slate-50 rounded-xl border border-slate-200 p-3 mb-2">
                <div class="flex gap-2 items-center mb-2">
                    <button onclick="toggleFavorite(${wfIdx},${tIdx})" class="${task.favorite ? 'text-yellow-400' : 'text-slate-300'} hover:text-yellow-400 text-sm transition-colors"><i class="fa-solid fa-star"></i></button>
                    <input type="text" value="${task.name}" placeholder="Task name" class="flex-grow text-xs font-bold text-slate-700 bg-white border border-slate-200 rounded-lg p-1.5 focus:ring-2 focus:ring-teal-400 focus:outline-none" onblur="updateTask(${wfIdx},${tIdx},'name',this.value)">
                    <input type="text" value="${task.time || ''}" placeholder="Time" class="w-16 text-xs text-center bg-white border border-slate-200 rounded-lg p-1.5 focus:outline-none" onblur="updateTask(${wfIdx},${tIdx},'time',this.value)">
                    <button onclick="removeTask(${wfIdx},${tIdx})" class="text-slate-300 hover:text-red-500 p-1 rounded hover:bg-red-50 transition-colors"><i class="fa-solid fa-trash text-xs"></i></button>
                </div>
                <div class="flex gap-1 items-center">
                    <i class="fa-solid fa-link text-slate-300 text-xs"></i>${typeTag}
                    <input type="text" value="${task.link || ''}" placeholder="Path / Link..." class="flex-grow text-xs bg-white border border-slate-200 rounded-lg p-1.5 focus:outline-none text-slate-600" onblur="updateTask(${wfIdx},${tIdx},'link',this.value)">
                    <button onclick="browseFilePath(${wfIdx},${tIdx})" class="px-2 py-1.5 bg-indigo-50 text-indigo-600 text-xs rounded-lg border border-indigo-200 hover:bg-indigo-600 hover:text-white transition-colors"><i class="fa-solid fa-folder-open"></i></button>
                </div>
                ${excelToggle}
            </div>
        `;
    }).join('');

    return `
        <div class="h-1 rounded-t-2xl" style="background:${color}"></div>
        <div class="px-4 py-3 border-b border-slate-100">
            <div class="flex items-center gap-2">
                <i class="fa-solid fa-grip-vertical text-slate-300 cursor-move handle"></i>
                <input type="text" value="${wf.title}" class="font-bold text-sm text-slate-800 bg-transparent focus:outline-none focus:border-b focus:border-teal-500 w-full" onblur="updateWorkflowTitle(${wfIdx},this.value)">
                <button onclick="deleteWorkflow(${wfIdx})" class="text-slate-300 hover:text-red-500 p-1 rounded hover:bg-red-50"><i class="fa-solid fa-trash text-xs"></i></button>
            </div>
        </div>
        <div class="px-3 py-3 max-h-80 overflow-y-auto custom-scrollbar">${taskList}</div>
        <div class="px-3 pb-3">
            <button onclick="addTask(${wfIdx})" class="w-full py-2 border border-dashed border-teal-300 text-teal-600 rounded-xl text-xs font-bold hover:bg-teal-50 transition-colors">+ Add Task</button>
        </div>
    `;
}

// ─── Board Drag (Cards) ───────────────────────────────────────────────────────
function makeBoardCardDraggable(card, wfIdx) {
    let dragging = false;
    let isClick = true;
    let startMX = 0, startMY = 0;
    let startCX = 0, startCY = 0;

    card.addEventListener('mousedown', (e) => {
        if (e.target.closest('button') || e.target.closest('input') ||
            e.target.closest('.task-item-row') || e.target.closest('.custom-checkbox')) return;
        dragging = true;
        isClick = true;
        startMX = e.clientX;
        startMY = e.clientY;
        startCX = appState.masterData[wfIdx].boardX || 0;
        startCY = appState.masterData[wfIdx].boardY || 0;
        card.style.cursor = 'grabbing';
        card.style.zIndex = '100';
        card.classList.add('shadow-2xl');
        e.preventDefault();
    });

    document.addEventListener('mousemove', (e) => {
        if (!dragging) return;
        if (Math.abs(e.clientX - startMX) > 3 || Math.abs(e.clientY - startMY) > 3) {
            isClick = false;
        }
        const { scale } = getBoardTransform();
        const dx = (e.clientX - startMX) / scale;
        const dy = (e.clientY - startMY) / scale;
        const newX = Math.max(0, Math.round((startCX + dx) / GRID) * GRID);
        const newY = Math.max(0, Math.round((startCY + dy) / GRID) * GRID);
        card.style.left = newX + 'px';
        card.style.top = newY + 'px';
    });

    document.addEventListener('mouseup', (e) => {
        if (!dragging) return;
        dragging = false;
        card.style.cursor = 'grab';
        card.style.zIndex = '';
        card.classList.remove('shadow-2xl');

        if (isClick && e.target.closest('.card-header-handle')) {
            window.toggleCollapse(wfIdx);
        } else {
            const { scale } = getBoardTransform();
            const dx = (e.clientX - startMX) / scale;
            const dy = (e.clientY - startMY) / scale;
            appState.masterData[wfIdx].boardX = Math.max(0, Math.round((startCX + dx) / GRID) * GRID);
            appState.masterData[wfIdx].boardY = Math.max(0, Math.round((startCY + dy) / GRID) * GRID);
            saveData();
        }
    });
}

function makeBoardCardResizable(card, handle, wfIdx) {
    let resizing = false;
    let startMX = 0;
    let startMY = 0;
    let startW = 0;
    let startH = 0;

    handle.addEventListener('mousedown', (e) => {
        e.stopPropagation(); // prevent triggering drag
        resizing = true;
        startMX = e.clientX;
        startMY = e.clientY;
        startW = appState.masterData[wfIdx].boardW || CARD_MIN_W;
        startH = appState.masterData[wfIdx].boardH || card.offsetHeight || 150;
        card.style.zIndex = '101';
        e.preventDefault();
    });

    document.addEventListener('mousemove', (e) => {
        if (!resizing) return;
        const { scale } = getBoardTransform();
        const dx = (e.clientX - startMX) / scale;
        const dy = (e.clientY - startMY) / scale;

        let newW = Math.round((startW + dx) / GRID) * GRID;
        newW = Math.max(CARD_MIN_W, newW);
        card.style.width = newW + 'px';

        let newH = Math.round((startH + dy) / GRID) * GRID;
        newH = Math.max(100, newH); // minimum height 100px
        card.style.height = newH + 'px';

        // we adjust the inner custom-scrollbar area to fill the space
        const listContainer = card.querySelector('.custom-scrollbar');
        if (listContainer) {
            // Need to remove max-h constraint when fixed size
            listContainer.style.maxHeight = 'none';
            // Flex grow so it takes available space in case of custom height
            listContainer.classList.add('flex-grow');
        }
    });

    document.addEventListener('mouseup', (e) => {
        if (!resizing) return;
        resizing = false;
        card.style.zIndex = '';

        const { scale } = getBoardTransform();
        const dx = (e.clientX - startMX) / scale;
        const dy = (e.clientY - startMY) / scale;

        let newW = Math.round((startW + dx) / GRID) * GRID;
        newW = Math.max(CARD_MIN_W, newW);
        appState.masterData[wfIdx].boardW = newW;

        let newH = Math.round((startH + dy) / GRID) * GRID;
        newH = Math.max(100, newH);
        appState.masterData[wfIdx].boardH = newH;

        saveData();
    });
}
// ─── Progress bar ─────────────────────────────────────────────────────────────
export function updateProgressBar() {
    let total = 0, done = 0;
    appState.masterData.forEach((wf, wIdx) => wf.tasks.forEach((_, tIdx) => { total++; if (appState.progress[`${wIdx}_${tIdx}`]) done++; }));
    const pct = total === 0 ? 0 : Math.round((done / total) * 100);
    document.getElementById('overall-progress-bar').style.width = `${pct}%`;
    document.getElementById('progress-percent').innerText = `${pct}%`;
    document.getElementById('progress-count').innerText = `${done}/${total} Tasks`;
}

// ─── Edit mode UI ─────────────────────────────────────────────────────────────
export function updateEditModeUI() {
    const btn = document.getElementById('edit-mode-btn');
    const fab = document.getElementById('add-workflow-fab');
    if (appState.isEditMode) {
        btn.innerHTML = '<i class="fa-solid fa-check"></i> <span class="hidden sm:inline">Done</span>';
        btn.className = "bg-green-500 text-white px-4 py-2 rounded-xl shadow-sm text-sm font-bold flex items-center gap-2 h-10 hover:bg-green-600 transition-all";
        if (fab) { fab.classList.remove('hidden'); fab.classList.add('flex'); }
    } else {
        btn.innerHTML = '<i class="fa-solid fa-pen-to-square"></i> <span class="hidden sm:inline">Edit Mode</span>';
        btn.className = "bg-white border border-indigo-100 text-indigo-600 hover:bg-indigo-50 px-4 py-2 rounded-xl shadow-sm text-sm font-bold flex items-center gap-2 h-10 transition-all";
        if (fab) { fab.classList.remove('flex'); fab.classList.add('hidden'); }
    }
}

// ─── Sortable in edit mode ────────────────────────────────────────────────────
export function initSortable() {
    if (window.Sortable) {
        const grid = document.getElementById('board-pan-container');
        if (grid) {
            new window.Sortable(grid, { handle: '.handle', animation: 250, ghostClass: 'opacity-50' });
        }
    }
}

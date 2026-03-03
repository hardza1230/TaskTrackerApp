/**
 * TaskTrackerApp Renderer Logic
 * Moved from index.html for modularity
 */

const ICONS = [
    { id: 'fa-bolt', label: 'ด่วน' }, { id: 'fa-star', label: 'สำคัญ' }, { id: 'fa-file-excel', label: 'Excel' },
    { id: 'fa-globe', label: 'เว็บ' }, { id: 'fa-envelope', label: 'เมล' }, { id: 'fa-calendar', label: 'แผน' },
    { id: 'fa-truck-fast', label: 'รถ' }, { id: 'fa-industry', label: 'ผลิต' }
];

const CARD_COLORS = ['#EF4444', '#F59E0B', '#10B981', '#3B82F6', '#8B5CF6', '#EC4899', '#06B6D4', '#F97316'];

const SNIPPETS = ["✅ Complete", "⚠️ Pending", "❌ Machine Breakdown", "รอวัตถุดิบ", "ส่งแผนแล้ว", "ติดประชุม", "รออนุมัติ", "กำลังดำเนินการ"];

// Fallback for development outside Electron
if (typeof window.electronAPI === 'undefined') {
    window.electronAPI = {
        openFile: async (path) => { console.log(`[Sim] Open: ${path}`); return { success: true }; },
        refreshExcel: async (path) => { console.log(`[Sim] Refresh Excel: ${path}`); await new Promise(r => setTimeout(r, 2000)); return { success: true }; },
        runPython: async (path) => { console.log(`[Sim] Run Python: ${path}`); await new Promise(r => setTimeout(r, 2000)); return { success: true }; }
    };
}

const appState = {
    currentDate: new Date(),
    isEditMode: false,
    masterData: [],
    shortcuts: [],
    progress: {},
    collapsedCards: {},
    sidebarCollapsed: false,
    appTitle: "Planner Home",
    scratchpadText: ""
};

const DEFAULT_DATA = [{ "id": 1, "title": "Start Day", "tasks": [{ "name": "Login", "link": "", "time": "5m", "favorite": false, "subtasks": [], "refreshExcel": false }] }];

function init() {
    loadData();
    setupEventListeners();
    renderAll();
    startClock();

    // Listen for real-time Python logs
    if (window.electronAPI.onPythonLog) {
        window.electronAPI.onPythonLog((data) => {
            logBot(data.trim(), 'info');
        });
    }
}

function loadData() {
    const savedData = localStorage.getItem('taskMasterData');
    appState.masterData = savedData ? JSON.parse(savedData) : DEFAULT_DATA;

    // --- Migration: แทรกแท็บ Automate Jobs ถ้ายังไม่มี ---
    const hasCitrix = appState.masterData.some(wf => wf.title === "Automate Citrix Job");
    if (!hasCitrix) {
        appState.masterData.unshift({
            id: Date.now() + Math.random(),
            title: "Automate Citrix Job",
            tasks: [
                { name: "Run Citrix Auto-Login", link: "C:\\Users\\norrasates\\Desktop\\Automate Job\\citrix_full_automation.py", time: "1m", favorite: true, subtasks: [], refreshExcel: false },
                { name: "Production Data Extraction (BIS)", link: "C:\\Users\\norrasates\\Desktop\\Automate Job\\bis_automation.py", time: "5m", favorite: true, subtasks: [], refreshExcel: false }
            ]
        });
        saveData();
    }

    // --- Migration: เติม field ใหม่ให้ tasks เก่า ---
    appState.masterData.forEach(wf => {
        wf.tasks.forEach(t => {
            if (t.time === undefined) t.time = "";
            if (t.favorite === undefined) t.favorite = false;
            if (t.subtasks === undefined) t.subtasks = [];
            if (t.refreshExcel === undefined) t.refreshExcel = false;
        });
    });

    const savedShortcuts = localStorage.getItem('shortcutData');
    appState.shortcuts = savedShortcuts ? JSON.parse(savedShortcuts) : [];
    const savedCollapsed = localStorage.getItem('collapsedCards');
    appState.collapsedCards = savedCollapsed ? JSON.parse(savedCollapsed) : {};
    const sbState = localStorage.getItem('sidebarCollapsed');
    if (sbState === 'true') {
        appState.sidebarCollapsed = true;
        document.getElementById('sidebar').classList.add('collapsed');
        document.querySelector('#sidebar-toggle i').classList.replace('fa-chevron-left', 'fa-chevron-right');
    }
    const savedTitle = localStorage.getItem('appTitle');
    if (savedTitle) {
        appState.appTitle = savedTitle;
        document.getElementById('app-title-input').value = savedTitle;
    }

    const savedScratch = localStorage.getItem('scratchpadText');
    if (savedScratch) {
        appState.scratchpadText = savedScratch;
        const spInput = document.getElementById('scratchpad-input');
        if (spInput) spInput.value = savedScratch;
    }

    loadProgress();
}

function loadProgress() {
    const key = `progress_${appState.currentDate.toISOString().split('T')[0]}`;
    appState.progress = JSON.parse(localStorage.getItem(key)) || {};
}

function saveData() {
    localStorage.setItem('taskMasterData', JSON.stringify(appState.masterData));
    localStorage.setItem('shortcutData', JSON.stringify(appState.shortcuts));
    localStorage.setItem('collapsedCards', JSON.stringify(appState.collapsedCards));
    localStorage.setItem('sidebarCollapsed', appState.sidebarCollapsed);
    localStorage.setItem('appTitle', appState.appTitle);
}

function saveProgress() {
    const key = `progress_${appState.currentDate.toISOString().split('T')[0]}`;
    localStorage.setItem(key, JSON.stringify(appState.progress));
    updateProgressBar();
}

// --- RENDER LOGIC ---
function renderAll() {
    document.getElementById('date-picker').value = appState.currentDate.toISOString().split('T')[0];
    renderShortcuts();
    renderTasks();
    updateProgressBar();
    updateEditModeUI();
}

function renderShortcuts() {
    const container = document.getElementById('shortcuts-container');
    container.innerHTML = '';
    appState.shortcuts.forEach((sc, idx) => {
        const btn = document.createElement('div');
        const iconClass = sc.icon || 'fa-bolt';
        if (appState.isEditMode) {
            let iconOptions = ICONS.map(i => `<option value="${i.id}" ${iconClass === i.id ? 'selected' : ''}>${i.label}</option>`).join('');
            btn.className = 'flex flex-col gap-2 p-3 bg-white/10 rounded-xl border border-white/20 mb-3 sidebar-icon-only';
            btn.innerHTML = `
                <div class="flex gap-2">
                     <select class="text-xs w-10 bg-black/20 text-white rounded p-1 border border-white/10 focus:outline-none" onchange="updateShortcut(${idx}, 'icon', this.value)">${iconOptions}</select>
                     <input type="text" value="${sc.name}" class="w-full text-xs bg-black/20 text-white rounded p-1.5 border border-white/10 focus:outline-none" onchange="updateShortcut(${idx}, 'name', this.value)">
                </div>
                <input type="text" value="${sc.link}" class="w-full text-xs bg-black/20 text-indigo-100 rounded p-1.5 border border-white/10 focus:outline-none" onchange="updateShortcut(${idx}, 'link', this.value)">
                <button onclick="deleteShortcut(${idx})" class="text-xs text-red-300 bg-red-500/20 py-1 rounded w-full hover:bg-red-500/30 transition-colors">Delete</button>
            `;
        } else {
            btn.className = 'flex items-center gap-4 px-4 py-3 rounded-xl text-indigo-50 hover:bg-white/10 hover:text-white transition-all cursor-pointer group/item border border-transparent hover:border-white/10 sidebar-icon-only';
            btn.onclick = () => window.electronAPI.openFile(sc.link);
            btn.innerHTML = `
                <div class="w-8 h-8 flex items-center justify-center flex-shrink-0 bg-white/5 rounded-lg group-hover/item:bg-white/20 transition-colors"><i class="fa-solid ${iconClass} text-sm text-yellow-300"></i></div>
                <span class="whitespace-nowrap text-sm font-medium truncate sidebar-text">${sc.name}</span>
            `;
        }
        container.appendChild(btn);
    });
}

function renderTasks() {
    const grid = document.getElementById('task-grid');
    grid.innerHTML = '';
    appState.masterData.forEach((wf, wfIdx) => {
        const isCollapsed = appState.collapsedCards[wfIdx];
        const color = CARD_COLORS[wfIdx % CARD_COLORS.length];
        const card = document.createElement('div');
        card.className = 'task-card flex flex-col animate-fade-in group/card relative';

        let header = '';
        const completedCount = wf.tasks.filter((_, tIdx) => appState.progress[`${wfIdx}_${tIdx}`]).length;
        const total = wf.tasks.length;
        const percent = total === 0 ? 0 : Math.round((completedCount / total) * 100);
        const colorBar = `<div class="card-header-color" style="background-color: ${color};"></div>`;

        if (appState.isEditMode) {
            header = `
                <div class="p-4 pb-2">
                    <div class="flex items-center gap-3 mb-2 border-b border-gray-100 pb-2">
                        <i class="fa-solid fa-grip-vertical text-gray-300 cursor-move handle text-sm hover:text-indigo-500"></i>
                        <input type="text" value="${wf.title}" class="font-bold text-base text-gray-800 bg-transparent focus:outline-none w-full focus:border-b focus:border-indigo-500" onchange="updateWorkflowTitle(${wfIdx}, this.value)">
                        <button onclick="deleteWorkflow(${wfIdx})" class="text-red-400 hover:text-red-600 p-2 rounded-full hover:bg-red-50 transition-colors"><i class="fa-solid fa-trash text-sm"></i></button>
                    </div>
                </div>
            `;
        } else {
            const chevron = isCollapsed ? 'fa-chevron-down' : 'fa-chevron-up';
            header = `
                <div class="p-4 pb-3 cursor-pointer hover:bg-gray-50 transition-colors" onclick="toggleCollapse(${wfIdx})">
                    <div class="flex justify-between items-center mb-2">
                        <h3 class="font-bold text-base text-slate-800 line-clamp-1" style="color: ${color}">${wf.title}</h3>
                        <div class="flex items-center gap-2">
                            <span class="text-xs font-bold text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">${completedCount}/${total}</span>
                            <i class="fa-solid ${chevron} text-gray-300 text-xs transition-transform duration-200"></i>
                        </div>
                    </div>
                    <div class="w-full bg-gray-100 h-1.5 rounded-full overflow-hidden">
                         <div class="h-1.5 rounded-full transition-all duration-300" style="width: ${percent}%; background-color: ${color}"></div>
                    </div>
                </div>
            `;
        }

        const displayStyle = isCollapsed && !appState.isEditMode ? 'none' : 'block';
        let taskList = `<div class="px-4 pb-4 space-y-2 flex-grow sortable-tasks" data-wf="${wfIdx}" style="display: ${displayStyle}">`;

        wf.tasks.forEach((task, tIdx) => {
            const isFav = task.favorite;

            if (appState.isEditMode) {
                let subtasksHtml = '';
                task.subtasks.forEach((st, stIdx) => {
                    subtasksHtml += `
                        <div class="flex items-center gap-2 mt-2 ml-6">
                            <i class="fa-solid fa-level-up-alt rotate-90 text-gray-300 text-xs"></i>
                            <input type="text" value="${st}" class="text-sm bg-white border border-gray-200 rounded p-1 focus:ring-1 focus:ring-teal-500 w-full" placeholder="Sub-task name" onchange="updateSubtask(${wfIdx}, ${tIdx}, ${stIdx}, this.value)">
                            <button onclick="removeSubtask(${wfIdx}, ${tIdx}, ${stIdx})" class="text-red-400 p-1"><i class="fa-solid fa-times text-xs"></i></button>
                        </div>
                    `;
                });

                const isExcel = task.link && task.link.toLowerCase().match(/\.(xlsx|xlsm|xls)$/);
                let excelToggle = '';
                if (isExcel) {
                    excelToggle = `
                        <label class="flex items-center gap-2 mt-2 cursor-pointer">
                            <input type="checkbox" ${task.refreshExcel ? 'checked' : ''} onchange="updateTask(${wfIdx}, ${tIdx}, 'refreshExcel', this.checked)" class="w-4 h-4 text-teal-600 border-gray-300 rounded focus:ring-teal-500">
                            <span class="text-xs font-bold text-gray-500">Show Refresh Excel Button</span>
                        </label>
                    `;
                }

                taskList += `
                    <div class="bg-gray-50 p-3 rounded-lg border border-gray-200 mb-2 shadow-sm">
                        <div class="flex gap-2 mb-2 items-center">
                            <button onclick="toggleFavorite(${wfIdx}, ${tIdx})" class="${isFav ? 'text-yellow-400' : 'text-gray-300 hover:text-yellow-400'} transition-colors"><i class="fa-solid fa-star"></i></button>
                            <input type="text" value="${task.name}" class="text-sm w-full font-medium bg-white border border-gray-200 rounded p-1.5 focus:ring-2 focus:ring-teal-500 focus:outline-none" onchange="updateTask(${wfIdx}, ${tIdx}, 'name', this.value)">
                            <input type="text" value="${task.time || ''}" class="text-xs w-16 bg-white border border-gray-200 rounded p-1.5 text-center placeholder-gray-400 focus:ring-2 focus:ring-teal-500 focus:outline-none" placeholder="15m" onchange="updateTask(${wfIdx}, ${tIdx}, 'time', this.value)">
                            <button onclick="removeTask(${wfIdx}, ${tIdx})" class="text-red-400 hover:text-red-600 p-1 bg-white border border-gray-200 rounded px-2"><i class="fa-solid fa-trash text-sm"></i></button>
                        </div>
                        <input type="text" value="${task.link || ''}" class="text-xs w-full bg-white border border-gray-200 rounded p-1.5 text-gray-500 focus:ring-2 focus:ring-teal-500 focus:outline-none mb-1" placeholder="Launch Path/URL..." onchange="updateTask(${wfIdx}, ${tIdx}, 'link', this.value)">
                        
                        ${excelToggle}
                        ${subtasksHtml}
                        <button onclick="addSubtask(${wfIdx}, ${tIdx})" class="text-xs text-teal-600 font-bold mt-2 ml-6 hover:underline">+ Add Sub-task</button>
                    </div>
                `;
            } else {
                const progressVal = appState.progress[`${wfIdx}_${tIdx}`];
                const isDone = !!progressVal;
                const timestamp = isDone && typeof progressVal === 'string' ? progressVal : '';

                let linkBtn = '';
                if (task.link) {
                    const isExcel = task.link.toLowerCase().match(/\.(xlsx|xlsm|xls)$/);
                    const isPython = task.link.toLowerCase().endsWith('.py');
                    let refreshBtn = '';
                    if (isExcel && task.refreshExcel) {
                        refreshBtn = `<button onclick="refreshExcelData(${wfIdx}, ${tIdx}); event.stopPropagation();" class="text-orange-500 hover:text-orange-700 p-1.5 hover:bg-orange-50 rounded-lg transition-colors mr-1" title="Auto Refresh Excel"><i id="btn-refresh-${wfIdx}-${tIdx}" class="fa-solid fa-arrows-rotate text-sm"></i></button>`;
                    }

                    const iconClass = isPython ? 'fa-rocket text-orange-500 hover:text-orange-700' : 'fa-arrow-up-right-from-square text-teal-500 hover:text-teal-700';
                    linkBtn = `<div class="flex items-center ml-auto">${refreshBtn}<button onclick="openLinkWithConfig(${wfIdx}, ${tIdx}); event.stopPropagation();" class="p-1.5 hover:bg-teal-50 rounded-lg transition-colors" title="${isPython ? 'Run Python Script' : 'Open'}"><i id="btn-open-${wfIdx}-${tIdx}" class="fa-solid ${iconClass} text-sm"></i></button></div>`;
                }

                const timestampHtml = timestamp ? `<span class="text-[10px] font-mono text-teal-600 bg-teal-50 px-1.5 rounded ml-2 border border-teal-100">${timestamp}</span>` : '';
                const timeBadge = task.time ? `<span class="text-[10px] font-mono text-gray-500 bg-gray-100 px-1.5 rounded ml-2 border border-gray-200"><i class="fa-regular fa-clock mr-1"></i>${task.time}</span>` : '';
                const favIcon = isFav ? `<i class="fa-solid fa-star text-yellow-400 text-xs ml-2 shadow-sm rounded-full"></i>` : '';

                let subtasksHtml = '';
                if (task.subtasks && task.subtasks.length > 0) {
                    subtasksHtml = '<div class="mt-2 ml-6 space-y-1.5">';
                    task.subtasks.forEach((st, stIdx) => {
                        const stProgress = appState.progress[`${wfIdx}_${tIdx}_${stIdx}`];
                        const isStDone = !!stProgress;
                        subtasksHtml += `
                            <div class="flex items-center gap-2 group/st cursor-pointer" onclick="toggleSubtask(${wfIdx}, ${tIdx}, ${stIdx}); event.stopPropagation();">
                                <div class="w-4 h-4 rounded border ${isStDone ? 'bg-teal-500 border-teal-500 text-white' : 'border-gray-300 bg-white'} flex items-center justify-center transition-colors">
                                    ${isStDone ? '<i class="fa-solid fa-check text-[10px]"></i>' : ''}
                                </div>
                                <span class="text-xs ${isStDone ? 'text-gray-400 line-through' : 'text-gray-600'} transition-colors">${st}</span>
                            </div>
                        `;
                    });
                    subtasksHtml += '</div>';
                }

                taskList += `
                    <div class="flex flex-col p-2 rounded-lg hover:bg-slate-50 transition-colors group cursor-pointer border border-transparent hover:border-slate-100 task-item-row" data-wf="${wfIdx}" data-t="${tIdx}" onclick="toggleTask(${wfIdx}, ${tIdx})">
                        <div class="flex items-start gap-3 w-full">
                            <div class="pt-0.5"><input type="checkbox" class="custom-checkbox" ${isDone ? 'checked' : ''} onclick="event.stopPropagation(); toggleTask(${wfIdx}, ${tIdx});"></div>
                            <div class="flex-grow pt-0.5">
                                <span class="text-sm text-slate-700 ${isDone ? 'line-through text-slate-400' : ''} select-none font-medium leading-snug transition-colors">${task.name}${favIcon}</span>
                                ${timeBadge}
                                ${timestampHtml}
                            </div>
                            <div onclick="event.stopPropagation()" class="flex-shrink-0">${linkBtn}</div>
                        </div>
                        ${subtasksHtml}
                    </div>
                `;
            }
        });
        taskList += '</div>';

        let footer = '';
        if (appState.isEditMode) {
            footer = `<div class="px-4 pb-4"><button onclick="addTask(${wfIdx})" class="w-full py-2 border border-dashed border-teal-300 text-teal-600 rounded-lg text-xs font-bold hover:bg-teal-50 uppercase tracking-wider transition-colors">+ Add Task</button></div>`;
        } else if (wf.tasks.some(t => t.link) && !isCollapsed) {
            footer = `<div class="px-4 pb-4"><button onclick="runMacro(${wfIdx})" id="macro-btn-${wfIdx}" class="w-full py-2 bg-slate-100 text-teal-700 border border-slate-200 rounded-lg text-xs font-bold hover:bg-teal-600 hover:text-white hover:border-teal-600 transition-all uppercase tracking-wider shadow-sm"><i class="fa-solid fa-rocket mr-2"></i> Launch All</button></div>`;
        }

        card.innerHTML = colorBar + header + taskList + footer;
        grid.appendChild(card);
    });
    if (appState.isEditMode) initSortable();
}

function updateProgressBar() {
    let total = 0, done = 0;
    appState.masterData.forEach((wf, wIdx) => wf.tasks.forEach((_, tIdx) => { total++; if (appState.progress[`${wIdx}_${tIdx}`]) done++; }));
    const pct = total === 0 ? 0 : Math.round((done / total) * 100);
    document.getElementById('overall-progress-bar').style.width = `${pct}%`;
    document.getElementById('progress-percent').innerText = `${pct}%`;
    document.getElementById('progress-count').innerText = `${done}/${total} Tasks`;
}

function toggleSidebar() {
    appState.sidebarCollapsed = !appState.sidebarCollapsed;
    const sb = document.getElementById('sidebar');
    const icon = document.querySelector('#sidebar-toggle i');
    if (appState.sidebarCollapsed) { sb.classList.add('collapsed'); icon.classList.replace('fa-chevron-left', 'fa-chevron-right'); }
    else { sb.classList.remove('collapsed'); icon.classList.replace('fa-chevron-right', 'fa-chevron-left'); }
    saveData();
}

function updateEditModeUI() {
    const btn = document.getElementById('edit-mode-btn');
    const fab = document.getElementById('add-workflow-fab');
    if (appState.isEditMode) {
        btn.innerHTML = '<i class="fa-solid fa-check"></i> <span class="hidden sm:inline">Done</span>';
        btn.className = "bg-green-500 text-white px-4 py-2 rounded-xl shadow-sm text-sm font-bold flex items-center gap-2 h-10 transition-all hover:bg-green-600";
        fab.classList.remove('hidden'); fab.classList.add('flex');
    } else {
        btn.innerHTML = '<i class="fa-solid fa-pen-to-square"></i> <span class="hidden sm:inline">Edit Mode</span>';
        btn.className = "bg-white border border-indigo-100 text-indigo-600 hover:bg-indigo-50 px-4 py-2 rounded-xl shadow-sm text-sm font-bold flex items-center gap-2 h-10 transition-all";
        fab.classList.remove('flex'); fab.classList.add('hidden');
    }
}

async function openLinkWithConfig(wfIdx, tIdx) {
    const task = appState.masterData[wfIdx].tasks[tIdx];
    const path = task.link;

    if (path.toLowerCase().endsWith('.py')) {
        showToast(`💡 กำลังรันสคริปต์: ${task.name}...`, 'info');
        logBot(`เริ่มต้นรันสคริปต์ Python: ${task.name}`, 'info');
        const btnIcon = document.getElementById(`btn-open-${wfIdx}-${tIdx}`);
        if (btnIcon) {
            btnIcon.classList.remove('fa-rocket');
            btnIcon.classList.add('fa-spinner', 'fa-spin');
        }

        try {
            const res = await window.electronAPI.runPython(path);
            if (res.success) {
                showToast(`✅ สั่งงานเรียบร้อย: ${task.name}`, 'success');
                logBot(`✅ สคริปต์ ${task.name} ทำงานเสร็จสิ้น`, 'success');
                if (res.output) logBot(`Output: ${res.output.trim()}`, 'info');
            } else {
                showToast(`❌ ข้อผิดพลาด: ${res.error}`, 'error');
                logBot(`❌ ข้อผิดพลาดใน ${task.name}: ${res.error}`, 'error');
            }
        } catch (e) {
            showToast(`❌ Exception: ${e.message}`, 'error');
            logBot(`❌ Exception ใน ${task.name}: ${e.message}`, 'error');
        }

        if (btnIcon) {
            btnIcon.classList.remove('fa-spinner', 'fa-spin');
            btnIcon.classList.add('fa-rocket');
        }
    } else {
        logBot(`เปิดไฟล์/ลิงก์: ${task.name}`, 'info');
        window.electronAPI.openFile(path);
    }
}

async function refreshExcelData(wfIdx, tIdx) {
    const task = appState.masterData[wfIdx].tasks[tIdx];
    if (!task.link) return;

    showToast(`📊 กำลังเปิดและรีเฟรช Excel: ${task.name}...`, 'info');
    logBot(`กำลังเปิด Excel และ Refresh: ${task.name}`, 'info');
    const btnIcon = document.getElementById(`btn-refresh-${wfIdx}-${tIdx}`);
    if (btnIcon) {
        btnIcon.classList.remove('fa-arrows-rotate');
        btnIcon.classList.add('fa-spinner', 'fa-spin');
    }

    try {
        const res = await window.electronAPI.refreshExcel(task.link);
        if (res.success) {
            showToast(`✅ รีเฟรชและเซฟสำเร็จ: ${task.name}`, 'success');
            logBot(`✅ รีเฟรช Excel สำเร็จ: ${task.name}`, 'success');
            const now = new Date();
            const timeStr = now.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
            appState.progress[`${wfIdx}_${tIdx}`] = timeStr;
            saveProgress();
            renderTasks();
        } else {
            showToast(`❌ รีเฟรชไม่สำเร็จ: ${res.error}`, 'error');
            logBot(`❌ รีเฟรช Excel ล้มเหลว: ${task.name} (${res.error})`, 'error');
        }
    } catch (e) {
        showToast(`❌ Error: ${e.message}`, 'error');
        logBot(`❌ Error ในการรีเฟรช: ${task.name} (${e.message})`, 'error');
    }

    if (btnIcon) {
        btnIcon.classList.remove('fa-spinner', 'fa-spin');
        btnIcon.classList.add('fa-arrows-rotate');
    }
}

function showToast(msg, type = 'info') {
    const toast = document.getElementById('toast');
    const icon = document.getElementById('toast-icon');
    const container = document.getElementById('toast-icon-container');

    if (type === 'success') {
        icon.className = 'fa-solid fa-circle-check text-green-500 text-lg';
        container.className = 'w-10 h-10 rounded-xl bg-green-50 flex items-center justify-center';
    } else if (type === 'error') {
        icon.className = 'fa-solid fa-circle-exclamation text-red-500 text-lg';
        container.className = 'w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center';
    } else {
        icon.className = 'fa-solid fa-info-circle text-indigo-500 text-lg';
        container.className = 'w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center';
    }

    document.getElementById('toast-message').innerText = msg;
    toast.classList.remove('opacity-0', 'translate-y-20');
    toast.classList.add('opacity-100', 'translate-y-0');

    setTimeout(() => {
        toast.classList.add('opacity-0', 'translate-y-20');
        toast.classList.remove('opacity-100', 'translate-y-0');
    }, 4000);
}

// Log Bot Messages to the bottom panel
function logBot(message, type = 'info') {
    const logContent = document.getElementById('log-content');
    const badge = document.getElementById('log-badge');
    const panel = document.getElementById('log-panel');

    const time = new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const logItem = document.createElement('div');

    let color = 'text-slate-300';
    if (type === 'success') color = 'text-teal-400';
    else if (type === 'error') color = 'text-red-400';
    else if (type === 'warn') color = 'text-orange-400';

    logItem.className = `flex gap-2 transition-all animate-fade-in`;
    logItem.innerHTML = `
        <span class="text-slate-600 flex-shrink-0">[${time}]</span>
        <span class="${color}">${message}</span>
    `;

    logContent.appendChild(logItem);
    logContent.scrollTop = logContent.scrollHeight;

    // Show indicator if panel is closed
    if (panel.classList.contains('translate-y-full')) {
        badge.classList.remove('hidden');
    }
}

function toggleLogPanel() {
    const panel = document.getElementById('log-panel');
    const chevron = document.getElementById('log-chevron');
    const badge = document.getElementById('log-badge');

    if (panel.classList.contains('translate-y-full')) {
        panel.classList.remove('translate-y-full');
        chevron.classList.replace('fa-chevron-up', 'fa-chevron-down');
        badge.classList.add('hidden');
    } else {
        panel.classList.add('translate-y-full');
        chevron.classList.replace('fa-chevron-down', 'fa-chevron-up');
    }
}

window.updateWorkflowTitle = (idx, val) => { appState.masterData[idx].title = val; saveData(); };
window.updateTask = (wIdx, tIdx, field, val) => { appState.masterData[wIdx].tasks[tIdx][field] = val; saveData(); if (field === 'refreshExcel') renderTasks(); };
window.toggleFavorite = (wIdx, tIdx) => { appState.masterData[wIdx].tasks[tIdx].favorite = !appState.masterData[wIdx].tasks[tIdx].favorite; saveData(); renderTasks(); };
window.addSubtask = (wIdx, tIdx) => { appState.masterData[wIdx].tasks[tIdx].subtasks.push(""); saveData(); renderTasks(); };
window.updateSubtask = (wIdx, tIdx, stIdx, val) => { appState.masterData[wIdx].tasks[tIdx].subtasks[stIdx] = val; saveData(); };
window.removeSubtask = (wIdx, tIdx, stIdx) => { appState.masterData[wIdx].tasks[tIdx].subtasks.splice(stIdx, 1); saveData(); renderTasks(); };

window.addTask = (wIdx) => { appState.masterData[wIdx].tasks.push({ name: '', link: '', time: '', favorite: false, subtasks: [], refreshExcel: false }); saveData(); renderTasks(); };
window.removeTask = (wIdx, tIdx) => { appState.masterData[wIdx].tasks.splice(tIdx, 1); saveData(); renderTasks(); };
window.deleteWorkflow = (idx) => { if (confirm('ต้องการลบกลุ่มงานนี้ใช่หรือไม่?')) { appState.masterData.splice(idx, 1); saveData(); renderTasks(); } };
window.updateShortcut = (idx, field, val) => { appState.shortcuts[idx][field] = val; saveData(); };
window.deleteShortcut = (idx) => { appState.shortcuts.splice(idx, 1); saveData(); renderShortcuts(); };

function toggleTask(wfIdx, tIdx) {
    if (appState.isEditMode) return;
    const key = `${wfIdx}_${tIdx}`;
    const task = appState.masterData[wfIdx].tasks[tIdx];
    const now = new Date();
    const timeStr = now.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });

    if (appState.progress[key]) {
        delete appState.progress[key];
        if (task.subtasks) task.subtasks.forEach((_, stIdx) => delete appState.progress[`${wfIdx}_${tIdx}_${stIdx}`]);
    } else {
        appState.progress[key] = timeStr;
        if (task.subtasks) task.subtasks.forEach((_, stIdx) => appState.progress[`${wfIdx}_${tIdx}_${stIdx}`] = timeStr);
        // Play success sound logic can go here if needed
    }
    saveProgress();
    renderTasks();
}

function toggleSubtask(wfIdx, tIdx, stIdx) {
    if (appState.isEditMode) return;
    const key = `${wfIdx}_${tIdx}_${stIdx}`;

    if (appState.progress[key]) {
        delete appState.progress[key];
        delete appState.progress[`${wfIdx}_${tIdx}`];
    } else {
        const now = new Date();
        const timeStr = now.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
        appState.progress[key] = timeStr;

        const task = appState.masterData[wfIdx].tasks[tIdx];
        const allDone = task.subtasks.every((_, idx) => appState.progress[`${wfIdx}_${tIdx}_${idx}`]);
        if (allDone) appState.progress[`${wfIdx}_${tIdx}`] = timeStr;
    }
    saveProgress();
    renderTasks();
}

function toggleCollapse(wfIdx) {
    appState.collapsedCards[wfIdx] = !appState.collapsedCards[wfIdx];
    saveData();
    renderTasks();
}

async function runMacro(wfIdx) {
    const tasks = appState.masterData[wfIdx].tasks.filter(t => t.link);
    const btn = document.getElementById(`macro-btn-${wfIdx}`);
    if (btn) btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin mr-2"></i> Launching...';

    showToast(`🚀 กำลังรัน ${tasks.length} รายการอัตโนมัติ...`, 'info');
    for (const t of tasks) {
        const tIdx = appState.masterData[wfIdx].tasks.indexOf(t);
        openLinkWithConfig(wfIdx, tIdx);
        await new Promise(r => setTimeout(r, 1200));
    }

    if (btn) btn.innerHTML = '<i class="fa-solid fa-rocket mr-2"></i> Launch All';
}

function toggleEditMode() {
    appState.isEditMode = !appState.isEditMode;
    if (!appState.isEditMode) { saveData(); showToast('บันทึกข้อมูลแล้ว', 'success'); }
    updateEditModeUI();
    renderAll();
}

function setupEventListeners() {
    const sidebarToggle = document.getElementById('sidebar-toggle');
    if (sidebarToggle) sidebarToggle.onclick = toggleSidebar;

    const exportBtn = document.getElementById('export-template-btn');
    if (exportBtn) exportBtn.onclick = () => {
        const blob = new Blob([JSON.stringify({ date: new Date(), shortcuts: appState.shortcuts, masterData: appState.masterData, title: appState.appTitle })], { type: 'application/json' });
        const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `planner_backup.json`; a.click();
        showToast('Export สำเร็จ!', 'success');
    };

    const imp = document.getElementById('import-template-btn');
    const file = document.getElementById('import-file-input');
    if (imp) imp.onclick = () => file.click();
    if (file) file.onchange = (e) => {
        const r = new FileReader();
        r.onload = (ev) => {
            try {
                const d = JSON.parse(ev.target.result);
                if (d.masterData) {
                    appState.masterData = d.masterData;
                    if (d.shortcuts) appState.shortcuts = d.shortcuts;
                    if (d.title) appState.appTitle = d.title;
                    saveData();
                    init();
                    showToast('Import สำเร็จ!', 'success');
                }
            } catch (err) { showToast('ไฟล์ JSON ไม่ถูกต้อง', 'error'); }
        };
        r.readAsText(e.target.files[0]);
    };

    const editBtn = document.getElementById('edit-mode-btn');
    if (editBtn) editBtn.onclick = toggleEditMode;

    const fab = document.getElementById('add-workflow-fab');
    if (fab) fab.onclick = () => { appState.masterData.push({ id: Date.now(), title: 'New Plan', tasks: [] }); renderTasks(); };

    const addScBtn = document.getElementById('add-shortcut-btn');
    if (addScBtn) addScBtn.onclick = () => { appState.shortcuts.push({ name: 'Link', link: '' }); renderShortcuts(); };

    const resetBtn = document.getElementById('reset-day-btn');
    if (resetBtn) resetBtn.onclick = () => { if (confirm('คุณต้องการลบข้อมูลทั้งหมดในเครื่องและคืนค่าโรงงานใช่หรือไม่?')) { localStorage.clear(); location.reload(); } };

    const todayBtn = document.getElementById('today-btn');
    if (todayBtn) todayBtn.onclick = () => { appState.currentDate = new Date(); loadProgress(); renderAll(); };

    const datePicker = document.getElementById('date-picker');
    if (datePicker) datePicker.onchange = (e) => { appState.currentDate = new Date(e.target.value); loadProgress(); renderAll(); };

    const titleInput = document.getElementById('app-title-input');
    if (titleInput) titleInput.addEventListener('change', (e) => { appState.appTitle = e.target.value; saveData(); });

    const scratchpad = document.getElementById('scratchpad-input');
    if (scratchpad) scratchpad.addEventListener('input', (e) => { localStorage.setItem('scratchpadText', e.target.value); });
}

function initSortable() {
    new Sortable(document.getElementById('task-grid'), {
        handle: '.handle',
        animation: 250,
        ghostClass: 'opacity-50'
    });
    document.querySelectorAll('.sortable-tasks').forEach(el => new Sortable(el, {
        group: 'tasks',
        animation: 250,
        ghostClass: 'bg-indigo-50',
        onEnd: () => {
            // Optional: Update masterData based on new DOM order
        }
    }));
}

function startClock() {
    setInterval(() => {
        const el = document.getElementById('clock-display');
        if (el) el.innerText = new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    }, 1000);
}

// Global scope assignments for inline calls (if any remain)
window.init = init;
window.refreshExcelData = refreshExcelData;
window.openLinkWithConfig = openLinkWithConfig;
window.toggleTask = toggleTask;
window.toggleSubtask = toggleSubtask;
window.toggleCollapse = toggleCollapse;
window.runMacro = runMacro;
window.addTask = addTask;
window.removeTask = removeTask;
window.deleteWorkflow = deleteWorkflow;
window.updateWorkflowTitle = updateWorkflowTitle;
window.updateTask = updateTask;
window.toggleFavorite = toggleFavorite;
window.addSubtask = addSubtask;
window.updateSubtask = updateSubtask;
window.removeSubtask = removeSubtask;
window.updateShortcut = updateShortcut;
window.deleteShortcut = deleteShortcut;
window.toggleLogPanel = toggleLogPanel;
window.logBot = logBot;

// Entry Point
document.addEventListener('DOMContentLoaded', init);

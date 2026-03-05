import { appState, loadData, saveData, saveProgress, loadProgress } from './state.js';
import { renderAll, renderTasks, renderShortcuts, renderAutomations, updateProgressBar, updateEditModeUI, getBoardTransform, setBoardTransform } from './ui.js';
import { openLinkWithConfig, refreshExcelData, runMacro } from './automation.js';
import { logBot } from './logger.js';
import { toggleTask, toggleSubtask, toggleCollapse, toggleEditMode, setupEventListeners } from './events.js';
import { showAutomationModal, hideAutomationModal } from './modal.js';

// ─── Board pan/zoom state ──────────────────────────────────────────────────────
const SCALE_MIN = 0.4, SCALE_MAX = 2.2, SCALE_STEP = 0.12;
let boardScale = 1, boardPanX = 0, boardPanY = 0, isPanning = false, panStartX = 0, panStartY = 0;

function applyBoardTransform() {
    const c = document.getElementById('board-pan-container');
    if (c) c.style.transform = `translate(${boardPanX}px,${boardPanY}px) scale(${boardScale})`;
    const lbl = document.getElementById('board-zoom-label');
    if (lbl) lbl.innerText = `${Math.round(boardScale * 100)}%`;
    setBoardTransform(boardScale, boardPanX, boardPanY);
}

function initBoardPanZoom() {
    const view = document.getElementById('board-viewport');
    if (!view) return;

    view.addEventListener('mousedown', (e) => {
        if (e.target.closest('[id^="board-card-"]') || e.target.closest('button') || e.target.closest('input')) return;
        isPanning = true;
        panStartX = e.clientX - boardPanX;
        panStartY = e.clientY - boardPanY;
        view.style.cursor = 'grabbing';
    });
    view.addEventListener('mouseup', () => { isPanning = false; view.style.cursor = 'default'; });
    view.addEventListener('mouseleave', () => { isPanning = false; view.style.cursor = 'default'; });
    view.addEventListener('mousemove', (e) => {
        if (!isPanning) return;
        boardPanX = e.clientX - panStartX;
        boardPanY = e.clientY - panStartY;
        applyBoardTransform();
    });

    // Scroll-to-zoom centered on cursor
    view.addEventListener('wheel', (e) => {
        e.preventDefault();
        const rect = view.getBoundingClientRect();
        const mx = e.clientX - rect.left, my = e.clientY - rect.top;
        const vx = (mx - boardPanX) / boardScale;
        const vy = (my - boardPanY) / boardScale;
        const delta = e.deltaY < 0 ? SCALE_STEP : -SCALE_STEP;
        boardScale = Math.min(SCALE_MAX, Math.max(SCALE_MIN, boardScale + delta));
        boardPanX = mx - vx * boardScale;
        boardPanY = my - vy * boardScale;
        applyBoardTransform();
    }, { passive: false });

    applyBoardTransform();
}

// ─── Init ──────────────────────────────────────────────────────────────────────
function init() {
    loadData();
    setupEventListeners();
    updateEditModeUI();
    renderAll();
    initBoardPanZoom();

    // Update app title input
    const titleEl = document.getElementById('app-title-input');
    if (titleEl) titleEl.value = appState.appTitle;

    // Clock
    function updateClock() {
        const el = document.getElementById('clock-display');
        if (el) el.innerText = new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    }
    updateClock();
    setInterval(updateClock, 1000);

    // Progress auto-refresh every 60s
    setInterval(() => { updateProgressBar(); }, 60000);
}

// ─── Toast ────────────────────────────────────────────────────────────────────
window.showToast = function (msg, type = 'info') {
    const toast = document.getElementById('toast');
    const message = document.getElementById('toast-message');
    const icon = document.getElementById('toast-icon');
    const ic = document.getElementById('toast-icon-container');
    if (!toast || !message) return;

    message.innerText = msg;
    const map = {
        success: ['fa-check-circle', 'text-teal-500', 'bg-teal-50'],
        error: ['fa-times-circle', 'text-red-500', 'bg-red-50'],
        warn: ['fa-exclamation-triangle', 'text-orange-500', 'bg-orange-50'],
        info: ['fa-info-circle', 'text-indigo-500', 'bg-indigo-50']
    };
    const [iconCls, textCls, bgCls] = map[type] || map.info;
    if (icon) icon.className = `fa-solid ${iconCls} ${textCls} text-xl`;
    if (ic) ic.className = `w-10 h-10 rounded-xl ${bgCls} flex items-center justify-center`;

    toast.classList.remove('translate-y-20', 'opacity-0');
    setTimeout(() => { toast.classList.add('translate-y-20', 'opacity-0'); }, 3000);
};

// ─── Board zoom controls ───────────────────────────────────────────────────────
window.zoomBoard = function (delta) {
    boardScale = Math.min(SCALE_MAX, Math.max(SCALE_MIN, boardScale + delta));
    applyBoardTransform();
};
window.resetBoardZoom = function () { boardScale = 1; boardPanX = 0; boardPanY = 0; applyBoardTransform(); };

// ─── Log page ──────────────────────────────────────────────────────────────────
window.showLogPage = function (action) {
    const logPage = document.getElementById('log-page');
    const boardWrap = document.getElementById('board-and-focus-wrapper');
    if (action === 'back') {
        logPage?.classList.add('hidden'); logPage?.classList.remove('flex');
        boardWrap?.classList.remove('hidden');
    } else {
        boardWrap?.classList.add('hidden');
        logPage?.classList.remove('hidden'); logPage?.classList.add('flex');
        document.getElementById('log-badge')?.classList.add('hidden');
    }
};

window.copyLog = async function () {
    const logContent = document.getElementById('log-content');
    if (!logContent) return;
    const lines = Array.from(logContent.querySelectorAll('div[data-type]')).map(d => d.innerText).join('\n');
    if (!lines.trim()) { window.showToast('ไม่มี Log', 'info'); return; }
    try { await navigator.clipboard.writeText(lines); window.showToast('คัดลอกแล้ว', 'success'); }
    catch { window.showToast('คัดลอกไม่ได้', 'error'); }
};

window.clearLog = function () {
    const lc = document.getElementById('log-content');
    if (lc) lc.innerHTML = '<div class="text-slate-600 italic">Log cleared.</div>';
    document.getElementById('log-badge')?.classList.add('hidden');
    document.getElementById('log-count-badge')?.innerText && (document.getElementById('log-count-badge').innerText = '0 entries');
};

window.filterLog = function (type) {
    document.querySelectorAll('.log-filter-btn').forEach(b => b.classList.remove('active-filter'));
    document.getElementById(`filter-${type}`)?.classList.add('active-filter');
    document.querySelectorAll('#log-content div[data-type]').forEach(div => {
        div.style.display = (type === 'all' || div.dataset.type === type) ? '' : 'none';
    });
};

// ─── Sidebar tab toggle ────────────────────────────────────────────────────────
window.toggleSidebar = function () {
    appState.sidebarCollapsed = !appState.sidebarCollapsed;
    document.getElementById('sidebar')?.classList.toggle('collapsed', appState.sidebarCollapsed);
    saveData();
};

// ─── Shortcuts CRUD ────────────────────────────────────────────────────────────
window.addShortcut = function () {
    appState.shortcuts.push({ name: 'New Shortcut', link: '', icon: 'fa-bolt' });
    saveData(); renderShortcuts();
};
window.updateShortcut = function (idx, field, val) {
    if (appState.shortcuts[idx]) { appState.shortcuts[idx][field] = val; saveData(); }
};
window.deleteShortcut = function (idx) {
    appState.shortcuts.splice(idx, 1); saveData(); renderShortcuts();
};

// ─── Automations CRUD ─────────────────────────────────────────────────────────
window.addAutomation = function () {
    appState.automations.push({ name: 'New Script', path: '' });
    saveData(); renderAutomations();
};
window.updateAutomation = function (idx, field, val) {
    if (appState.automations[idx]) { appState.automations[idx][field] = val; saveData(); }
};
window.deleteAutomation = function (idx) {
    appState.automations.splice(idx, 1); saveData(); renderAutomations();
};
window.runAutomation = async function (idx) {
    const a = appState.automations[idx];
    if (!a?.path) { window.showToast('ไม่มี Path กำหนดไว้', 'error'); return; }
    logBot(`🚀 รัน: ${a.name}`, 'info');
    window.showToast(`กำลังรัน: ${a.name}`, 'info');
    const result = await window.electronAPI.runPython(a.path);
    if (result.success) {
        logBot(`✓ ${a.name} เสร็จสิ้น`, 'success');
        window.showToast(`✓ ${a.name} เสร็จสิ้น`, 'success');
    } else {
        logBot(`✗ ${a.name}: ${result.error}`, 'error');
        window.showToast(`Error: ${a.name}`, 'error');
    }
};
window.browseAutomationPath = async function (idx) {
    const path = await window.electronAPI.dialogChooseFile();
    if (path) { appState.automations[idx].path = path; saveData(); renderAutomations(); }
};

// ─── Tasks CRUD ───────────────────────────────────────────────────────────────
window.addTask = function (wfIdx) {
    appState.masterData[wfIdx].tasks.push({ name: 'New Task', link: '', time: '', favorite: false, subtasks: [], refreshExcel: false, inProgress: false });
    saveData(); renderTasks();
};
window.removeTask = function (wfIdx, tIdx) {
    appState.masterData[wfIdx].tasks.splice(tIdx, 1); saveData(); renderTasks();
};
window.updateTask = function (wfIdx, tIdx, field, val) {
    const t = appState.masterData[wfIdx]?.tasks[tIdx]; if (!t) return;
    t[field] = val; saveData(); renderTasks();
};
window.toggleFavorite = function (wfIdx, tIdx) {
    const t = appState.masterData[wfIdx]?.tasks[tIdx]; if (!t) return;
    t.favorite = !t.favorite; saveData(); renderTasks();
};
window.browseFilePath = async function (wfIdx, tIdx) {
    const path = await window.electronAPI.dialogChooseFile();
    if (path) { appState.masterData[wfIdx].tasks[tIdx].link = path; saveData(); renderTasks(); }
};

// ─── Workflows CRUD ───────────────────────────────────────────────────────────
window.addWorkflow = function () {
    const newId = Date.now();
    const col = appState.masterData.length % 4;
    const row = Math.floor(appState.masterData.length / 4);
    appState.masterData.push({ id: newId, title: 'New Workflow', tasks: [], boardX: col * 304 + 24, boardY: row * 180 + 24 });
    saveData(); renderAll();
};
window.deleteWorkflow = function (wfIdx) {
    if (!confirm('ลบ Workflow นี้?')) return;
    appState.masterData.splice(wfIdx, 1); saveData(); renderAll();
};
window.updateWorkflowTitle = function (wfIdx, val) {
    appState.masterData[wfIdx].title = val; saveData();
};



// ─── Expose to inline HTML handlers ───────────────────────────────────────────
window.toggleTask = toggleTask;
window.toggleSubtask = toggleSubtask;
window.toggleCollapse = toggleCollapse;
window.toggleEditMode = toggleEditMode;
window.openLinkWithConfig = openLinkWithConfig;
window.refreshExcelData = refreshExcelData;
window.runMacro = runMacro;
window.hideAutomationModal = hideAutomationModal;
window.saveAppState = saveData;

// ─── Start ────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', init);

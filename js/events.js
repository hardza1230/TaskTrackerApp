import { appState, saveData, saveProgress } from './state.js';
import { renderAll, renderTasks, renderShortcuts, renderAutomations, updateEditModeUI, updateProgressBar } from './ui.js';
import { logBot } from './logger.js';

// ─── Toggle Task completion ───────────────────────────────────────────────────
export function toggleTask(wfIdx, tIdx) {
    const key = `${wfIdx}_${tIdx}`;
    const task = appState.masterData[wfIdx]?.tasks[tIdx];
    if (!task) return;

    if (appState.progress[key]) {
        delete appState.progress[key];
    } else {
        const now = new Date();
        appState.progress[key] = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
    }
    saveProgress();
    saveData();
    renderTasks();
    updateProgressBar();
}

// ─── Toggle Subtask ───────────────────────────────────────────────────────────
export function toggleSubtask(wfIdx, tIdx, sIdx) {
    const key = `${wfIdx}_${tIdx}_s${sIdx}`;
    appState.progress[key] = !appState.progress[key];
    saveProgress();
    renderTasks();
}

// ─── Collapse / Expand card ───────────────────────────────────────────────────
export function toggleCollapse(wfIdx) {
    const isCurrentlyCollapsed = appState.collapsedCards[wfIdx] !== false;
    appState.collapsedCards[wfIdx] = !isCurrentlyCollapsed;
    saveData();
    renderTasks();
}

// ─── Edit Mode ────────────────────────────────────────────────────────────────
export function toggleEditMode() {
    appState.isEditMode = !appState.isEditMode;
    renderAll();
}

// ─── Setup ────────────────────────────────────────────────────────────────────
export function setupEventListeners() {
    // Edit mode button
    const editBtn = document.getElementById('edit-mode-btn');
    if (editBtn) editBtn.addEventListener('click', toggleEditMode);

    // Sidebar toggle
    const sbt = document.getElementById('sidebar-toggle');
    if (sbt) sbt.addEventListener('click', () => {
        appState.sidebarCollapsed = !appState.sidebarCollapsed;
        document.getElementById('sidebar').classList.toggle('collapsed', appState.sidebarCollapsed);
        saveData();
    });

    // Sidebar tab switching
    const tabShortcuts = document.getElementById('tab-shortcuts-btn');
    const tabAutomate = document.getElementById('tab-automate-btn');
    const panelShortcuts = document.getElementById('shortcuts-panel');
    const panelAutomate = document.getElementById('automate-panel');

    function switchTab(tab) {
        const isShortcuts = tab === 'shortcuts';
        panelShortcuts?.classList.toggle('hidden', !isShortcuts);
        panelAutomate?.classList.toggle('hidden', isShortcuts);
        tabShortcuts?.classList.toggle('tab-active', isShortcuts);
        tabAutomate?.classList.toggle('tab-active', !isShortcuts);
    }

    if (tabShortcuts) tabShortcuts.addEventListener('click', () => switchTab('shortcuts'));
    if (tabAutomate) tabAutomate.addEventListener('click', () => switchTab('automate'));

    // Add shortcut / automation
    document.getElementById('add-shortcut-btn')?.addEventListener('click', () => window.addShortcut?.());
    document.getElementById('add-automate-btn')?.addEventListener('click', () => window.addAutomation?.());

    // App title
    const titleInput = document.getElementById('app-title-input');
    if (titleInput) {
        titleInput.value = appState.appTitle;
        titleInput.addEventListener('blur', () => { appState.appTitle = titleInput.value; saveData(); });
    }

    // Scratchpad
    const scratch = document.getElementById('scratchpad-input');
    if (scratch) {
        scratch.value = appState.scratchpadText;
        scratch.addEventListener('blur', () => { appState.scratchpadText = scratch.value; saveData(); });
    }

    // Export
    document.getElementById('export-btn')?.addEventListener('click', () => {
        const data = JSON.stringify({ masterData: appState.masterData, shortcuts: appState.shortcuts, automations: appState.automations }, null, 2);
        const blob = new Blob([data], { type: 'application/json' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `planner_backup_${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        window.showToast('Export เรียบร้อยแล้ว', 'success');
    });

    // Import
    const importFile = document.getElementById('import-file-input');
    document.getElementById('import-btn')?.addEventListener('click', () => importFile?.click());
    importFile?.addEventListener('change', (e) => {
        const file = e.target.files[0]; if (!file) return;
        const reader = new FileReader();
        reader.onload = (ev) => {
            try {
                const data = JSON.parse(ev.target.result);
                if (data.masterData) appState.masterData = data.masterData;
                if (data.shortcuts) appState.shortcuts = data.shortcuts;
                if (data.automations) appState.automations = data.automations;
                saveData(); renderAll();
                window.showToast('Import เรียบร้อยแล้ว', 'success');
            } catch { window.showToast('ไฟล์ไม่ถูกต้อง', 'error'); }
        };
        reader.readAsText(file);
    });

    // Reset
    document.getElementById('reset-day-btn')?.addEventListener('click', () => {
        if (confirm('ล้างข้อมูลทั้งหมด? (ไม่สามารถกู้คืนได้)')) {
            localStorage.clear(); window.location.reload();
        }
    });

    // IPC: Python log stream
    if (window.electronAPI?.onPythonLog) {
        window.electronAPI.onPythonLog((msg) => logBot(msg, 'info'));
    }

    // Global Search (Ctrl+F)
    const searchInput = document.getElementById('global-search-input');
    const clearSearchBtn = document.getElementById('clear-search-btn');
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            appState.searchQuery = e.target.value;
            if (clearSearchBtn) {
                clearSearchBtn.classList.toggle('hidden', !appState.searchQuery);
            }
            renderTasks(); // Re-render board to show only matching cards
        });

        if (clearSearchBtn) {
            clearSearchBtn.addEventListener('click', () => {
                searchInput.value = '';
                appState.searchQuery = '';
                clearSearchBtn.classList.add('hidden');
                renderTasks();
            });
        }
    }

    // Ctrl+F hotkey
    document.addEventListener('keydown', (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f') {
            e.preventDefault();
            if (searchInput) {
                searchInput.focus();
                searchInput.select();
            }
        }
    });

}

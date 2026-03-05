export const ICONS = [
    { id: 'fa-bolt', label: 'ด่วน' }, { id: 'fa-star', label: 'สำคัญ' }, { id: 'fa-file-excel', label: 'Excel' },
    { id: 'fa-globe', label: 'เว็บ' }, { id: 'fa-envelope', label: 'เมล' }, { id: 'fa-calendar', label: 'แผน' },
    { id: 'fa-truck-fast', label: 'รถ' }, { id: 'fa-industry', label: 'ผลิต' }
];

export const CARD_COLORS = ['#EF4444', '#F59E0B', '#10B981', '#3B82F6', '#8B5CF6', '#EC4899', '#06B6D4', '#F97316'];
export const SNIPPETS = ["✅ Complete", "⚠️ Pending", "❌ Machine Breakdown", "รอวัตถุดิบ", "ส่งแผนแล้ว", "ติดประชุม", "รออนุมัติ", "กำลังดำเนินการ"];

const DEFAULT_DATA = [{ "id": 1, "title": "Start Day", "tasks": [{ "name": "Login", "link": "", "time": "5m", "favorite": false, "subtasks": [], "refreshExcel": false }] }];

const GRID_COLS = 4;
export const CARD_MIN_W = 280;
const CARD_GAP = 24;

export const appState = {
    currentDate: new Date(),
    isEditMode: false,
    masterData: [],
    shortcuts: [],
    automations: [],      // NEW: { name, path } for Python/Bat automation shortcuts
    progress: {},
    collapsedCards: {},
    sidebarCollapsed: false,
    appTitle: "Planner Home",
    searchQuery: "",
    scratchpadText: ""
};

export function loadData() {
    const savedData = localStorage.getItem('taskMasterData');
    appState.masterData = savedData ? JSON.parse(savedData) : DEFAULT_DATA;


    // --- Migration: เติม field ใหม่ให้ tasks และ workflows ---
    appState.masterData.forEach((wf, wfIdx) => {
        // Board position and size for each workflow card
        if (wf.boardX === undefined) {
            const col = wfIdx % GRID_COLS;
            const row = Math.floor(wfIdx / GRID_COLS);
            wf.boardX = col * (CARD_MIN_W + CARD_GAP) + 24;
            wf.boardY = row * 180 + 24;
        }
        if (wf.boardY === undefined) wf.boardY = wfIdx * 160 + 24;
        if (wf.boardW === undefined) wf.boardW = CARD_MIN_W;

        wf.tasks.forEach(t => {
            if (t.time === undefined) t.time = "";
            if (t.favorite === undefined) t.favorite = false;
            if (t.subtasks === undefined) t.subtasks = [];
            if (t.refreshExcel === undefined) t.refreshExcel = false;
            if (t.inProgress === undefined) t.inProgress = false;  // NEW: for Focus Zone
        });
    });

    const savedShortcuts = localStorage.getItem('shortcutData');
    appState.shortcuts = savedShortcuts ? JSON.parse(savedShortcuts) : [];

    // NEW: Load automations
    const savedAutomations = localStorage.getItem('automationData');
    appState.automations = savedAutomations ? JSON.parse(savedAutomations) : [
        { name: "Citrix Auto-Login", path: "C:\\Users\\norrasates\\Desktop\\Automate Job\\citrix_full_automation.py" },
        { name: "BIS Data Extract", path: "C:\\Users\\norrasates\\Desktop\\Automate Job\\bis_automation.py" }
    ];

    const savedCollapsed = localStorage.getItem('collapsedCards');
    if (savedCollapsed) {
        appState.collapsedCards = JSON.parse(savedCollapsed);
    } else {
        // Default: ALL cards collapsed
        appState.collapsedCards = {};
        appState.masterData.forEach((_, idx) => { appState.collapsedCards[idx] = true; });
    }

    const sbState = localStorage.getItem('sidebarCollapsed');
    if (sbState === 'true') appState.sidebarCollapsed = true;

    const savedTitle = localStorage.getItem('appTitle');
    if (savedTitle) appState.appTitle = savedTitle;

    const savedScratch = localStorage.getItem('scratchpadText');
    if (savedScratch) appState.scratchpadText = savedScratch;

    loadProgress();
}

export function loadProgress() {
    appState.progress = JSON.parse(localStorage.getItem('taskProgress')) || {};
}

export function saveData() {
    localStorage.setItem('taskMasterData', JSON.stringify(appState.masterData));
    localStorage.setItem('shortcutData', JSON.stringify(appState.shortcuts));
    localStorage.setItem('automationData', JSON.stringify(appState.automations));
    localStorage.setItem('collapsedCards', JSON.stringify(appState.collapsedCards));
    localStorage.setItem('sidebarCollapsed', appState.sidebarCollapsed);
    localStorage.setItem('appTitle', appState.appTitle);
}

export function saveProgress() {
    localStorage.setItem('taskProgress', JSON.stringify(appState.progress));
}

/**
 * canvas.js — Workflow Canvas (n8n-style)
 *
 * Architecture:
 * - #canvas-view         : the visible viewport (overflow:hidden)
 * - #canvas-pan-container: the infinite virtual canvas; transform moves/scales it
 * - Nodes               : position:absolute inside pan container (virtual coords)
 *
 * Key Insight:
 *   Virtual coords are the "source of truth" stored in task.canvasX / task.canvasY.
 *   On drag:
 *     newX = oldX + (mouseDeltaX / scale)
 *   On pan:
 *     translate(panX, panY) scale(scale)
 *   The pan container's origin-top-left means: a pixel at virtual (x,y) appears at
 *   screen (panX + x*scale, panY + y*scale).
 */

import { appState, CARD_COLORS, saveData } from './state.js';
import { openLinkWithConfig } from './automation.js';
import { logBot } from './logger.js';

// ── State ─────────────────────────────────────────────────────────────────────
let scale = 1;
let panX = 0;
let panY = 0;
let isPanning = false;
let panStartX = 0;
let panStartY = 0;

const GRID = 20;          // grid snap in pixels
const SCALE_MIN = 0.3;
const SCALE_MAX = 2.5;
const SCALE_STEP = 0.15;  // scroll wheel step

// ── Helpers ───────────────────────────────────────────────────────────────────
function snap(v) {
    return Math.round(v / GRID) * GRID;
}

function applyTransform() {
    const container = document.getElementById('canvas-pan-container');
    if (container) {
        container.style.transform = `translate(${panX}px, ${panY}px) scale(${scale})`;
    }
    updateZoomLabel();
}

function updateZoomLabel() {
    const label = document.getElementById('canvas-zoom-label');
    if (label) label.innerText = `${Math.round(scale * 100)}%`;
}

// ── Public: Zoom controls ─────────────────────────────────────────────────────
export function zoomCanvas(delta) {
    scale = Math.min(SCALE_MAX, Math.max(SCALE_MIN, scale + delta));
    applyTransform();
}

export function resetCanvasZoom() {
    scale = 1; panX = 0; panY = 0;
    applyTransform();
}

// ── Public: Render ────────────────────────────────────────────────────────────
export function renderCanvas() {
    const container = document.getElementById('canvas-pan-container');
    if (!container) return;

    container.innerHTML = '';

    let nodeIndex = 0;
    appState.masterData.forEach((wf, wfIdx) => {
        const color = CARD_COLORS[wfIdx % CARD_COLORS.length];
        wf.tasks.forEach((task, tIdx) => {
            // Default positions: waterfall layout, snapped to grid
            if (task.canvasX === undefined) task.canvasX = snap(80 + (tIdx % 4) * 260);
            if (task.canvasY === undefined) task.canvasY = snap(80 + wfIdx * 180);

            const isDone = !!appState.progress[`${wfIdx}_${tIdx}`];
            const isPy = task.link && task.link.toLowerCase().endsWith('.py');
            const isXls = task.link && task.link.toLowerCase().match(/\.(xlsx|xlsm|xls)$/);

            // Node container
            const node = document.createElement('div');
            node.id = `node-${wfIdx}-${tIdx}`;
            node.className = [
                'absolute select-none',
                'w-60 bg-white rounded-2xl shadow-lg',
                'border-2 transition-shadow duration-200',
                isDone ? 'border-teal-400' : 'border-slate-200',
                'flex flex-col overflow-hidden',
                'hover:shadow-xl'
            ].join(' ');
            node.style.left = task.canvasX + 'px';
            node.style.top = task.canvasY + 'px';
            node.style.cursor = 'grab';

            // Accent top bar
            const bar = `<div style="height:4px;background:${color}"></div>`;

            // Header
            const checkIcon = isDone
                ? `<i class="fa-solid fa-circle-check text-teal-500 text-sm"></i>`
                : `<div class="w-4 h-4 rounded-full border-2 border-slate-300"></div>`;

            const typeIcon = isPy
                ? `<span class="text-[9px] font-black px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 uppercase tracking-wide"><i class="fa-brands fa-python mr-0.5"></i>PY</span>`
                : isXls
                    ? `<span class="text-[9px] font-black px-1.5 py-0.5 rounded bg-green-100 text-green-700 uppercase tracking-wide"><i class="fa-solid fa-table mr-0.5"></i>XLS</span>`
                    : '';

            const body = `
                <div class="px-3 py-2 flex flex-col gap-1">
                    <div class="flex items-center justify-between gap-1">
                        <span class="text-[9px] font-black text-slate-400 uppercase tracking-widest truncate flex-grow">${wf.title}</span>
                        ${typeIcon}
                        ${checkIcon}
                    </div>
                    <p class="text-sm font-bold text-slate-800 leading-snug line-clamp-2">${task.name || '(Unnamed)'}</p>
                    ${task.time ? `<span class="text-[10px] text-slate-400 font-mono"><i class="fa-regular fa-clock mr-1"></i>${task.time}</span>` : ''}
                </div>
            `;

            // Footer actions
            let footer = '';
            if (task.link) {
                const runLabel = isPy ? 'Run Script' : isXls ? 'Refresh' : 'Open';
                const runIcon = isPy ? 'fa-brands fa-python' : isXls ? 'fa-solid fa-arrows-rotate' : 'fa-solid fa-arrow-up-right-from-square';
                footer = `
                    <div class="border-t border-slate-100 px-3 py-1.5 flex justify-end">
                        <button
                            class="text-[11px] font-bold text-teal-600 hover:text-white hover:bg-teal-500 px-2 py-1 rounded-lg transition-colors flex items-center gap-1"
                            onmousedown="event.stopPropagation()"
                            onclick="event.stopPropagation(); window.canvasRunNode(${wfIdx},${tIdx})">
                            <i class="${runIcon} text-xs"></i> ${runLabel}
                        </button>
                    </div>
                `;
            }

            node.innerHTML = bar + body + footer;

            // Grid position indicator (shown while dragging)
            const posLabel = document.createElement('div');
            posLabel.className = 'absolute -bottom-5 left-0 text-[9px] text-slate-400 font-mono hidden';
            posLabel.id = `node-pos-${wfIdx}-${tIdx}`;
            node.appendChild(posLabel);

            makeDraggable(node, wfIdx, tIdx);
            container.appendChild(node);
            nodeIndex++;
        });
    });
}

// ── Drag ─────────────────────────────────────────────────────────────────────
function makeDraggable(el, wfIdx, tIdx) {
    let dragging = false;
    let startMouseX = 0, startMouseY = 0;
    let startNodeX = 0, startNodeY = 0;

    el.addEventListener('mousedown', (e) => {
        // Ignore button/port clicks
        if (e.target.closest('button')) return;
        e.preventDefault();
        e.stopPropagation(); // don't trigger pan

        dragging = true;
        startMouseX = e.clientX;
        startMouseY = e.clientY;
        startNodeX = appState.masterData[wfIdx].tasks[tIdx].canvasX || 0;
        startNodeY = appState.masterData[wfIdx].tasks[tIdx].canvasY || 0;

        el.style.cursor = 'grabbing';
        el.style.zIndex = '100';
        el.classList.add('shadow-2xl');

        const posLabel = document.getElementById(`node-pos-${wfIdx}-${tIdx}`);
        if (posLabel) posLabel.classList.remove('hidden');
    });

    document.addEventListener('mousemove', (e) => {
        if (!dragging) return;

        // Delta in screen pixels → convert to virtual canvas pixels
        const dx = (e.clientX - startMouseX) / scale;
        const dy = (e.clientY - startMouseY) / scale;

        let newX = snap(startNodeX + dx);
        let newY = snap(startNodeY + dy);
        // Clamp to non-negative
        newX = Math.max(0, newX);
        newY = Math.max(0, newY);

        el.style.left = newX + 'px';
        el.style.top = newY + 'px';

        const posLabel = document.getElementById(`node-pos-${wfIdx}-${tIdx}`);
        if (posLabel) posLabel.innerText = `(${newX}, ${newY})`;
    });

    document.addEventListener('mouseup', (e) => {
        if (!dragging) return;
        dragging = false;

        el.style.cursor = 'grab';
        el.style.zIndex = '';
        el.classList.remove('shadow-2xl');

        const posLabel = document.getElementById(`node-pos-${wfIdx}-${tIdx}`);
        if (posLabel) posLabel.classList.add('hidden');

        // Persist position
        const dx = (e.clientX - startMouseX) / scale;
        const dy = (e.clientY - startMouseY) / scale;
        const finalX = Math.max(0, snap(startNodeX + dx));
        const finalY = Math.max(0, snap(startNodeY + dy));

        if (appState.masterData[wfIdx] && appState.masterData[wfIdx].tasks[tIdx]) {
            appState.masterData[wfIdx].tasks[tIdx].canvasX = finalX;
            appState.masterData[wfIdx].tasks[tIdx].canvasY = finalY;
            saveData();
        }
    });
}

// ── Pan & Zoom init ───────────────────────────────────────────────────────────
export function initCanvasPanZoom() {
    const view = document.getElementById('canvas-view');
    if (!view) return;

    // Pan with middle mouse or click on empty space
    view.addEventListener('mousedown', (e) => {
        // Only pan on the background (not a node or button)
        if (e.target.closest('[id^="node-"]') || e.target.closest('button')) return;
        isPanning = true;
        panStartX = e.clientX - panX;
        panStartY = e.clientY - panY;
        view.style.cursor = 'grabbing';
    });

    view.addEventListener('mouseleave', () => {
        isPanning = false;
        view.style.cursor = 'default';
    });

    view.addEventListener('mouseup', () => {
        isPanning = false;
        view.style.cursor = 'default';
    });

    view.addEventListener('mousemove', (e) => {
        if (!isPanning) return;
        panX = e.clientX - panStartX;
        panY = e.clientY - panStartY;
        applyTransform();
    });

    // Scroll to zoom (centered on cursor position)
    view.addEventListener('wheel', (e) => {
        e.preventDefault();
        const rect = view.getBoundingClientRect();

        // Mouse position relative to view
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;

        // Virtual position before zoom
        const vxBefore = (mouseX - panX) / scale;
        const vyBefore = (mouseY - panY) / scale;

        // Adjust scale
        const delta = e.deltaY < 0 ? SCALE_STEP : -SCALE_STEP;
        scale = Math.min(SCALE_MAX, Math.max(SCALE_MIN, scale + delta));

        // Adjust pan so the point under the cursor stays fixed
        panX = mouseX - vxBefore * scale;
        panY = mouseY - vyBefore * scale;

        applyTransform();
    }, { passive: false });

    applyTransform();
}

// ── Run node ──────────────────────────────────────────────────────────────────
export async function runCanvasFlow() {
    window.showToast('กำลังรันงานตามลำดับ...', 'info');
    for (let wfIdx = 0; wfIdx < appState.masterData.length; wfIdx++) {
        const wf = appState.masterData[wfIdx];
        for (let tIdx = 0; tIdx < wf.tasks.length; tIdx++) {
            const t = wf.tasks[tIdx];
            if (!t.link) continue;
            logBot(`Canvas Flow: running "${t.name}"`, 'info');
            await openLinkWithConfig(wfIdx, tIdx, false);
            await new Promise(r => setTimeout(r, 800));
        }
    }
    window.showToast('✅ Run Flow เสร็จสิ้น!', 'success');
}

export function startCanvasConnection(e, wfIdx, tIdx) {
    e.stopPropagation();
    window.showToast('Connection mode — คลิก port ของ node อื่นเพื่อเชื่อม', 'info');
}

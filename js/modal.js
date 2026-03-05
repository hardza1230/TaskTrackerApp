import { logBot } from './logger.js';

/** IDs in new index.html:
 *  Automation modal: automation-modal, automation-title, automation-subtitle,
 *    automation-progress, automation-step, automation-log
 *  Excel toast: excel-toast-modal, excel-toast-title, excel-toast-msg,
 *    excel-toast-icon, excel-toast-spinner
 */

let modalStep = 0, modalTotal = 0;

// ─── Automation Modal ─────────────────────────────────────────────────────────
export function showAutomationModal(title, subtitle = 'กำลังดำเนินการ...', totalSteps = 0) {
    const modal = document.getElementById('automation-modal');
    if (!modal) return;
    modal.classList.remove('hidden');

    const titleEl = document.getElementById('automation-title');
    const subEl = document.getElementById('automation-subtitle');
    const progEl = document.getElementById('automation-progress');
    const stepEl = document.getElementById('automation-step');
    const logEl = document.getElementById('automation-log');

    if (titleEl) titleEl.innerText = title;
    if (subEl) subEl.innerText = subtitle;
    if (stepEl) stepEl.innerText = 'Initializing...';
    if (logEl) logEl.innerHTML = '';

    modalTotal = totalSteps;
    modalStep = 0;

    if (progEl) {
        progEl.style.width = totalSteps > 0 ? '0%' : '100%';
    }
}

export function updateAutomationStep(text) {
    const el = document.getElementById('automation-step');
    if (el) el.innerText = text;
}

export function updateAutomationProgress() {
    modalStep++;
    if (modalTotal > 0) {
        const pct = Math.round((modalStep / modalTotal) * 100);
        const el = document.getElementById('automation-progress');
        if (el) el.style.width = `${pct}%`;
    }
}

export function logToModal(message, type = 'info') {
    const logEl = document.getElementById('automation-log');
    if (!logEl) return;
    const time = new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const color = type === 'error' ? 'text-red-400 font-bold' : type === 'success' ? 'text-teal-400 font-bold' : 'text-slate-400';
    const el = document.createElement('div');
    el.innerHTML = `<span class="text-slate-600">[${time}]</span> <span class="${color}">${message}</span>`;
    logEl.appendChild(el);
    logEl.scrollTop = logEl.scrollHeight;
}

export function completeAutomationModal(text = 'เสร็จสิ้น!') {
    const stepEl = document.getElementById('automation-step');
    const progEl = document.getElementById('automation-progress');
    if (stepEl) stepEl.innerText = `✅ ${text}`;
    if (progEl) progEl.style.width = '100%';
    logBot(`✓ Automation complete: ${text}`, 'success');
    setTimeout(hideAutomationModal, 2500);
}

export function hideAutomationModal() {
    const modal = document.getElementById('automation-modal');
    if (modal) modal.classList.add('hidden');
}

// ─── Excel Toast ──────────────────────────────────────────────────────────────
export function showExcelToast(title, msg) {
    const toast = document.getElementById('excel-toast-modal');
    if (!toast) return;
    const titleEl = document.getElementById('excel-toast-title');
    const msgEl = document.getElementById('excel-toast-msg');
    const spinner = document.getElementById('excel-toast-spinner');
    const icon = document.getElementById('excel-toast-icon');
    if (titleEl) titleEl.innerText = title;
    if (msgEl) msgEl.innerText = msg;
    if (spinner) { spinner.classList.remove('hidden'); spinner.classList.add('animate-spin'); }
    if (icon) icon.classList.add('hidden');
    toast.classList.remove('hidden');
}

export function completeExcelToast(msg = 'Refresh เสร็จสิ้น!') {
    const msgEl = document.getElementById('excel-toast-msg');
    const spinner = document.getElementById('excel-toast-spinner');
    const icon = document.getElementById('excel-toast-icon');
    if (msgEl) msgEl.innerText = msg;
    if (spinner) { spinner.classList.add('hidden'); spinner.classList.remove('animate-spin'); }
    if (icon) { icon.classList.remove('hidden'); }
    setTimeout(hideExcelToast, 2500);
}

export function hideExcelToast() {
    const toast = document.getElementById('excel-toast-modal');
    if (toast) toast.classList.add('hidden');
}

// Expose for inline onclick
window.hideExcelToast = hideExcelToast;

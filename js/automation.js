import { appState, saveProgress } from './state.js';
import { renderTasks } from './ui.js';
import { logBot } from './logger.js';
import { showAutomationModal, updateAutomationStep, updateAutomationProgress, logToModal, completeAutomationModal, hideAutomationModal, showExcelToast, completeExcelToast, hideExcelToast } from './modal.js';

export async function openLinkWithConfig(wfIdx, tIdx, skipModal = false) {
    const task = appState.masterData[wfIdx]?.tasks[tIdx];
    if (!task) { logBot(`❌ Task ไม่พบที่ index ${wfIdx}/${tIdx}`, 'error'); return; }

    const path = task.link;
    if (!path || path.trim() === '') {
        window.showToast(`⚠️ ไม่มี Path สำหรับ: ${task.name || 'Task'}`, 'error');
        logBot(`⚠️ Task "${task.name}" ไม่มี Path ที่กำหนด — ข้ามไป`, 'warn');
        return;
    }

    if (path.toLowerCase().endsWith('.py')) {
        if (!skipModal) showAutomationModal(`Running Python`, `${task.name}`, 0, false);
        window.showToast(`💡 กำลังรันสคริปต์: ${task.name}...`, 'info');
        logBot(`เริ่มต้นรันสคริปต์ Python: ${task.name}`, 'info');
        if (!skipModal) logToModal(`Starting script...`, 'info');

        const btnIcon = document.getElementById(`btn-open-${wfIdx}-${tIdx}`);
        if (btnIcon) {
            btnIcon.classList.remove('fa-rocket');
            btnIcon.classList.add('fa-spinner', 'fa-spin');
        }

        try {
            const res = await window.electronAPI.runPython(path);
            if (res.success) {
                window.showToast(`✅ สั่งงานเรียบร้อย: ${task.name}`, 'success');
                logBot(`✅ สคริปต์ ${task.name} ทำงานเสร็จสิ้น`, 'success');
                if (res.output) logBot(`Output: ${res.output.trim()}`, 'info');
                if (!skipModal) completeAutomationModal(`Finished: ${task.name}`);

                const now = new Date();
                const timeStr = now.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
                appState.progress[`${wfIdx}_${tIdx}`] = timeStr;
                saveProgress();
                renderTasks();
            } else {
                window.showToast(`❌ ข้อผิดพลาด: ${res.error}`, 'error');
                logBot(`❌ ข้อผิดพลาดใน ${task.name}: ${res.error}`, 'error');
                if (!skipModal) {
                    logToModal(`Error: ${res.error}`, 'error');
                    hideAutomationModal();
                }
            }
        } catch (e) {
            window.showToast(`❌ Exception: ${e.message}`, 'error');
            logBot(`❌ Exception ใน ${task.name}: ${e.message}`, 'error');
            if (!skipModal) {
                logToModal(`Exception: ${e.message}`, 'error');
                hideAutomationModal();
            }
        }

        if (btnIcon) {
            btnIcon.classList.remove('fa-spinner', 'fa-spin');
            btnIcon.classList.add('fa-rocket');
        }
    } else {
        logBot(`เปิดไฟล์/ลิงก์: ${task.name}`, 'info');
        window.electronAPI.openFile(path);

        const now = new Date();
        const timeStr = now.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
        appState.progress[`${wfIdx}_${tIdx}`] = timeStr;
        saveProgress();
        renderTasks();
    }
}

export async function refreshExcelData(wfIdx, tIdx, skipModal = false) {
    const task = appState.masterData[wfIdx].tasks[tIdx];
    if (!task.link) return;

    if (!skipModal) showExcelToast(`Refreshing Excel`, `Opening ${task.name}...`);
    window.showToast(`📊 กำลังเปิดและรีเฟรช Excel: ${task.name}...`, 'info');
    logBot(`กำลังเปิด Excel และ Refresh: ${task.name}`, 'info');

    const btnIcon = document.getElementById(`btn-refresh-${wfIdx}-${tIdx}`);
    if (btnIcon) {
        btnIcon.classList.remove('fa-arrows-rotate');
        btnIcon.classList.add('fa-spinner', 'fa-spin');
    }

    try {
        const res = await window.electronAPI.refreshExcel(task.link);
        if (res.success) {
            window.showToast(`✅ รีเฟรชและเซฟสำเร็จ: ${task.name}`, 'success');
            logBot(`✅ รีเฟรช Excel สำเร็จ: ${task.name}`, 'success');
            if (!skipModal) completeExcelToast('Excel Refreshed!');

            const now = new Date();
            const timeStr = now.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
            appState.progress[`${wfIdx}_${tIdx}`] = timeStr;
            saveProgress();
            renderTasks();
        } else {
            window.showToast(`❌ รีเฟรชไม่สำเร็จ: ${res.error}`, 'error');
            logBot(`❌ รีเฟรช Excel ล้มเหลว: ${task.name} (${res.error})`, 'error');
            if (!skipModal) {
                document.getElementById('excel-toast-msg').innerText = `Error: ${res.error}`;
                document.getElementById('excel-toast-icon').className = 'fa-solid fa-circle-exclamation text-red-500 text-lg';
                document.getElementById('excel-toast-spinner').classList.add('hidden');
                setTimeout(() => hideExcelToast(), 4000);
            }
        }
    } catch (e) {
        window.showToast(`❌ Error: ${e.message}`, 'error');
        logBot(`❌ Error ในการรีเฟรช: ${task.name} (${e.message})`, 'error');
        if (!skipModal) {
            document.getElementById('excel-toast-msg').innerText = `Exception: ${e.message}`;
            document.getElementById('excel-toast-icon').className = 'fa-solid fa-circle-exclamation text-red-500 text-lg';
            document.getElementById('excel-toast-spinner').classList.add('hidden');
            setTimeout(() => hideExcelToast(), 4000);
        }
    }

    if (btnIcon) {
        btnIcon.classList.remove('fa-spinner', 'fa-spin');
        btnIcon.classList.add('fa-arrows-rotate');
    }
}

export async function runMacro(wfIdx) {
    const tasks = appState.masterData[wfIdx].tasks.filter(t => t.link);
    if (tasks.length === 0) return;

    const btn = document.getElementById(`macro-btn-${wfIdx}`);
    if (btn) btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin mr-2"></i> Launching...';

    showAutomationModal(`Running Macro: ${appState.masterData[wfIdx].title}`, `Automating ${tasks.length} tasks...`, tasks.length, true);
    window.showToast(`🚀 กำลังรัน ${tasks.length} รายการอัตโนมัติ...`, 'info');

    for (const t of tasks) {
        const tIdx = appState.masterData[wfIdx].tasks.indexOf(t);
        updateAutomationStep(`Executing: ${t.name}`);
        logToModal(`Starting task: ${t.name}...`, 'info');

        const isExcel = t.link.toLowerCase().match(/\.(xlsx|xlsm|xls)$/);
        if (isExcel && t.refreshExcel) {
            await refreshExcelData(wfIdx, tIdx, true);
        } else {
            await openLinkWithConfig(wfIdx, tIdx, true);
        }

        updateAutomationProgress();
        await new Promise(r => setTimeout(r, 1200));
    }

    completeAutomationModal('All macro tasks completed!');
    if (btn) btn.innerHTML = '<i class="fa-solid fa-rocket mr-2"></i> Launch All';
}

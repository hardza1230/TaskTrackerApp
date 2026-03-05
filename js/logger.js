// Standalone logger - no imports from other app modules to avoid circular dependencies
export function logBot(message, type = 'info') {
    const logContent = document.getElementById('log-content');
    const badge = document.getElementById('log-badge');

    if (!logContent) return;

    // Remove the initial placeholder text
    const placeholder = logContent.querySelector('.italic');
    if (placeholder) placeholder.remove();

    const time = new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const logItem = document.createElement('div');
    logItem.dataset.type = type; // used by filterLog()

    let color = 'text-slate-400';
    let prefix = '›';
    if (type === 'success') { color = 'text-teal-400'; prefix = '✓'; }
    else if (type === 'error') { color = 'text-red-400'; prefix = '✗'; }
    else if (type === 'warn') { color = 'text-orange-400'; prefix = '⚠'; }

    logItem.className = 'flex gap-3 items-start py-0.5 border-b border-slate-800/50';
    logItem.innerHTML = `
        <span class="text-slate-600 flex-shrink-0 font-mono text-xs pt-0.5">[${time}]</span>
        <span class="text-slate-500 flex-shrink-0 pt-0.5">${prefix}</span>
        <span class="${color} break-all leading-relaxed">${message}</span>
    `;

    logContent.appendChild(logItem);
    logContent.scrollTop = logContent.scrollHeight;

    // Update entry count badge
    const count = logContent.querySelectorAll('div[data-type]').length;
    const countBadge = document.getElementById('log-count-badge');
    if (countBadge) countBadge.innerText = `${count} entries`;

    // Show sidebar notification badge when log page is not visible
    const logPage = document.getElementById('log-page');
    const isLogPageVisible = logPage && !logPage.classList.contains('hidden');
    if (!isLogPageVisible && badge) {
        badge.classList.remove('hidden');
    }
}

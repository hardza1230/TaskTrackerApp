const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  openFile: async (path) => {
    return await ipcRenderer.invoke('open-file', path);
  },
  // เพิ่มฟังก์ชันสำหรับ Watch List
  scanFolder: async (path) => {
    return await ipcRenderer.invoke('scan-folder', path);
  }
});
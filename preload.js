const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  openFile: async (path) => {
    return await ipcRenderer.invoke('open-file', path);
  },
  refreshExcel: async (path) => {
    return await ipcRenderer.invoke('refresh-excel', path);
  }
  // ลบ scanFolder ออกแล้ว
});

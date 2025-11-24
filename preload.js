const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  openFile: async (path) => {
    return await ipcRenderer.invoke('open-file', path);
  }
  // ลบ scanFolder ออกแล้ว
});

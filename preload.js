const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  openFile: async (path) => {
    return await ipcRenderer.invoke('open-file', path);
  },
  refreshExcel: async (path) => {
    return await ipcRenderer.invoke('refresh-excel', path);
  },
  runPython: async (path) => {
    return await ipcRenderer.invoke('run-python', path);
  },
  onPythonLog: (callback) => {
    ipcRenderer.on('python-log', (event, data) => callback(data));
  }
});

// preload.js

const { contextBridge, ipcRenderer } = require('electron'); // Add ipcRenderer

// Expose a secure API to the renderer process (your index.html)
contextBridge.exposeInMainWorld('electronAPI', {
  /**
   * Asynchronously asks the main process to open a path and returns the result.
   * @param {string} path - The path to open.
   * @returns {Promise<{success: boolean, error?: string}>}
   */
  openFile: async (path) => {
    // Use 'invoke' to send a message to the 'open-file' handler and wait for a response
    const result = await ipcRenderer.invoke('open-file', path);
    return result;
  }
});

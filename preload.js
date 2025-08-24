// preload.js

const { contextBridge, shell } = require('electron');

// Expose a secure API to the renderer process (your index.html)
contextBridge.exposeInMainWorld('electronAPI', {
  /**
   * Opens a given local file path or a web URL in the default browser.
   * @param {string} path - The absolute path to the file/program or a web URL.
   */
  openFile: (path) => {
    if (path.startsWith('http://') || path.startsWith('https://')) {
      shell.openExternal(path);
    } else {
      shell.openPath(path);
    }
  }
});

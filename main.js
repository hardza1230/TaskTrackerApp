// main.js

const { app, BrowserWindow, shell, ipcMain } = require('electron'); // Add ipcMain
const path = require('path');

// Function to create the main application window
const createWindow = () => {
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      // Attach the preload script to the renderer process
      preload: path.join(__dirname, 'preload.js'),
      // Important for security: keep these settings
      contextIsolation: true,
      nodeIntegration: false,
    }
  });

  // Load the index.html file into the window
  mainWindow.loadFile('index.html');

  // Optional: Open DevTools for debugging
  // mainWindow.webContents.openDevTools();
};

// This method is called when Electron has finished initialization
app.whenReady().then(() => {
  // ** NEW: Add IPC handler to listen for 'open-file' requests **
  ipcMain.handle('open-file', async (event, filePath) => {
    try {
      // shell.openPath returns a promise resolving to an error string if it fails
      const errorMessage = await shell.openPath(filePath);
      if (errorMessage) {
        // If there's an error message, send it back
        return { success: false, error: errorMessage };
      }
      // If successful, send success status
      return { success: true };
    } catch (error) {
      // If an unexpected error occurs, send that back
      return { success: false, error: error.message };
    }
  });

  createWindow();

  // Handle macOS behavior
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

// Quit when all windows are closed (except on macOS)
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

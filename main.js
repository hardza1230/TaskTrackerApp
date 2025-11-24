const { app, BrowserWindow, shell, ipcMain } = require('electron');
const path = require('path');

const createWindow = () => {
  const mainWindow = new BrowserWindow({
    width: 1280,
    height: 900,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    }
  });

  mainWindow.loadFile('index.html');
  // mainWindow.webContents.openDevTools(); 
};

app.whenReady().then(() => {
  // ฟังก์ชันเปิดไฟล์ (เหลือแค่อันนี้อันเดียว)
  ipcMain.handle('open-file', async (event, filePath) => {
    try {
      const errorMessage = await shell.openPath(filePath);
      return errorMessage ? { success: false, error: errorMessage } : { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

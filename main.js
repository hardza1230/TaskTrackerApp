const { app, BrowserWindow, shell, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');

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
  // mainWindow.webContents.openDevTools(); // Uncomment เพื่อ Debug
};

app.whenReady().then(() => {
  // 1. เปิดไฟล์/ลิงก์
  ipcMain.handle('open-file', async (event, filePath) => {
    try {
      const errorMessage = await shell.openPath(filePath);
      return errorMessage ? { success: false, error: errorMessage } : { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  // 2. ฟังก์ชันใหม่: Watch List (สแกนหาไฟล์ล่าสุด)
  ipcMain.handle('scan-folder', async (event, folderPath) => {
    try {
      if (!fs.existsSync(folderPath)) {
        return { success: false, error: 'ไม่พบ Path หรือเข้าถึงไม่ได้' };
      }

      const files = fs.readdirSync(folderPath);
      
      // ดึงข้อมูลและกรองเฉพาะไฟล์
      const fileDetails = files.map(file => {
        const fullPath = path.join(folderPath, file);
        try {
          const stats = fs.statSync(fullPath);
          return {
            name: file,
            path: fullPath,
            mtime: stats.mtime, // เวลาแก้ไขล่าสุด
            isFile: stats.isFile()
          };
        } catch (e) { return null; }
      }).filter(f => f && f.isFile);

      // เรียงจากใหม่ไปเก่า -> เอาแค่ 5 ไฟล์ล่าสุด
      const recentFiles = fileDetails
        .sort((a, b) => b.mtime - a.mtime)
        .slice(0, 5);

      return { success: true, files: recentFiles };

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
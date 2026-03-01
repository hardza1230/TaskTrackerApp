const { app, BrowserWindow, shell, ipcMain } = require('electron');
const path = require('path');
const { execFile } = require('child_process');
const fs = require('fs');
const os = require('os');

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

  // ฟังก์ชันสั่งรันสคริปต์ Python
  ipcMain.handle('run-python', async (event, filePath) => {
    return new Promise((resolve) => {
      execFile('python', [filePath], { cwd: path.dirname(filePath) }, (error, stdout, stderr) => {
        if (error) {
          resolve({ success: false, error: stderr || error.message });
        } else {
          resolve({ success: true, output: stdout });
        }
      });
    });
  });

  // ฟังก์ชันพิเศษสำหรับเปิด Excel + Refresh + Save
  ipcMain.handle('refresh-excel', async (event, filePath) => {
    return new Promise((resolve) => {
      // สร้างไฟล์ PowerShell จำลองแบบชั่วคราว
      const scriptPath = path.join(os.tmpdir(), `refresh_excel_${Date.now()}.ps1`);
      const psScript = `
param($filePath)
$ErrorActionPreference = 'Stop'
try {
    $excel = New-Object -ComObject Excel.Application
    $excel.Visible = $false
    $excel.DisplayAlerts = $false
    $workbook = $excel.Workbooks.Open($filePath)
    $workbook.RefreshAll()
    Start-Sleep -Seconds 10
    $workbook.Save()
    $workbook.Close()
    $excel.Quit()
    [System.Runtime.Interopservices.Marshal]::ReleaseComObject($excel) | Out-Null
    Write-Output "SUCCESS"
} catch {
    Write-Error $_.Exception.Message
    if ($excel) {
        $excel.Quit()
        [System.Runtime.Interopservices.Marshal]::ReleaseComObject($excel) | Out-Null
    }
    exit 1
}
`;
      // เขียนไฟล์สคริปต์ลงเครื่อง
      fs.writeFileSync(scriptPath, psScript);

      // สั่งทำงานสคริปต์
      execFile('powershell.exe', ['-ExecutionPolicy', 'Bypass', '-File', scriptPath, filePath], (error, stdout, stderr) => {
        // ลบไฟล์ทิ้งหลังทำเสร็จ
        try { fs.unlinkSync(scriptPath); } catch (e) { }

        if (error) {
          resolve({ success: false, error: stderr || error.message });
        } else {
          resolve({ success: true, output: stdout });
        }
      });
    });
  });

  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

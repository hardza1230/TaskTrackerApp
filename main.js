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

  // ฟังก์ชันเปิดหน้าต่างเลือกไฟล์
  ipcMain.handle('dialog-choose-file', async () => {
    const { dialog } = require('electron');
    const result = await dialog.showOpenDialog({
      properties: ['openFile'],
      filters: [
        { name: 'All Supported Files', extensions: ['py', 'xlsx', 'xlsm', 'xls', 'exe', 'bat', 'ps1'] },
        { name: 'Python Scripts', extensions: ['py'] },
        { name: 'Excel Files', extensions: ['xlsx', 'xlsm', 'xls'] },
        { name: 'All Files', extensions: ['*'] }
      ]
    });
    if (!result.canceled && result.filePaths.length > 0) {
      return result.filePaths[0];
    }
    return null;
  });

  // ฟังก์ชันสั่งรันสคริปต์ Python (python → py → python3)
  ipcMain.handle('run-python', async (event, filePath) => {
    // shell:true ทำให้ ENOENT ไม่ถูก emit → ตรวจ stderr "not recognized" แทน
    const launchers = ['python', 'py', 'python3'];

    function tryLauncher(index) {
      return new Promise((resolve) => {
        if (index >= launchers.length) {
          resolve({ success: false, error: 'ไม่พบ Python บนระบบ กรุณาติดตั้งจาก python.org' });
          return;
        }
        const launcher = launchers[index];
        const { spawn } = require('child_process');
        const child = spawn(launcher, [filePath], { cwd: path.dirname(filePath), shell: true });

        let stdout = '', stderr = '';

        child.stdout.on('data', (data) => {
          stdout += data.toString();
          event.sender.send('python-log', data.toString());
        });
        child.stderr.on('data', (data) => { stderr += data.toString(); });

        child.on('close', (code) => {
          const notFound = stderr.toLowerCase().includes('not recognized') ||
            stderr.toLowerCase().includes('cannot find') ||
            stderr.toLowerCase().includes('no such file');
          if (code !== 0 && notFound) {
            // launcher นี้ไม่มีในระบบ → ลองถัดไปโดยไม่ log error
            event.sender.send('python-log', `[INFO] ${launcher} ไม่พบ → ลอง ${launchers[index + 1] || '(ไม่มีตัวสำรอง)'}...`);
            tryLauncher(index + 1).then(resolve);
            return;
          }
          // launcher พบแล้ว → emit stderr ตามจริง
          if (stderr) event.sender.send('python-log', `[ERR] ${stderr}`);

          if (code !== 0) {
            let errorMsg = stderr || `Process exited with code ${code}`;
            if (errorMsg.includes('playwright')) {
              errorMsg += "\n💡 ติดตั้ง: pip install playwright && playwright install";
            }
            resolve({ success: false, error: errorMsg });
          } else {
            resolve({ success: true, output: stdout });
          }
        });

        child.on('error', (err) => {
          event.sender.send('python-log', `[INFO] ${launcher} → ${err.code} → ลองถัดไป`);
          tryLauncher(index + 1).then(resolve);
        });
      });
    }

    return tryLauncher(0);
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
    $excel.Visible = $true
    $excel.DisplayAlerts = $false
    $workbook = $excel.Workbooks.Open($filePath)
      $workbook.RefreshAll()
    # Wait for background refreshes — fix: separate pipeline from -and condition
    $count = 0
    do {
        Start-Sleep -Seconds 1
        $count++
        $stillRefreshing = @($workbook.Queries | Where-Object { $_.Refreshing }).Count
    } while ($stillRefreshing -gt 0 -and $count -lt 60)
    Start-Sleep -Seconds 2
    $workbook.Save()
    $workbook.Close()
    $excel.Quit()
    [System.Runtime.Interopservices.Marshal]::ReleaseComObject($excel) | Out-Null
    Write-Output "SUCCESS"
} catch {
    Write-Output "ERROR: $($_.Exception.Message)"
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

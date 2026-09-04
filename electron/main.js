const { app, BrowserWindow, nativeImage } = require('electron');
const path = require('path');
const fs = require('fs');
const { autoUpdater } = require('electron-updater');

autoUpdater.autoDownload = false;
autoUpdater.autoInstallOnAppQuit = true;

if (process.env.NODE_ENV === 'development' || process.env.TEST_UPDATE === 'true') {
  autoUpdater.forceDevUpdateConfig = true;
  autoUpdater.setFeedURL({
    provider: 'generic',
    url: 'http://localhost:8080/'
  });
}

// Determine if we are running in development mode.
// In dev, ELECTRON_START_URL is set by our `dev` npm script via wait-on.
const isDev = !app.isPackaged;

function resolveAppIcon() {
  const possiblePaths = [
    path.join(__dirname, '../build/icon.ico'),
    path.join(__dirname, '../public/icon.ico'),
    path.join(process.resourcesPath || '', 'icon.ico'),
    path.join(process.resourcesPath || '', 'build/icon.ico'),
    path.join(__dirname, '../src/assets/icon.ico'),
    path.join(__dirname, '../build/icon.png'),
    path.join(__dirname, '../public/icon.png'),
    path.join(__dirname, '../src/assets/logo.png'),
  ];

  for (const iconPath of possiblePaths) {
    if (fs.existsSync(iconPath)) {
      const img = nativeImage.createFromPath(iconPath);
      if (!img.isEmpty()) {
        return img;
      }
    }
  }
  return undefined;
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 700,
    title: 'Alpha Gym - Management System',
    icon: resolveAppIcon(),
    backgroundColor: '#0F172A',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      webSecurity: false, // Allow file:// protocol for local client photos
    },
  });

  if (isDev) {
    // In development, load from the Vite dev server
    win.loadURL('http://localhost:5173');
    win.webContents.openDevTools();
  } else {
    // In production, load from the compiled renderer bundle
    win.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  // Auto-updater event listeners
  autoUpdater.on('checking-for-update', () => {
    win.webContents.send('checking-for-update');
  });
  
  autoUpdater.on('update-available', (info) => {
    win.webContents.send('update-available', { version: info.version, releaseNotes: info.releaseNotes });
  });
  
  autoUpdater.on('update-not-available', () => {
    win.webContents.send('update-not-available');
  });
  
  autoUpdater.on('download-progress', (progressObj) => {
    win.webContents.send('download-progress', { percent: progressObj.percent });
  });
  
  autoUpdater.on('update-downloaded', () => {
    win.webContents.send('update-downloaded');
  });
  
  autoUpdater.on('error', (err) => {
    win.webContents.send('update-error', err.message);
  });

  win.webContents.once('did-finish-load', () => {
    if (!isDev || process.env.TEST_UPDATE === 'true') {
      autoUpdater.checkForUpdates().catch((err) => console.log('Update check skipped:', err.message));
    }
  });

  return win;
}

const { initSchema } = require('./schema');

app.whenReady().then(() => {
  // Initialize Database Schema
  initSchema();

  // Register IPC Handlers
  require('./ipc/auth.ipc');
  require('./ipc/packages.ipc');
  require('./ipc/clients.ipc');
  require('./ipc/subscriptions.ipc');
  require('./ipc/payments.ipc');
  require('./ipc/bodyProgress.ipc');
  require('./ipc/expenses.ipc');
  require('./ipc/alerts.ipc');
  require('./ipc/reports.ipc');
  require('./ipc/backup.ipc');
  require('./ipc/print.ipc');
  require('./ipc/updater.ipc');
  require('./ipc/shell.ipc');
  require('./ipc/settings.ipc');

  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

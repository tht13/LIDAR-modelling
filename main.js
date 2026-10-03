'use strict';

const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const { promises: fs } = require('fs');
const path = require('path');

let mainWindow = null;

async function handleOpenFile() {
  if (!mainWindow) return { canceled: true };
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Select Point Cloud File',
    filters: [
      { name: 'Point Cloud Files', extensions: ['txt', 'xyz', 'pts', 'csv', 'asc'] },
      { name: 'All Files', extensions: ['*'] }
    ],
    properties: ['openFile']
  });

  if (result.canceled || result.filePaths.length === 0) {
    return { canceled: true };
  }

  const filePath = result.filePaths[0];
  try {
    const content = await fs.readFile(filePath, 'utf8');
    return {
      canceled: false,
      success: true,
      fileName: path.basename(filePath),
      filePath: filePath,
      data: content
    };
  } catch (err) {
    console.error('Failed to read selected file:', err);
    return { canceled: false, success: false, error: err.message };
  }
}

async function handleLoadPoints(_event, filePathOrName) {
  try {
    let targetPath;
    if (filePathOrName && path.isAbsolute(filePathOrName)) {
      targetPath = filePathOrName;
    } else {
      const safeBaseName = path.basename(filePathOrName || 'points.txt');
      targetPath = path.resolve(__dirname, safeBaseName);
    }

    const content = await fs.readFile(targetPath, 'utf8');
    return { success: true, fileName: path.basename(targetPath), data: content };
  } catch (err) {
    console.error('Failed to read points file:', err);
    return { success: false, error: err.message };
  }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 850,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true
    }
  });

  mainWindow.loadFile(path.join(__dirname, 'index.html'));

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  ipcMain.handle('points:open-dialog', handleOpenFile);
  ipcMain.handle('points:load', handleLoadPoints);
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
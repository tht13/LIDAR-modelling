'use strict';

const { app, BrowserWindow, ipcMain } = require("electron");  // Module to control application life.
const { readFile, createReadStream } = require("fs");
const { join } = require("path");
// Keep a global reference of the window object, if you don't, the window will
// be closed automatically when the JavaScript object is garbage collected.
let mainWindow = null;

/**
 * 
 * @param {string} name 
 */
function sendFile(name) {
  console.log("send "+name);
  const stream = createReadStream(join(__dirname, name));
  stream.pipe(ipcMain);

  stream.on("end", () => {
    stream.close();
  });
}

// Quit when all windows are closed.
app.on('window-all-closed', () => {
  // On OS X it is common for applications and their menu bar
  // to stay active until the user quits explicitly with Cmd + Q
  if (process.platform != 'darwin') {
    app.quit();
  }
});

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
app.on('ready', () => {
  // Create the browser window.
  mainWindow = new BrowserWindow({ width: 800, height: 600 });

  // and load the index.html of the app.
  mainWindow.loadURL('file://' + __dirname + '/index.html');

  // Open the DevTools.
  //   mainWindow.webContents.openDevTools();

  ipcMain.on("open", (e, name) => sendFile(name));

  // Emitted when the window is closed.
  mainWindow.on('closed', () => {
    // Dereference the window object, usually you would store windows
    // in an array if your app supports multi windows, this is the time
    // when you should delete the corresponding element.
    mainWindow = null;
  });
});
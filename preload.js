const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  getPoints: (fileName) => ipcRenderer.invoke('points:load', fileName),
  openFileDialog: () => ipcRenderer.invoke('points:open-dialog')
});

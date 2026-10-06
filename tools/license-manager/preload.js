'use strict';

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('licenseManager', {
  keyStatus: () => ipcRenderer.invoke('key:status'),
  chooseKey: () => ipcRenderer.invoke('key:choose'),
  issue: (input) => ipcRenderer.invoke('license:issue', input),
  list: () => ipcRenderer.invoke('license:list'),
  saveKey: (key) => ipcRenderer.invoke('license:save', key),
});

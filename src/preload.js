// See the Electron documentation for details on how to use preload scripts:
// https://www.electronjs.org/docs/latest/tutorial/process-model#preload-scripts

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electron', {
  ipcRenderer: {
    send: (channel, data) => {
      // Whitelist channels for security
      const validChannels = ['navigation-request', 'create-tab', 'close-tab', 'tab-action'];
      if (validChannels.includes(channel)) {
        ipcRenderer.send(channel, data);
      }
    },
    receive: (channel, func) => {
      const validChannels = ['navigation-response', 'tab-created', 'tab-closed', 'tab-action-response'];
      if (validChannels.includes(channel)) {
        ipcRenderer.on(channel, (event, ...args) => func(...args));
      }
    },
    invoke: async (channel, data) => {
      const validChannels = ['get-history', 'get-bookmarks', 'save-bookmark', 'delete-bookmark'];
      if (validChannels.includes(channel)) {
        return await ipcRenderer.invoke(channel, data);
      }
    }
  }
});

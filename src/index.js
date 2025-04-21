const { app, BrowserWindow, session, protocol, Menu } = require('electron');
const path = require('node:path');

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (require('electron-squirrel-startup')) {
  app.quit();
}

// Store browser windows
let mainWindow = null;

// Create browser window
const createWindow = () => {
  // Create the browser window.
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      webviewTag: true,
      sandbox: false, // Required for webview tag to work properly
      webSecurity: true,
    },
  });

  // and load the index.html of the app.
  mainWindow.loadFile(path.join(__dirname, 'index.html'));

  // Create application menu
  createAppMenu();

  // Enable webview permissions
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': ["default-src 'self' * 'unsafe-inline' 'unsafe-eval' data: blob:"]
      }
    });
  });

  // Register file protocol for local files
  protocol.registerFileProtocol('file', (request, callback) => {
    const url = request.url.substr(7); // Strip 'file://' from the URL
    try {
      return callback(decodeURIComponent(url));
    } catch (error) {
      console.error('ERROR: registerFileProtocol:', error);
      return callback(404);
    }
  });
};

// Create application menu
function createAppMenu() {
  const template = [
    {
      label: 'File',
      submenu: [
        {
          label: 'New Tab',
          accelerator: 'CmdOrCtrl+T',
          click: () => {
            mainWindow.webContents.executeJavaScript(`
              const newTabId = 'tab-${Date.now()}';
              createTab(newTabId, true);
            `);
          }
        },
        {
          label: 'New Window',
          accelerator: 'CmdOrCtrl+N',
          click: () => {
            createWindow();
          }
        },
        {
          type: 'separator'
        },
        {
          label: 'Close Tab',
          accelerator: 'CmdOrCtrl+W',
          click: () => {
            mainWindow.webContents.executeJavaScript(`
              closeTab(activeTabId);
            `);
          }
        },
        {
          type: 'separator'
        },
        {
          label: 'Exit',
          role: 'quit'
        }
      ]
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'delete' },
        { type: 'separator' },
        { role: 'selectAll' }
      ]
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' }
      ]
    },
    {
      label: 'History',
      submenu: [
        {
          label: 'Back',
          accelerator: 'Alt+Left',
          click: () => {
            mainWindow.webContents.executeJavaScript(`
              const webview = document.querySelector('#webview-${activeTabId}');
              if (webview && webview.canGoBack()) webview.goBack();
            `);
          }
        },
        {
          label: 'Forward',
          accelerator: 'Alt+Right',
          click: () => {
            mainWindow.webContents.executeJavaScript(`
              const webview = document.querySelector('#webview-${activeTabId}');
              if (webview && webview.canGoForward()) webview.goForward();
            `);
          }
        },
        {
          label: 'Reload',
          accelerator: 'CmdOrCtrl+R',
          click: () => {
            mainWindow.webContents.executeJavaScript(`
              const webview = document.querySelector('#webview-${activeTabId}');
              if (webview) webview.reload();
            `);
          }
        }
      ]
    },
    {
      label: 'Bookmarks',
      submenu: [
        {
          label: 'Bookmark This Page',
          accelerator: 'CmdOrCtrl+D',
          click: () => {
            mainWindow.webContents.executeJavaScript('addBookmark()');
          }
        },
        {
          label: 'Show All Bookmarks',
          accelerator: 'CmdOrCtrl+Shift+B',
          click: () => {
            // In a full implementation, we would show a bookmarks manager
            mainWindow.webContents.executeJavaScript(`
              navigateToUrl('about:bookmarks');
            `);
          }
        }
      ]
    },
    {
      label: 'Developer',
      submenu: [
        {
          label: 'Toggle Developer Tools for Tab',
          click: () => {
            mainWindow.webContents.executeJavaScript(`
              const webview = document.querySelector('#webview-${activeTabId}');
              if (webview) webview.openDevTools();
            `);
          }
        },
        {
          label: 'Toggle Main Process Developer Tools',
          click: () => mainWindow.webContents.toggleDevTools()
        }
      ]
    }
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    // On OS X it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and import them here.

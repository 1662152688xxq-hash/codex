/**
 * Electron 主进程
 * 使用自定义 app:// 协议加载本地文件，避免 file:// 的 ES Module 限制
 */

const { app, BrowserWindow, protocol, net } = require('electron');
const path = require('path');

// 确保 Three.js 可以从 node_modules 正确加载
const THREE_PATH = path.join(__dirname, 'node_modules', 'three');

let mainWindow = null;

// 自定义协议处理：将 app:// 请求映射到本地文件
protocol.registerSchemesAsPrivileged([
  {
    scheme: 'app',
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      corsEnabled: true,
    },
  },
]);

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    title: '3D 地形生成器',
    backgroundColor: '#1a1a2e',
    icon: path.join(__dirname, 'icon.png'),
    show: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: true,
    },
  });

  // 加载应用
  mainWindow.loadURL('app://./index.html');

  // 窗口准备好后再显示，避免白屏闪烁
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  // 开发环境下打开 DevTools（可选）
  if (process.env.NODE_ENV === 'development') {
    mainWindow.webContents.openDevTools();
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// 注册自定义协议处理
function registerProtocol() {
  protocol.handle('app', (request) => {
    const url = new URL(request.url);
    let filePath = path.join(__dirname, url.pathname);

    // 默认加载 index.html
    if (url.pathname === '/' || url.pathname === '') {
      filePath = path.join(__dirname, 'index.html');
    }

    // 安全：防止路径穿越
    const normalized = path.resolve(filePath);
    if (!normalized.startsWith(path.resolve(__dirname))) {
      return new Response('Forbidden', { status: 403 });
    }

    return net.fetch('file://' + normalized);
  });
}

app.whenReady().then(() => {
  registerProtocol();
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

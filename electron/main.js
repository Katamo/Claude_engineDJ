const { app, BrowserWindow, ipcMain, dialog, protocol, net } = require('electron')
const path = require('path')
const fs = require('fs')
const { registerDatabaseHandlers } = require('./database')

// Register custom scheme as privileged BEFORE app is ready
protocol.registerSchemesAsPrivileged([
  { scheme: 'local-audio', privileges: { standard: true, stream: true, bypassCSP: true, supportFetchAPI: true } }
])

let mainWindow

const CONFIG_PATH = path.join(app.getPath('userData'), 'config.json')

function loadConfig() {
  let config
  try {
    if (fs.existsSync(CONFIG_PATH)) {
      config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'))
    }
  } catch (e) { /* ignore */ }
  if (!config) {
    config = { dbPath: path.join(__dirname, '..', '..', 'Engine Library', 'Database2') }
  }
  if (!Array.isArray(config.musicFolders)) {
    config.musicFolders = []
  }
  return config
}

function saveConfig(config) {
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2), 'utf-8')
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    backgroundColor: '#0d0d0d',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  if (process.env.NODE_ENV !== 'production' && !app.isPackaged) {
    mainWindow.loadURL('http://localhost:5173')
  } else {
    mainWindow.loadFile(path.join(__dirname, '..', 'dist', 'index.html'))
  }
}

function registerConfigHandlers() {
  ipcMain.handle('config:get', () => {
    return loadConfig()
  })

  ipcMain.handle('config:save', (_event, config) => {
    saveConfig(config)
    return { success: true }
  })

  ipcMain.handle('config:selectFolder', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
      title: 'Select Engine DJ Database Folder',
      properties: ['openDirectory'],
      defaultPath: loadConfig().dbPath
    })
    if (result.canceled || !result.filePaths.length) return null
    return result.filePaths[0]
  })

  ipcMain.handle('config:selectMusicFolder', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
      title: 'Select Music Folder',
      properties: ['openDirectory']
    })
    if (result.canceled || !result.filePaths.length) return null
    return result.filePaths[0]
  })
}

app.whenReady().then(() => {
  // Register protocol handler to stream local audio files
  protocol.handle('local-audio', (request) => {
    // URL format: local-audio://play/D:/path/to/file.mp3
    const url = new URL(request.url)
    let filePath = decodeURIComponent(url.pathname)
    // Remove leading slash on Windows (e.g. /D:/path -> D:/path)
    if (filePath.match(/^\/[A-Za-z]:\//)) filePath = filePath.substring(1)
    const absPath = filePath.replace(/\//g, '\\')
    if (!fs.existsSync(absPath)) {
      return new Response('File not found: ' + absPath, { status: 404 })
    }
    const data = fs.readFileSync(absPath)
    const ext = path.extname(absPath).toLowerCase()
    const mime = ext === '.flac' ? 'audio/flac' : ext === '.wav' ? 'audio/wav' : 'audio/mpeg'
    return new Response(data, {
      status: 200,
      headers: { 'Content-Type': mime, 'Content-Length': String(data.length) }
    })
  })

  const config = loadConfig()
  registerConfigHandlers()
  registerDatabaseHandlers(ipcMain, config.dbPath)
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

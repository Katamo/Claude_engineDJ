const { app, BrowserWindow, ipcMain, dialog, protocol } = require('electron')
const path = require('path')
const fs = require('fs')
const { registerDatabaseHandlers } = require('./database')
const { pathToFileURL } = require('url')

let mainWindow

const CONFIG_PATH = path.join(app.getPath('userData'), 'config.json')

function loadConfig() {
  try {
    if (fs.existsSync(CONFIG_PATH)) {
      return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'))
    }
  } catch (e) { /* ignore */ }
  return {
    dbPath: path.join(__dirname, '..', '..', 'Engine Library', 'Database2')
  }
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
}

app.whenReady().then(() => {
  // Register custom protocol to serve local audio files
  protocol.handle('local-audio', (request) => {
    // URL format: local-audio:///D:/path/to/file.mp3
    let filePath = decodeURIComponent(request.url.replace('local-audio:///', ''))
    // On Windows, ensure backslashes
    filePath = filePath.replace(/\//g, '\\')
    // Remove leading backslash if drive letter follows (e.g. \D: -> D:)
    if (filePath.match(/^\\[A-Za-z]:/)) filePath = filePath.substring(1)
    return new Response(fs.createReadStream(filePath), {
      headers: { 'Content-Type': filePath.endsWith('.flac') ? 'audio/flac' : 'audio/mpeg' }
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

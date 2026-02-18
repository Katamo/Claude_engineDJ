const initSqlJs = require('sql.js')
const path = require('path')
const fs = require('fs')
const zlib = require('zlib')

const DEFAULT_DB_FILE = 'm.db'

let DB_DIR = null
let currentDbFile = null
let SQL = null
let db = null

async function initSql() {
  if (!SQL) {
    SQL = await initSqlJs()
  }
  return SQL
}

async function openDatabase(dbFile) {
  const sql = await initSql()
  if (db) db.close()
  const dbPath = path.join(DB_DIR, dbFile)
  const buffer = fs.readFileSync(dbPath)
  db = new sql.Database(buffer)
  currentDbFile = dbFile
  return db
}

function saveDatabase() {
  if (!db || !currentDbFile) return
  const data = db.export()
  const buffer = Buffer.from(data)
  fs.writeFileSync(path.join(DB_DIR, currentDbFile), buffer)
}

function ensureDb() {
  if (!db) throw new Error('Database not initialized')
  return db
}

function queryAll(sql, params = []) {
  const d = ensureDb()
  const stmt = d.prepare(sql)
  if (params.length) stmt.bind(params)
  const results = []
  while (stmt.step()) {
    results.push(stmt.getAsObject())
  }
  stmt.free()
  return results
}

function queryOne(sql, params = []) {
  const d = ensureDb()
  const stmt = d.prepare(sql)
  if (params.length) stmt.bind(params)
  let result = null
  if (stmt.step()) {
    result = stmt.getAsObject()
  }
  stmt.free()
  return result
}

function processWaveformBlob(blob) {
  if (!blob || blob.length < 5) return null
  try {
    // Skip 4-byte header, then decompress zlib data
    const compressed = Buffer.from(blob.buffer || blob).slice(4)
    const decompressed = zlib.inflateSync(compressed)
    const entryCount = Math.floor(decompressed.length / 3)
    // Downsample to ~60 bars for the small preview
    const targetBars = 60
    const step = Math.max(1, Math.floor(entryCount / targetBars))
    const bars = []
    for (let i = 0; i < entryCount && bars.length < targetBars; i += step) {
      const offset = i * 3
      const low = decompressed[offset] || 0
      const mid = decompressed[offset + 1] || 0
      const high = decompressed[offset + 2] || 0
      bars.push({ low, mid, high })
    }
    return bars
  } catch (e) {
    return null
  }
}

function registerDatabaseHandlers(ipcMain, dbPath) {
  DB_DIR = dbPath
  let initialized = false

  async function ensureInit() {
    if (!initialized) {
      await openDatabase(DEFAULT_DB_FILE)
      initialized = true
    }
  }

  ipcMain.handle('db:setPath', async (_event, newPath) => {
    if (db) db.close()
    db = null
    DB_DIR = newPath
    initialized = false
    return { success: true }
  })

  ipcMain.handle('db:getPath', () => {
    return DB_DIR
  })

  ipcMain.handle('db:getDatabases', async () => {
    await ensureInit()
    const sql = await initSql()
    const files = fs.readdirSync(DB_DIR).filter(f => f.endsWith('.db'))
    return files.map(f => {
      const buffer = fs.readFileSync(path.join(DB_DIR, f))
      const tempDb = new sql.Database(buffer)

      let uuid = null, playlistCount = 0, trackCount = 0, entityCount = 0
      try {
        const infoStmt = tempDb.prepare('SELECT uuid FROM Information')
        if (infoStmt.step()) uuid = infoStmt.getAsObject().uuid
        infoStmt.free()

        const plStmt = tempDb.prepare('SELECT COUNT(*) as cnt FROM Playlist')
        if (plStmt.step()) playlistCount = plStmt.getAsObject().cnt
        plStmt.free()

        const trStmt = tempDb.prepare('SELECT COUNT(*) as cnt FROM Track')
        if (trStmt.step()) trackCount = trStmt.getAsObject().cnt
        trStmt.free()

        const enStmt = tempDb.prepare('SELECT COUNT(*) as cnt FROM PlaylistEntity')
        if (enStmt.step()) entityCount = enStmt.getAsObject().cnt
        enStmt.free()
      } catch (e) { /* table might not exist */ }
      tempDb.close()

      return { file: f, uuid, playlists: playlistCount, tracks: trackCount, entities: entityCount }
    })
  })

  ipcMain.handle('db:switchDatabase', async (_event, dbFile) => {
    await openDatabase(dbFile)
    initialized = true
    return { success: true, file: dbFile }
  })

  ipcMain.handle('db:getAllTracks', async () => {
    await ensureInit()
    // First try Track table directly
    const trackCount = queryOne('SELECT COUNT(*) as cnt FROM Track').cnt
    if (trackCount > 0) {
      return queryAll(`
        SELECT
          id as trackId,
          id as entityId,
          title, artist, album, genre, bpm, bpmAnalyzed,
          key, rating, length, year, label, comment,
          composer, remixer, filename, path as filePath,
          bitrate, fileType, dateAdded, timeLastPlayed
        FROM Track
        ORDER BY id
      `)
    }
    // Fallback: get all unique tracks from PlaylistEntity joined with Track
    return queryAll(`
      SELECT DISTINCT
        pe.trackId,
        pe.id as entityId,
        pe.databaseUuid,
        t.title, t.artist, t.album, t.genre, t.bpm, t.bpmAnalyzed,
        t.key, t.rating, t.length, t.year, t.label, t.comment,
        t.composer, t.remixer, t.filename, t.path as filePath,
        t.bitrate, t.fileType, t.dateAdded, t.timeLastPlayed
      FROM PlaylistEntity pe
      LEFT JOIN Track t ON pe.trackId = t.id
      GROUP BY pe.trackId, pe.databaseUuid
      ORDER BY pe.trackId
    `)
  })

  ipcMain.handle('db:getPlaylists', async () => {
    await ensureInit()
    return queryAll('SELECT id, title, parentListId, nextListId, lastEditTime, isPersisted, isExplicitlyExported FROM Playlist ORDER BY id')
  })

  ipcMain.handle('db:getPlaylistTracks', async (_event, listId) => {
    await ensureInit()
    return queryAll(`
      SELECT
        pe.id as entityId,
        pe.trackId,
        pe.databaseUuid,
        pe.nextEntityId,
        pe.membershipReference,
        t.title,
        t.artist,
        t.album,
        t.genre,
        t.bpm,
        t.bpmAnalyzed,
        t.key,
        t.rating,
        t.length,
        t.year,
        t.label,
        t.comment,
        t.composer,
        t.remixer,
        t.filename,
        t.path as filePath,
        t.bitrate,
        t.fileType,
        t.dateAdded,
        t.timeLastPlayed
      FROM PlaylistEntity pe
      LEFT JOIN Track t ON pe.trackId = t.id
      WHERE pe.listId = ?
      ORDER BY pe.id
    `, [listId])
  })

  ipcMain.handle('db:searchPlaylists', async (_event, query) => {
    await ensureInit()
    return queryAll('SELECT id, title, parentListId, nextListId FROM Playlist WHERE title LIKE ? ORDER BY title', [`%${query}%`])
  })

  ipcMain.handle('db:getTrack', async (_event, trackId) => {
    await ensureInit()
    return queryOne('SELECT * FROM Track WHERE id = ?', [trackId])
  })

  ipcMain.handle('db:getStats', async () => {
    await ensureInit()
    const playlists = queryOne('SELECT COUNT(*) as cnt FROM Playlist').cnt
    const tracks = queryOne('SELECT COUNT(*) as cnt FROM Track').cnt
    const entities = queryOne('SELECT COUNT(*) as cnt FROM PlaylistEntity').cnt
    const info = queryOne('SELECT * FROM Information')
    return { playlists, tracks, entities, info }
  })

  ipcMain.handle('db:reorderPlaylistEntities', async (_event, listId, orderedEntityIds) => {
    await ensureInit()
    const d = ensureDb()
    // Update nextEntityId for each entity to match the new order
    for (let i = 0; i < orderedEntityIds.length; i++) {
      const entityId = orderedEntityIds[i]
      const nextId = i < orderedEntityIds.length - 1 ? orderedEntityIds[i + 1] : 0
      d.run('UPDATE PlaylistEntity SET nextEntityId = ? WHERE id = ?', [nextId, entityId])
    }
    saveDatabase()
    return { success: true }
  })

  ipcMain.handle('db:deletePlaylist', async (_event, playlistId) => {
    await ensureInit()
    const d = ensureDb()

    const playlist = queryOne('SELECT id, parentListId, nextListId FROM Playlist WHERE id = ?', [playlistId])
    if (!playlist) return { success: false, error: 'Playlist not found' }

    // Remove from parent's linked list
    const siblings = queryAll('SELECT id, nextListId FROM Playlist WHERE parentListId = ?', [playlist.parentListId])
    const prevSibling = siblings.find(s => s.nextListId === playlistId)

    // Detach first to avoid UNIQUE constraint
    d.run('UPDATE Playlist SET parentListId = -999, nextListId = -999 WHERE id = ?', [playlistId])

    if (prevSibling) {
      d.run('UPDATE Playlist SET nextListId = ? WHERE id = ?', [playlist.nextListId || 0, prevSibling.id])
    }

    // Move children to parent level
    const children = queryAll('SELECT id FROM Playlist WHERE parentListId = ?', [playlistId])
    for (const child of children) {
      d.run('UPDATE Playlist SET parentListId = ? WHERE id = ?', [playlist.parentListId, child.id])
    }

    // Delete playlist entities
    d.run('DELETE FROM PlaylistEntity WHERE listId = ?', [playlistId])

    // Delete the playlist
    d.run('DELETE FROM Playlist WHERE id = ?', [playlistId])

    saveDatabase()
    return { success: true }
  })

  ipcMain.handle('db:renamePlaylist', async (_event, playlistId, newTitle) => {
    await ensureInit()
    const d = ensureDb()
    d.run('UPDATE Playlist SET title = ? WHERE id = ?', [newTitle, playlistId])
    saveDatabase()
    return { success: true }
  })

  ipcMain.handle('db:reorderPlaylists', async (_event, parentListId, orderedIds) => {
    await ensureInit()
    const d = ensureDb()
    // First reset all to temp values to avoid UNIQUE constraint conflicts
    for (let i = 0; i < orderedIds.length; i++) {
      d.run('UPDATE Playlist SET nextListId = ? WHERE id = ?', [-(i + 1000), orderedIds[i]])
    }
    // Then set the correct order
    for (let i = 0; i < orderedIds.length; i++) {
      const id = orderedIds[i]
      const nextId = i < orderedIds.length - 1 ? orderedIds[i + 1] : 0
      d.run('UPDATE Playlist SET nextListId = ? WHERE id = ?', [nextId, id])
    }
    saveDatabase()
    return { success: true }
  })

  ipcMain.handle('db:movePlaylist', async (_event, playlistId, newParentId) => {
    await ensureInit()
    const d = ensureDb()

    const playlist = queryOne('SELECT id, parentListId, nextListId FROM Playlist WHERE id = ?', [playlistId])
    if (!playlist) return { success: false, error: 'Playlist not found' }

    // Prevent moving into itself or its own descendants
    function isDescendant(parentId, targetId) {
      const children = queryAll('SELECT id FROM Playlist WHERE parentListId = ?', [targetId])
      for (const child of children) {
        if (child.id === parentId) return true
        if (isDescendant(parentId, child.id)) return true
      }
      return false
    }
    if (playlistId === newParentId || isDescendant(newParentId, playlistId)) {
      return { success: false, error: 'Cannot move playlist into itself or its descendants' }
    }

    const oldParentId = playlist.parentListId
    if (oldParentId === newParentId) return { success: true } // already in target

    // Gather info before making changes
    const oldSiblings = queryAll('SELECT id, nextListId FROM Playlist WHERE parentListId = ?', [oldParentId])
    const prevSibling = oldSiblings.find(s => s.nextListId === playlistId)

    const newSiblings = queryAll('SELECT id, nextListId FROM Playlist WHERE parentListId = ?', [newParentId])
    const newSiblingIds = new Set(newSiblings.map(s => s.id))
    const newTail = newSiblings.find(s => !s.nextListId || s.nextListId === 0 || !newSiblingIds.has(s.nextListId))

    // Step 1: Detach playlist to temp state to avoid UNIQUE constraint conflicts
    d.run('UPDATE Playlist SET parentListId = -999, nextListId = -999 WHERE id = ?', [playlistId])

    // Step 2: Fix old parent's linked list
    if (prevSibling) {
      d.run('UPDATE Playlist SET nextListId = ? WHERE id = ?', [playlist.nextListId || 0, prevSibling.id])
    }

    // Step 3: Update new parent's tail to point to moved playlist
    if (newTail) {
      d.run('UPDATE Playlist SET nextListId = ? WHERE id = ?', [playlistId, newTail.id])
    }

    // Step 4: Place playlist in new parent as the new tail
    d.run('UPDATE Playlist SET parentListId = ?, nextListId = 0 WHERE id = ?', [newParentId, playlistId])

    saveDatabase()
    return { success: true }
  })

  ipcMain.handle('db:createPlaylist', async (_event, title, parentListId = 0) => {
    await ensureInit()
    const d = ensureDb()
    // Get the next available ID
    const maxId = queryOne('SELECT MAX(id) as maxId FROM Playlist').maxId || 0
    const newId = maxId + 1
    // Find the last sibling in this parent (one whose nextListId is 0 or not pointing to another sibling)
    const siblings = queryAll('SELECT id, nextListId FROM Playlist WHERE parentListId = ?', [parentListId])
    const referencedIds = new Set(siblings.map(s => s.nextListId).filter(id => id > 0))
    const lastSibling = siblings.find(s => !s.nextListId || s.nextListId === 0 || !referencedIds.has(s.id) === false)
    // Actually find the tail: the one whose nextListId is 0 or not a valid sibling
    const siblingIds = new Set(siblings.map(s => s.id))
    const tail = siblings.find(s => !s.nextListId || s.nextListId === 0 || !siblingIds.has(s.nextListId))

    d.run('INSERT INTO Playlist (id, title, parentListId, nextListId, isPersisted, isExplicitlyExported) VALUES (?, ?, ?, 0, 1, 0)', [newId, title, parentListId])

    // Update the previous tail to point to the new playlist
    if (tail) {
      d.run('UPDATE Playlist SET nextListId = ? WHERE id = ?', [newId, tail.id])
    }

    saveDatabase()
    return { success: true, id: newId }
  })

  ipcMain.handle('db:addTrackToPlaylist', async (_event, listId, trackId, databaseUuid) => {
    await ensureInit()
    const d = ensureDb()

    // Check if track already exists in this playlist
    const existing = queryOne('SELECT id FROM PlaylistEntity WHERE listId = ? AND trackId = ? AND databaseUuid = ?', [listId, trackId, databaseUuid || ''])
    if (existing) return { success: false, error: 'Track already in playlist' }

    // Get next available entity ID
    const maxId = queryOne('SELECT MAX(id) as maxId FROM PlaylistEntity').maxId || 0
    const newId = maxId + 1

    // Find the tail of this playlist's entity list
    const entities = queryAll('SELECT id, nextEntityId FROM PlaylistEntity WHERE listId = ?', [listId])
    const entityIds = new Set(entities.map(e => e.id))
    const tail = entities.find(e => !e.nextEntityId || e.nextEntityId === 0 || !entityIds.has(e.nextEntityId))

    // Insert new entity
    d.run('INSERT INTO PlaylistEntity (id, listId, trackId, databaseUuid, nextEntityId, membershipReference) VALUES (?, ?, ?, ?, 0, 0)', [newId, listId, trackId, databaseUuid || ''])

    // Update tail to point to new entity
    if (tail) {
      d.run('UPDATE PlaylistEntity SET nextEntityId = ? WHERE id = ?', [newId, tail.id])
    }

    saveDatabase()
    return { success: true, entityId: newId }
  })

  ipcMain.handle('db:removeTrackFromPlaylist', async (_event, listId, entityId) => {
    await ensureInit()
    const d = ensureDb()

    const entity = queryOne('SELECT id, nextEntityId FROM PlaylistEntity WHERE id = ? AND listId = ?', [entityId, listId])
    if (!entity) return { success: false, error: 'Entity not found' }

    // Fix linked list: find the entity pointing to this one
    const prev = queryOne('SELECT id FROM PlaylistEntity WHERE listId = ? AND nextEntityId = ?', [listId, entityId])
    if (prev) {
      d.run('UPDATE PlaylistEntity SET nextEntityId = ? WHERE id = ?', [entity.nextEntityId || 0, prev.id])
    }

    // Delete the entity
    d.run('DELETE FROM PlaylistEntity WHERE id = ?', [entityId])

    saveDatabase()
    return { success: true }
  })

  ipcMain.handle('db:removeTracksFromPlaylist', async (_event, listId, entityIds) => {
    await ensureInit()
    const d = ensureDb()

    const removeSet = new Set(entityIds)

    // Get all entities for this playlist to rebuild the linked list
    const entities = queryAll('SELECT id, nextEntityId FROM PlaylistEntity WHERE listId = ?', [listId])
    const byId = new Map(entities.map(e => [e.id, e]))

    // For each entity to remove, fix the linked list
    for (const entityId of entityIds) {
      const entity = byId.get(entityId)
      if (!entity) continue

      // Find next entity that is NOT being removed
      let nextId = entity.nextEntityId || 0
      while (nextId > 0 && removeSet.has(nextId)) {
        const next = byId.get(nextId)
        nextId = next ? (next.nextEntityId || 0) : 0
      }

      // Find the previous entity pointing to this one
      const prev = queryOne('SELECT id FROM PlaylistEntity WHERE listId = ? AND nextEntityId = ?', [listId, entityId])
      if (prev && !removeSet.has(prev.id)) {
        d.run('UPDATE PlaylistEntity SET nextEntityId = ? WHERE id = ?', [nextId, prev.id])
      }
    }

    // Delete all entities
    for (const entityId of entityIds) {
      d.run('DELETE FROM PlaylistEntity WHERE id = ?', [entityId])
    }

    saveDatabase()
    return { success: true }
  })

  ipcMain.handle('db:removeFromCollection', async (_event, trackId) => {
    await ensureInit()
    const d = ensureDb()

    // Find all playlist entities referencing this track
    const entities = queryAll('SELECT id, listId, nextEntityId FROM PlaylistEntity WHERE trackId = ?', [trackId])

    // For each entity, fix the linked list in its playlist then delete
    for (const entity of entities) {
      const prev = queryOne('SELECT id FROM PlaylistEntity WHERE listId = ? AND nextEntityId = ?', [entity.listId, entity.id])
      if (prev) {
        d.run('UPDATE PlaylistEntity SET nextEntityId = ? WHERE id = ?', [entity.nextEntityId || 0, prev.id])
      }
      d.run('DELETE FROM PlaylistEntity WHERE id = ?', [entity.id])
    }

    // Delete the track itself
    d.run('DELETE FROM Track WHERE id = ?', [trackId])

    saveDatabase()
    return { success: true }
  })

  ipcMain.handle('db:checkFilePaths', async (_event, data) => {
    // data: { musicDrive, musicFolders, filePaths }
    const { musicDrive, musicFolders, filePaths } = data || {}
    const roots = [musicDrive || '', ...(Array.isArray(musicFolders) ? musicFolders : [])]
      .filter(r => r)
    const result = {}
    if (!filePaths || !filePaths.length) return result
    for (const { trackId, filePath } of filePaths) {
      if (!filePath) { result[trackId] = false; continue }
      // Normalize separators and strip leading ../ or ./
      let normalized = filePath.replace(/\\/g, '/')
      while (normalized.startsWith('../')) normalized = normalized.substring(3)
      while (normalized.startsWith('./')) normalized = normalized.substring(2)
      // Try musicDrive first, then each musicFolder
      let found = false
      for (const root of roots) {
        let drive = root.replace(/\\/g, '/')
        if (!drive.endsWith('/')) drive += '/'
        const fullPath = path.resolve((drive + normalized).replace(/\//g, path.sep))
        if (fs.existsSync(fullPath)) { found = true; break }
      }
      result[trackId] = found
    }
    return result
  })

  ipcMain.handle('db:findMatchingFiles', async (_event, data) => {
    const { musicDrive, musicFolders, excludeFolders, filename, fileType, bitrate, length: trackLength } = data || {}
    if (!filename) return []
    const roots = [musicDrive || '', ...(Array.isArray(musicFolders) ? musicFolders : [])]
      .filter(r => r)
    // Normalize excluded folders for comparison
    const ALWAYS_EXCLUDED = ['$RECYCLE.BIN', 'System Volume Information']
    const excluded = (Array.isArray(excludeFolders) ? excludeFolders : [])
      .filter(r => r)
      .map(f => path.resolve(f).toLowerCase())
    const target = filename.toLowerCase()
    const targetExt = path.extname(target).toLowerCase()
    const targetStem = path.basename(target, targetExt).toLowerCase()
    // Estimate file size from bitrate (kbps) and length (seconds)
    const estimatedSize = (bitrate && trackLength) ? (bitrate * 1000 / 8) * trackLength : 0
    const results = []
    const seen = new Set()

    for (const root of roots) {
      const rootDir = path.resolve(root)
      let entries
      try {
        entries = fs.readdirSync(rootDir, { withFileTypes: true, recursive: true })
      } catch (e) { continue }
      for (const entry of entries) {
        if (!entry.isFile()) continue
        // Skip files inside excluded or system folders
        const dir = entry.parentPath || entry.path || ''
        const dirResolved = path.resolve(dir).toLowerCase()
        const dirParts = dirResolved.split(path.sep)
        if (ALWAYS_EXCLUDED.some(name => dirParts.includes(name.toLowerCase()))) continue
        if (excluded.some(ex => dirResolved === ex || dirResolved.startsWith(ex + path.sep))) continue
        const entryName = entry.name.toLowerCase()
        const entryExt = path.extname(entryName).toLowerCase()
        const entryStem = path.basename(entryName, entryExt).toLowerCase()
        const fullPath = path.join(dir, entry.name)
        if (seen.has(fullPath)) continue

        // Match type: exact, similar name, or similar size
        let matchType = null
        if (entryName === target) {
          matchType = 'exact'
        } else if (entryExt === targetExt) {
          // Similar filename: stem contains the other or differs by few chars
          if (entryStem.includes(targetStem) || targetStem.includes(entryStem)) {
            matchType = 'similar name'
          } else {
            // Levenshtein-like: check if stems differ by at most ~20% of length
            const maxLen = Math.max(entryStem.length, targetStem.length)
            if (maxLen > 0 && maxLen <= 300) {
              let dist = 0
              const a = targetStem, b = entryStem
              // Simple character diff (not full Levenshtein, but fast)
              const longer = a.length >= b.length ? a : b
              const shorter = a.length < b.length ? a : b
              dist = longer.length - shorter.length
              for (let i = 0; i < shorter.length; i++) {
                if (shorter[i] !== longer[i]) dist++
              }
              if (dist <= Math.ceil(maxLen * 0.2)) {
                matchType = 'similar name'
              }
            }
          }
          // Check file size similarity if we have an estimate
          if (!matchType && estimatedSize > 0) {
            try {
              const stat = fs.statSync(fullPath)
              const sizeDiff = Math.abs(stat.size - estimatedSize) / estimatedSize
              if (sizeDiff <= 0.1) {
                matchType = 'similar size'
              }
            } catch (e) { /* skip */ }
          }
        }

        if (!matchType) continue
        seen.add(fullPath)
        const relativePath = path.relative(rootDir, fullPath)
        let fileSize = null
        try { fileSize = fs.statSync(fullPath).size } catch (e) { /* skip */ }
        results.push({ fullPath, relativePath, root, matchType, fileSize })
      }
    }
    // Sort: exact first, then similar name, then similar size
    const order = { exact: 0, 'similar name': 1, 'similar size': 2 }
    results.sort((a, b) => (order[a.matchType] ?? 9) - (order[b.matchType] ?? 9))
    return results
  })

  ipcMain.handle('db:getWaveforms', async (_event, trackIds) => {
    await ensureInit()
    const result = {}
    for (const trackId of trackIds) {
      try {
        const row = queryOne('SELECT overviewWaveFormData FROM PerformanceData WHERE trackId = ?', [trackId])
        if (row && row.overviewWaveFormData) {
          const bars = processWaveformBlob(row.overviewWaveFormData)
          if (bars) result[trackId] = bars
        }
      } catch (e) { /* PerformanceData table may not exist */ }
    }
    return result
  })

  ipcMain.handle('db:updateTrack', async (_event, trackId, fields) => {
    await ensureInit()
    const d = ensureDb()
    const allowedFields = [
      'title', 'artist', 'album', 'genre', 'bpm', 'bpmAnalyzed', 'key',
      'rating', 'length', 'year', 'label', 'comment', 'composer', 'remixer',
      'filename', 'path', 'bitrate', 'fileType', 'dateAdded', 'timeLastPlayed'
    ]
    const setClauses = []
    const values = []
    for (const [key, val] of Object.entries(fields)) {
      if (allowedFields.includes(key)) {
        setClauses.push(`${key} = ?`)
        values.push(val === '' ? null : val)
      }
    }
    if (!setClauses.length) return { success: false, error: 'No valid fields' }
    values.push(trackId)
    d.run(`UPDATE Track SET ${setClauses.join(', ')} WHERE id = ?`, values)
    saveDatabase()
    return { success: true }
  })
}

module.exports = { registerDatabaseHandlers }

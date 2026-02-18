# Engine DJ Manager

Electron + Vue 3 desktop app to manage Denon Engine DJ SQLite databases (`m.db`).

## Tech Stack
- **Frontend**: Vue 3 (Composition API, `<script setup>`), single-file components
- **Backend**: Electron with `sql.js` (WebAssembly SQLite)
- **Audio**: Custom `local-audio://` protocol for streaming audio files
- **Build**: Vite + electron-builder

## Project Structure
```
electron/
  main.js          — Electron main process, window, protocol, IPC registration
  database.js      — All IPC handlers (db:*, config:*, audio:*)
  preload.js       — contextBridge API exposed to renderer
src/
  App.vue          — Root component, tab navigation (Playlists/Folders), state
  constants.js     — Default config values (drive, folders, tolerance, etc.)
  assets/style.css — All styles (dark theme)
  components/
    Sidebar.vue       — Dual-mode sidebar (playlists tree or folder tree)
    PlaylistTree.vue  — Recursive playlist tree with drag/drop reorder
    FolderTree.vue    — Recursive folder tree for filesystem navigation
    TrackTable.vue    — Full-featured table for playlist tracks (edit, drag, waveforms, broken paths)
    FileTable.vue     — Simplified table for folder files (no DB operations)
    SettingsView.vue  — Config panel (drive, folders, exclude, tolerance)
    StatusBar.vue     — Bottom status bar with DB stats
```

## Key Architecture Decisions
- **Two table components**: `TrackTable` (playlists, DB-backed, full editing) vs `FileTable` (folders, filesystem-only, read-only). Split because behaviors are fundamentally different.
- **IPC serialization**: Vue reactive proxies and sql.js objects can't be structured-cloned. Always cast with `String()`, `Number()`, `.map(String)` before crossing IPC boundary.
- **Filesystem scanning**: `db:scanMusicFolders` scans configured music folders (not DB paths). When no folders configured, scans first-level subdirs of musicDrive to avoid scanning entire drive root.
- **Folder tracks**: `db:getTracksByFolder` lists audio files directly from filesystem with synthetic track objects — no DB query needed.

## Git Workflow
- `develop` — main development branch
- `feature/*` — feature branches merged to develop
- `release/*` — release prep branches merged to both master and develop
- `master` — tagged releases (v0.3.0, v0.4.0, v0.5.0)

## Current State (v0.5.0 + folders view)
- **Branch**: `develop`, 14 commits ahead of origin
- **Latest commit**: `75ac220` — Folders view with tab navigation and FileTable
- Features: playlist management, track editing, drag reorder, audio playback, broken path detection/fix, folder browsing, column customization, waveform preview

## Common Pitfalls
- `Number(0) || DEFAULT` → 0 is falsy, use `val != null ? Number(val) : DEFAULT`
- Always cast IPC data: `String()`, `Number()`, `.map(String)` to avoid structured clone errors
- sql.js query results have non-cloneable properties — extract plain values before IPC return

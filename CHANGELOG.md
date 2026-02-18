# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/), and this project adheres to [Semantic Versioning](https://semver.org/).

## [0.6.0] - 2026-02-18

### Added

- **Folders view** — new tab-based navigation (Playlists / Folders) to browse audio files directly from the filesystem
- **Folder tree navigation** — hierarchical folder tree in the sidebar built from configured music folders, with track counts per folder
- **FileTable component** — dedicated lightweight table for folder files with column sorting, resizing, reorder, visibility toggle, and audio playback
- Folder search filter in sidebar to find folders by name
- "All Tracks" option in folders view to list all files across configured music folders
- Filesystem scanning of configured music folders (reads actual files on disk, not database paths)

### Fixed

- IPC structured clone errors when passing Vue reactive proxy objects (musicFolders, musicDrive) across the IPC bridge

## [0.5.0] - 2026-02-18

### Added

- **Fix broken path** context menu action — right-click a broken (red) track to search configured music folders for the correct file
- Fuzzy file matching — searches by exact filename, similar name (substring/character diff), and similar file size (bitrate × length estimation)
- Fix path results popup with match type badges (exact/similar name/similar size), file sizes, and original estimated size for comparison
- **Exclude folders from search** setting — configure folders to skip when searching for broken track paths (Settings > Audio)
- Always-excluded system folders ($RECYCLE.BIN, System Volume Information) in file search
- **Similar size tolerance** setting — configurable slider (0–10% in 0.5% increments) to control file size matching sensitivity (Settings > Search)

## [0.4.0] - 2026-02-17

### Added

- Broken file path detection — tracks pointing to missing files are highlighted in red
- Bulk file existence check via IPC (`db:checkFilePaths`) that verifies track paths against disk
- Multiple music folders setting — store additional folder locations in Settings > Audio
- Native folder picker dialog for adding music folders
- Music folders are searched in order (music drive first, then additional folders) when resolving file paths

### Fixed

- IPC serialization error (`An object could not be cloned`) when checking file paths — sql.js objects now cast to plain values before crossing the IPC bridge

## [0.3.0] - 2026-02-16

### Added

- Waveform preview in the Preview column rendered from PerformanceData BLOB (low/mid/high frequency bars in blue/cyan/white)
- Play/pause button in the Preview column for inline audio playback
- Music drive / root path setting in Options > Audio (default D:\) for audio file location
- Custom local-audio:// Electron protocol for secure local file streaming (mp3/flac)
- Inline cell editing on double-click for track metadata fields
- Multi-select inline editing — updating a cell applies to all selected rows
- Column reorder by dragging column headers (# column stays fixed)
- Key column sorting by musical note (Camelot wheel order)
- Column order, width, and visibility persistence across app restarts (localStorage)
- Preview column next to # for waveform and playback controls
- Auto-merge of new columns into persisted column settings

## [0.2.0] - 2026-02-16

### Added

- Multi-select tracks with Shift+click (range) and Ctrl+click (toggle)
- Drag & drop multiple selected tracks to playlists in the sidebar
- Remove track from playlist via right-click context menu
- Batch remove multiple selected tracks from a playlist
- Remove track permanently from collection and all playlists ("Remove from Collection")
- Batch remove multiple selected tracks from collection
- Camelot wheel key notation option in Settings > Display
- Rainbow-colored key column based on Camelot wheel numbers (1=red through 12=pink)
- Context menu labels update dynamically to show selection count

## [0.1.0] - 2026-02-16

### Added

- Electron + Vue 3 + Vite desktop application scaffold
- SQLite database access via sql.js (WebAssembly)
- Dark theme UI inspired by Engine DJ
- Top menu bar with Options button for app configuration
- Settings view to configure Engine DJ database path
- Sidebar with hierarchical playlist tree navigation
- Database file selector dropdown (m.db, hm.db, itm.db, rbm.db, sm.db, stm.db, trm.db)
- Collection view showing all tracks in the library
- Playlist search/filter by name
- Track table with sortable columns and horizontal scroll
- Resizable column widths
- Right-click column headers to toggle column visibility
- Track metadata inline editing (title, artist, genre, etc.)
- Track position column based on Engine DJ linked-list order (nextEntityId)
- Create new playlists via "+" button next to Collection
- Delete playlists via right-click context menu
- Rename playlists via right-click context menu with inline editing
- Drag & drop playlist reordering
- Drag & drop playlist nesting (move playlists into other playlists)
- Drag & drop tracks from table to sidebar playlists
- Drag & drop track reordering within playlists (only when sorted by position)
- Track drag reorder disabled in Collection view
- Status bar showing database stats (playlists, tracks, entities)
- README.md with setup and usage instructions
- MIT License

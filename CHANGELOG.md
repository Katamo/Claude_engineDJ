# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/), and this project adheres to [Semantic Versioning](https://semver.org/).

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

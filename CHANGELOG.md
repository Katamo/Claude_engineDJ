# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/), and this project adheres to [Semantic Versioning](https://semver.org/).

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

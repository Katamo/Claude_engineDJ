# Engine DJ Manager

Desktop application to browse and manage Denon Engine DJ SQLite databases. Built with Electron, Vue 3, and sql.js.

## Features

- **Playlist tree navigation** — Hierarchical sidebar with expandable folders
- **Drag & drop playlists** — Reorder and nest playlists by dragging
- **Inline playlist editing** — Rename playlists with double-click or right-click context menu
- **Create & delete playlists** — Add new playlists or remove existing ones
- **Track table** — Sortable, scrollable table with resizable columns
- **Custom column visibility** — Right-click column headers to show/hide columns
- **Column reorder** — Drag column headers to rearrange columns (# column stays fixed)
- **Persistent column settings** — Column order, widths, and visibility are saved across sessions
- **Track ordering** — Respects Engine DJ linked-list track order within playlists
- **Drag tracks to playlists** — Add tracks to playlists by dragging from the table to the sidebar
- **Track drag reorder** — Reorder tracks within a playlist by dragging rows
- **Multi-select tracks** — Shift+click for range select, Ctrl+click to toggle individual tracks
- **Inline track editing** — Double-click any cell to edit track metadata; applies to all selected rows when multi-selected
- **Remove from playlist** — Remove single or multiple selected tracks via right-click context menu
- **Remove from collection** — Permanently delete tracks from the library and all playlists
- **Waveform preview** — Overview waveform rendered from PerformanceData BLOB with low/mid/high frequency coloring
- **Audio playback** — Play/pause button in each track row to preview songs directly in the app
- **Configurable music drive** — Set the root drive/path for audio files in Options > Audio (default D:\)
- **Camelot key notation** — Toggle between standard and Camelot wheel key display with rainbow coloring
- **Key sorting** — Sort by musical key using Camelot wheel order
- **Multi-database support** — Switch between m.db, hm.db, itm.db, and other Engine DJ database files
- **Collection view** — Browse all tracks across the library
- **Search** — Filter playlists by name in real-time
- **Dark theme** — Music app aesthetic inspired by Engine DJ

## Requirements

- [Node.js](https://nodejs.org/) v18 or later
- npm (included with Node.js)

## Setup

```bash
# Clone the repository
git clone https://github.com/Katamo/Claude_engineDJ.git
cd Claude_engineDJ

# Install dependencies
npm install
```

## Usage

### Development mode

```bash
npm run dev
```

This starts Vite (frontend HMR) and Electron concurrently. The app window opens automatically once the dev server is ready.

### Production build

```bash
npm run build
```

Builds the Vue frontend with Vite and packages the Electron app using electron-builder.

## Configuration

On first launch, open **Options** (gear icon in the top menu) to configure:

- **Database folder path** — Path to your Engine DJ `Database2/` folder (e.g. `Engine Library/Database2/`)
- **Music drive / root path** — The drive or root path where your music files are stored (default `D:\`). This is prepended to track file paths for audio playback.
- **Key notation** — Choose between standard (Am, C, F#m) and Camelot wheel (8A, 8B, 11A) display

The default database file is `m.db`. You can switch between database files using the dropdown in the sidebar.

## Database

The app reads Engine DJ SQLite databases (`.db` files) from the `Database2/` folder inside your Engine Library. It supports:

| File | Description |
|------|-------------|
| `m.db` | Main library (playlists, tracks) |
| `hm.db` | History |
| `itm.db` | iTunes import |
| `rbm.db` | Rekordbox import |
| `sm.db` | Streaming |
| `stm.db` | Streaming tracks |
| `trm.db` | Transitions |

## Tech Stack

- **Electron** — Desktop shell
- **Vue 3** — Frontend UI (Composition API, `<script setup>`)
- **Vite** — Build tool with HMR
- **sql.js** — Pure JavaScript SQLite (WebAssembly)

## License

MIT License. See [LICENSE](LICENSE) for details.

# Engine DJ Manager

Desktop application to browse and manage Denon Engine DJ SQLite databases. Built with Electron, Vue 3, and sql.js.

## Features

- **Playlist tree navigation** — Hierarchical sidebar with expandable folders
- **Drag & drop playlists** — Reorder and nest playlists by dragging
- **Inline playlist editing** — Rename playlists with double-click or right-click context menu
- **Create & delete playlists** — Add new playlists or remove existing ones
- **Track table** — Sortable, scrollable table with resizable columns
- **Custom column visibility** — Right-click column headers to show/hide columns
- **Track ordering** — Respects Engine DJ linked-list track order within playlists
- **Drag tracks to playlists** — Add tracks to playlists by dragging from the table to the sidebar
- **Track drag reorder** — Reorder tracks within a playlist by dragging rows
- **Inline track editing** — Right-click any track to edit metadata (title, artist, genre, etc.)
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

On first launch, open **Options** (gear icon in the top menu) to set the path to your Engine DJ database folder:

```
<Engine Library>/Database2/
```

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

<script setup>
import { ref, onMounted } from 'vue'
import Sidebar from './components/Sidebar.vue'
import TrackTable from './components/TrackTable.vue'
import StatusBar from './components/StatusBar.vue'
import SettingsView from './components/SettingsView.vue'

const playlists = ref([])
const databases = ref([])
const currentDb = ref('m.db')
const selectedPlaylist = ref(null)
const tracks = ref([])
const stats = ref(null)
const searchQuery = ref('')
const loading = ref(false)
const showSettings = ref(false)
const keyNotation = ref('standard')
const musicDrive = ref('D:\\')

async function loadData() {
  try {
    const [playlistData, dbData, statsData] = await Promise.all([
      window.api.getPlaylists(),
      window.api.getDatabases(),
      window.api.getStats()
    ])
    playlists.value = playlistData
    databases.value = dbData
    stats.value = statsData
  } catch (err) {
    console.error('Failed to load data:', err)
  }
}

async function selectPlaylist(playlist) {
  selectedPlaylist.value = playlist
  loading.value = true
  try {
    if (playlist.id === -1) {
      tracks.value = await window.api.getAllTracks()
    } else {
      tracks.value = await window.api.getPlaylistTracks(playlist.id)
    }
  } catch (err) {
    console.error('Failed to load tracks:', err)
    tracks.value = []
  } finally {
    loading.value = false
  }
}

async function switchDatabase(dbFile) {
  currentDb.value = dbFile
  selectedPlaylist.value = null
  tracks.value = []
  await window.api.switchDatabase(dbFile)
  await loadData()
}

async function onSearch(query) {
  searchQuery.value = query
}

async function createPlaylist(title) {
  if (!title) return
  try {
    await window.api.createPlaylist(title, 0)
    await loadData()
  } catch (err) {
    console.error('Failed to create playlist:', err)
  }
}

async function deletePlaylist({ id }) {
  try {
    await window.api.deletePlaylist(id)
    if (selectedPlaylist.value?.id === id) {
      selectedPlaylist.value = null
      tracks.value = []
    }
    await loadData()
  } catch (err) {
    console.error('Failed to delete playlist:', err)
  }
}

async function renamePlaylist({ id, title }) {
  try {
    await window.api.renamePlaylist(id, title)
    await loadData()
  } catch (err) {
    console.error('Failed to rename playlist:', err)
  }
}

async function movePlaylist({ playlistId, newParentId }) {
  try {
    await window.api.movePlaylist(playlistId, newParentId)
    await loadData()
  } catch (err) {
    console.error('Failed to move playlist:', err)
  }
}

async function addTrackToPlaylist({ listId, trackId, databaseUuid }) {
  try {
    const result = await window.api.addTrackToPlaylist(listId, trackId, databaseUuid)
    if (!result.success) {
      console.warn('Add track to playlist:', result.error)
    }
    // Refresh if viewing the target playlist
    if (selectedPlaylist.value?.id === listId) {
      await selectPlaylist(selectedPlaylist.value)
    }
  } catch (err) {
    console.error('Failed to add track to playlist:', err)
  }
}

async function reorderPlaylists({ parentListId, orderedIds }) {
  try {
    await window.api.reorderPlaylists(parentListId, orderedIds)
    await loadData()
  } catch (err) {
    console.error('Failed to reorder playlists:', err)
  }
}

async function loadConfig() {
  const config = await window.api.getConfig()
  keyNotation.value = config.keyNotation || 'standard'
  musicDrive.value = config.musicDrive || 'D:\\'
}

async function onConfigChanged() {
  selectedPlaylist.value = null
  tracks.value = []
  currentDb.value = 'm.db'
  await loadConfig()
  await loadData()
}

onMounted(async () => {
  await loadConfig()
  await loadData()
})
</script>

<template>
  <div class="app-root">
    <div class="menu-bar">
      <div class="menu-left">
        <span class="menu-title">Engine DJ Manager</span>
      </div>
      <div class="menu-right">
        <button class="menu-btn" :class="{ active: showSettings }" @click="showSettings = !showSettings">
          <span class="menu-btn-icon">&#9881;</span>
          Options
        </button>
      </div>
    </div>

    <div v-if="showSettings" class="app-body">
      <SettingsView @close="showSettings = false" @config-changed="onConfigChanged" />
    </div>

    <div v-else class="app-body">
      <div class="app-layout">
        <Sidebar
          :playlists="playlists"
          :databases="databases"
          :currentDb="currentDb"
          :selectedPlaylist="selectedPlaylist"
          :searchQuery="searchQuery"
          @select-playlist="selectPlaylist"
          @switch-database="switchDatabase"
          @search="onSearch"
          @create-playlist="createPlaylist"
          @reorder-playlists="reorderPlaylists"
          @rename-playlist="renamePlaylist"
          @move-playlist="movePlaylist"
          @add-track-to-playlist="addTrackToPlaylist"
          @delete-playlist="deletePlaylist"
        />
        <div class="main-content">
          <div v-if="selectedPlaylist" class="content-header">
            <h2>{{ selectedPlaylist.title }}</h2>
            <div class="subtitle">
              {{ tracks.length }} track{{ tracks.length !== 1 ? 's' : '' }}
              &middot; Playlist ID: {{ selectedPlaylist.id }}
            </div>
          </div>
          <div v-else class="content-header">
            <h2>Library</h2>
            <div class="subtitle">Select a playlist from the sidebar to view its tracks</div>
          </div>
          <TrackTable :tracks="tracks" :loading="loading" :hasPlaylist="!!selectedPlaylist" :listId="selectedPlaylist?.id" :keyNotation="keyNotation" :musicDrive="musicDrive" @tracks-updated="selectPlaylist(selectedPlaylist)" />
        </div>
      </div>
    </div>

    <StatusBar :stats="stats" :currentDb="currentDb" />
  </div>
</template>

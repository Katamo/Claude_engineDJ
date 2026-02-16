<script setup>
import { ref, computed, nextTick } from 'vue'
import PlaylistTree from './PlaylistTree.vue'

const props = defineProps({
  playlists: Array,
  databases: Array,
  currentDb: String,
  selectedPlaylist: Object,
  searchQuery: String
})

const emit = defineEmits(['select-playlist', 'switch-database', 'search', 'create-playlist', 'reorder-playlists', 'rename-playlist', 'move-playlist'])

const showNewPlaylist = ref(false)
const newPlaylistName = ref('')
const newPlaylistInput = ref(null)

async function startNewPlaylist() {
  showNewPlaylist.value = true
  newPlaylistName.value = ''
  await nextTick()
  if (newPlaylistInput.value) {
    newPlaylistInput.value.focus()
  }
}

function confirmNewPlaylist() {
  const title = newPlaylistName.value.trim()
  if (title) {
    emit('create-playlist', title)
  }
  showNewPlaylist.value = false
  newPlaylistName.value = ''
}

function cancelNewPlaylist() {
  showNewPlaylist.value = false
  newPlaylistName.value = ''
}

const collectionItem = { id: -1, title: 'Collection', parentListId: -999 }

const filteredPlaylists = computed(() => {
  if (!props.searchQuery) return props.playlists
  const q = props.searchQuery.toLowerCase()
  return props.playlists.filter(p => p.title && p.title.toLowerCase().includes(q))
})

const playlistTree = computed(() => {
  const items = props.searchQuery ? filteredPlaylists.value : props.playlists
  return buildTree(items, 0)
})

function buildTree(items, parentId) {
  const children = items.filter(p => p.parentListId === parentId)
  // Sort by linked-list order using nextListId
  const sorted = []
  const byId = new Map(children.map(c => [c.id, c]))
  // Find the first child (one not referenced as nextListId by any sibling)
  const nextIds = new Set(children.map(c => c.nextListId).filter(id => id > 0))
  let current = children.find(c => !nextIds.has(c.id))
  const visited = new Set()
  while (current && !visited.has(current.id)) {
    visited.add(current.id)
    sorted.push(current)
    current = current.nextListId > 0 ? byId.get(current.nextListId) : null
  }
  // Add any remaining (unlinked) items
  children.forEach(c => { if (!visited.has(c.id)) sorted.push(c) })

  return sorted.map(p => ({
    ...p,
    children: props.searchQuery ? [] : buildTree(items, p.id)
  }))
}

// Count entities per playlist
const entityCounts = computed(() => {
  // We don't have entity counts from the playlist query, so we won't show them
  return {}
})
</script>

<template>
  <div class="sidebar">
    <div class="sidebar-header">
      <select
        class="db-selector"
        :value="currentDb"
        @change="emit('switch-database', $event.target.value)"
      >
        <option v-for="db in databases" :key="db.file" :value="db.file">
          {{ db.file }} ({{ db.playlists }} playlists, {{ db.entities }} entities)
        </option>
      </select>
    </div>
    <div class="sidebar-search">
      <input
        type="text"
        placeholder="Search playlists..."
        :value="searchQuery"
        @input="emit('search', $event.target.value)"
      />
    </div>
    <div class="playlist-tree">
      <div class="collection-row">
        <div
          class="tree-item-row collection-item"
          :class="{ active: selectedPlaylist?.id === -1 }"
          @click="emit('select-playlist', collectionItem)"
        >
          <span class="tree-icon">&#128251;</span>
          <span class="tree-label">Collection</span>
        </div>
        <button class="add-playlist-btn" title="New playlist" @click.stop="startNewPlaylist">+</button>
      </div>
      <div v-if="showNewPlaylist" class="new-playlist-row">
        <input
          ref="newPlaylistInput"
          v-model="newPlaylistName"
          class="rename-input"
          placeholder="New playlist name..."
          @keydown.enter.stop="confirmNewPlaylist"
          @keydown.escape.stop="cancelNewPlaylist"
          @blur="confirmNewPlaylist"
        />
      </div>
      <div class="tree-separator"></div>
      <PlaylistTree
        :items="playlistTree"
        :selectedId="selectedPlaylist?.id"
        :depth="0"
        @select="emit('select-playlist', $event)"
        @reorder="emit('reorder-playlists', $event)"
        @rename="emit('rename-playlist', $event)"
        @move="emit('move-playlist', $event)"
      />
    </div>
  </div>
</template>

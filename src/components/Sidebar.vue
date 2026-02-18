<script setup>
import { ref, computed, nextTick } from 'vue'
import PlaylistTree from './PlaylistTree.vue'
import FolderTree from './FolderTree.vue'

const props = defineProps({
  playlists: Array,
  databases: Array,
  currentDb: String,
  selectedPlaylist: Object,
  searchQuery: String,
  viewMode: { type: String, default: 'playlists' },
  folderPaths: { type: Array, default: () => [] },
  selectedFolder: Object
})

const emit = defineEmits(['select-playlist', 'switch-database', 'search', 'create-playlist', 'reorder-playlists', 'rename-playlist', 'move-playlist', 'add-track-to-playlist', 'delete-playlist', 'select-folder'])

const showNewPlaylist = ref(false)
const newPlaylistName = ref('')
const newPlaylistInput = ref(null)
const folderSearch = ref('')

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
  return {}
})

// --- Folder tree ---
const folderTree = computed(() => {
  const pathData = props.folderPaths || []
  const root = { children: {}, trackCount: 0 }

  for (const item of pathData) {
    const p = typeof item === 'string' ? item : item.path
    const count = typeof item === 'object' ? (item.count || 1) : 1
    // Normalize to forward slashes and split
    const normalized = p.replace(/\\/g, '/')
    const segments = normalized.split('/').filter(s => s)
    let node = root
    let currentPath = ''
    for (let i = 0; i < segments.length; i++) {
      const seg = segments[i]
      // Rebuild path: keep drive letter format on first segment
      if (i === 0) {
        currentPath = seg
      } else {
        currentPath += '/' + seg
      }
      const key = currentPath
      if (!node.children[key]) {
        node.children[key] = { name: seg, path: currentPath, children: {}, trackCount: 0 }
      }
      node = node.children[key]
    }
    // Mark this node as a leaf folder (has tracks)
    node.leafPath = p
    node.trackCount += count
  }

  // Propagate track counts up
  function sumCounts(node) {
    let total = node.trackCount || 0
    for (const child of Object.values(node.children)) {
      total += sumCounts(child)
    }
    node.trackCount = total
    return total
  }
  sumCounts(root)

  // Convert to array format
  function toArray(node) {
    return Object.values(node.children)
      .sort((a, b) => a.name.localeCompare(b.name))
      .map(child => ({
        name: child.name,
        path: child.leafPath || child.path,
        trackCount: child.trackCount,
        children: toArray(child)
      }))
  }

  let tree = toArray(root)

  // Apply search filter
  if (folderSearch.value) {
    const q = folderSearch.value.toLowerCase()
    tree = filterTree(tree, q)
  }

  return tree
})

function filterTree(nodes, query) {
  const result = []
  for (const node of nodes) {
    const nameMatch = node.name.toLowerCase().includes(query)
    const filteredChildren = filterTree(node.children || [], query)
    if (nameMatch || filteredChildren.length > 0) {
      result.push({ ...node, children: nameMatch ? node.children : filteredChildren })
    }
  }
  return result
}

const allTracksItem = { path: '__all__', name: 'All Tracks' }
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

    <!-- Playlists view -->
    <template v-if="viewMode === 'playlists'">
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
          @add-track="emit('add-track-to-playlist', $event)"
          @delete="emit('delete-playlist', $event)"
        />
      </div>
    </template>

    <!-- Folders view -->
    <template v-if="viewMode === 'folders'">
      <div class="sidebar-search">
        <input
          type="text"
          placeholder="Search folders..."
          v-model="folderSearch"
        />
      </div>
      <div class="playlist-tree">
        <div class="collection-row">
          <div
            class="tree-item-row collection-item"
            :class="{ active: selectedFolder?.path === '__all__' }"
            @click="emit('select-folder', allTracksItem)"
          >
            <span class="tree-icon">&#128251;</span>
            <span class="tree-label">All Tracks</span>
          </div>
        </div>
        <div class="tree-separator"></div>
        <FolderTree
          :items="folderTree"
          :selectedPath="selectedFolder?.path"
          :depth="0"
          @select-folder="emit('select-folder', $event)"
        />
      </div>
    </template>
  </div>
</template>

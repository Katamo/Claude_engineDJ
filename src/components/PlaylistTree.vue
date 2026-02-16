<script setup>
import { ref, nextTick, onMounted, onUnmounted } from 'vue'

const props = defineProps({
  items: Array,
  selectedId: Number,
  depth: { type: Number, default: 0 }
})

const emit = defineEmits(['select', 'reorder', 'rename', 'move', 'add-track', 'delete'])

const expandedIds = ref(new Set())
const dragOverId = ref(null)
const dropPosition = ref(null) // 'above', 'below', or 'into'
const draggingId = ref(null)

// Context menu state
const contextMenu = ref(null)
const contextMenuPos = ref({ x: 0, y: 0 })

// Inline rename state
const editingId = ref(null)
const editingTitle = ref('')
const renameInput = ref(null)

function toggle(item) {
  if (expandedIds.value.has(item.id)) {
    expandedIds.value.delete(item.id)
  } else {
    expandedIds.value.add(item.id)
  }
}

function select(item) {
  emit('select', item)
}

function onContextMenu(e, item) {
  e.preventDefault()
  e.stopPropagation()
  contextMenu.value = item
  contextMenuPos.value = { x: e.clientX, y: e.clientY }
}

function closeContextMenu() {
  contextMenu.value = null
}

async function startRename() {
  if (!contextMenu.value) return
  const item = contextMenu.value
  editingId.value = item.id
  editingTitle.value = item.title
  closeContextMenu()
  await nextTick()
  if (renameInput.value) {
    renameInput.value.focus()
    renameInput.value.select()
  }
}

function confirmRename(item) {
  const newTitle = editingTitle.value.trim()
  if (newTitle && newTitle !== item.title) {
    emit('rename', { id: item.id, title: newTitle })
  }
  editingId.value = null
  editingTitle.value = ''
}

function cancelRename() {
  editingId.value = null
  editingTitle.value = ''
}

function deletePlaylist() {
  if (!contextMenu.value) return
  const item = contextMenu.value
  if (confirm(`Delete playlist "${item.title}"?`)) {
    emit('delete', { id: item.id })
  }
  closeContextMenu()
}

function onDocClick(e) {
  closeContextMenu()
  if (editingId.value && renameInput.value && !renameInput.value.contains(e.target)) {
    const item = props.items.find(i => i.id === editingId.value)
    if (item) confirmRename(item)
    else cancelRename()
  }
}

onMounted(() => document.addEventListener('click', onDocClick))
onUnmounted(() => document.removeEventListener('click', onDocClick))

// Drag and drop
function onDragStart(e, item) {
  if (editingId.value) return
  draggingId.value = item.id
  e.dataTransfer.effectAllowed = 'move'
  e.dataTransfer.setData('application/playlist', JSON.stringify({
    id: item.id,
    parentListId: item.parentListId
  }))
}

function isTrackDrag(e) {
  return e.dataTransfer.types.includes('application/track')
}

function onDragOver(e, item) {
  e.preventDefault()
  e.dataTransfer.dropEffect = 'move'
  dragOverId.value = item.id

  if (isTrackDrag(e)) {
    // Track drops always go "into" the playlist
    dropPosition.value = 'into'
    return
  }

  const rect = e.currentTarget.getBoundingClientRect()
  const h = rect.height
  const y = e.clientY - rect.top

  // Top 25% = above, middle 50% = into, bottom 25% = below
  if (y < h * 0.25) {
    dropPosition.value = 'above'
  } else if (y > h * 0.75) {
    dropPosition.value = 'below'
  } else {
    dropPosition.value = 'into'
  }
}

function onDragLeave(e, item) {
  if (dragOverId.value === item.id) {
    dragOverId.value = null
    dropPosition.value = null
  }
}

function onDrop(e, targetItem) {
  e.preventDefault()

  // Handle track drops
  const trackData = e.dataTransfer.getData('application/track')
  if (trackData) {
    const track = JSON.parse(trackData)
    emit('add-track', { listId: targetItem.id, trackId: track.trackId, databaseUuid: track.databaseUuid })
    resetDrag()
    return
  }

  // Handle playlist drops
  const playlistData = e.dataTransfer.getData('application/playlist')
  if (!playlistData) { resetDrag(); return }

  const data = JSON.parse(playlistData)
  const sourceId = data.id

  if (sourceId === targetItem.id) {
    resetDrag()
    return
  }

  const pos = dropPosition.value

  if (pos === 'into') {
    emit('move', { playlistId: sourceId, newParentId: targetItem.id })
  } else if (data.parentListId === targetItem.parentListId) {
    const currentOrder = props.items.map(i => i.id)
    const fromIndex = currentOrder.indexOf(sourceId)
    if (fromIndex === -1) {
      resetDrag()
      return
    }
    currentOrder.splice(fromIndex, 1)
    let toIndex = currentOrder.indexOf(targetItem.id)
    if (pos === 'below') toIndex++
    currentOrder.splice(toIndex, 0, sourceId)
    emit('reorder', { parentListId: targetItem.parentListId, orderedIds: currentOrder })
  } else {
    emit('move', { playlistId: sourceId, newParentId: targetItem.parentListId })
  }

  resetDrag()
}

function resetDrag() {
  dragOverId.value = null
  dropPosition.value = null
  draggingId.value = null
}

function onDragEnd() {
  resetDrag()
}
</script>

<template>
  <div v-for="item in items" :key="item.id" class="tree-item">
    <div
      class="tree-item-row"
      :class="{
        active: selectedId === item.id,
        'pl-drop-above': dragOverId === item.id && dropPosition === 'above',
        'pl-drop-below': dragOverId === item.id && dropPosition === 'below',
        'pl-drop-into': dragOverId === item.id && dropPosition === 'into',
        'pl-dragging': draggingId === item.id
      }"
      :style="{ paddingLeft: (depth * 16 + 12) + 'px' }"
      :draggable="editingId !== item.id"
      @click="select(item)"
      @contextmenu="onContextMenu($event, item)"
      @dragstart="onDragStart($event, item)"
      @dragover="onDragOver($event, item)"
      @dragleave="onDragLeave($event, item)"
      @drop="onDrop($event, item)"
      @dragend="onDragEnd"
    >
      <span
        class="tree-toggle"
        :class="{ expanded: expandedIds.has(item.id), empty: !item.children?.length }"
        @click.stop="toggle(item)"
      >&#9654;</span>
      <span class="tree-icon">{{ item.children?.length ? '&#128193;' : '&#127925;' }}</span>
      <input
        v-if="editingId === item.id"
        ref="renameInput"
        v-model="editingTitle"
        class="rename-input"
        @keydown.enter.stop="confirmRename(item)"
        @keydown.escape.stop="cancelRename"
        @click.stop
      />
      <span v-else class="tree-label" :title="item.title">{{ item.title }}</span>
      <span v-if="item.children?.length && editingId !== item.id" class="tree-count">{{ item.children.length }}</span>
    </div>
    <div v-if="item.children?.length && expandedIds.has(item.id)" class="tree-children">
      <PlaylistTree
        :items="item.children"
        :selectedId="selectedId"
        :depth="depth + 1"
        @select="emit('select', $event)"
        @reorder="emit('reorder', $event)"
        @rename="emit('rename', $event)"
        @move="emit('move', $event)"
        @add-track="emit('add-track', $event)"
        @delete="emit('delete', $event)"
      />
    </div>
  </div>

  <!-- Context Menu -->
  <Teleport to="body">
    <div
      v-if="contextMenu"
      class="playlist-context-menu"
      :style="{ left: contextMenuPos.x + 'px', top: contextMenuPos.y + 'px' }"
      @click.stop
    >
      <div class="context-menu-item" @click="startRename">
        <span class="context-menu-icon">&#9998;</span>
        Rename
      </div>
      <div class="context-menu-item context-menu-delete" @click="deletePlaylist">
        <span class="context-menu-icon">&#128465;</span>
        Delete
      </div>
    </div>
  </Teleport>
</template>

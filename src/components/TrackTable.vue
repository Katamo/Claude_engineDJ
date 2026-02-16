<script setup>
import { ref, reactive, computed, onMounted, onUnmounted } from 'vue'
import EditTrackDialog from './EditTrackDialog.vue'

const props = defineProps({
  tracks: Array,
  loading: Boolean,
  hasPlaylist: Boolean,
  listId: Number
})

const emit = defineEmits(['tracks-updated'])

const sortField = ref(null)
const sortAsc = ref(true)
const contextMenu = ref({ visible: false, x: 0, y: 0 })
const rowContextMenu = ref({ visible: false, x: 0, y: 0, track: null })
const editTrack = ref(null)
const showEditDialog = ref(false)
const scrollContainer = ref(null)

// --- Drag and drop ---
const dragIndex = ref(null)
const dropIndex = ref(null)
const isDragging = ref(false)

const ALL_COLUMNS = [
  { id: 'position',       label: '#',              defaultWidth: 50,   align: 'right', default: true },
  { id: 'trackId',        label: 'Track ID',       defaultWidth: 70,   align: 'left',  default: false },
  { id: 'title',          label: 'Title',          defaultWidth: 280,  align: 'left',  default: true },
  { id: 'artist',         label: 'Artist',         defaultWidth: 200,  align: 'left',  default: true },
  { id: 'album',          label: 'Album',          defaultWidth: 180,  align: 'left',  default: true },
  { id: 'genre',          label: 'Genre',          defaultWidth: 120,  align: 'left',  default: true },
  { id: 'bpm',            label: 'BPM',            defaultWidth: 70,   align: 'right', default: true },
  { id: 'key',            label: 'Key',            defaultWidth: 60,   align: 'left',  default: true },
  { id: 'rating',         label: 'Rating',         defaultWidth: 90,   align: 'left',  default: true },
  { id: 'length',         label: 'Length',          defaultWidth: 70,   align: 'right', default: true },
  { id: 'year',           label: 'Year',           defaultWidth: 60,   align: 'left',  default: false },
  { id: 'label',          label: 'Label',          defaultWidth: 140,  align: 'left',  default: false },
  { id: 'comment',        label: 'Comment',        defaultWidth: 200,  align: 'left',  default: false },
  { id: 'composer',       label: 'Composer',       defaultWidth: 140,  align: 'left',  default: false },
  { id: 'remixer',        label: 'Remixer',        defaultWidth: 140,  align: 'left',  default: false },
  { id: 'filename',       label: 'Filename',       defaultWidth: 220,  align: 'left',  default: false },
  { id: 'filePath',       label: 'File Path',      defaultWidth: 350,  align: 'left',  default: false },
  { id: 'bitrate',        label: 'Bitrate',        defaultWidth: 80,   align: 'right', default: false },
  { id: 'fileType',       label: 'Type',           defaultWidth: 60,   align: 'left',  default: false },
  { id: 'dateAdded',      label: 'Date Added',     defaultWidth: 150,  align: 'left',  default: false },
  { id: 'timeLastPlayed', label: 'Last Played',    defaultWidth: 150,  align: 'left',  default: false },
  { id: 'databaseUuid',   label: 'Database UUID',  defaultWidth: 260,  align: 'left',  default: false },
  { id: 'entityId',       label: 'Entity ID',      defaultWidth: 70,   align: 'left',  default: false },
]

const visibleColumnIds = ref(new Set(ALL_COLUMNS.filter(c => c.default).map(c => c.id)))
const columnWidths = reactive(Object.fromEntries(ALL_COLUMNS.map(c => [c.id, c.defaultWidth])))

const visibleColumns = computed(() => ALL_COLUMNS.filter(c => visibleColumnIds.value.has(c.id)))
const totalWidth = computed(() => visibleColumns.value.reduce((sum, c) => sum + columnWidths[c.id], 0))

const KEY_MAP = {
  0: '', 1: 'Am', 2: 'Bm', 3: 'Dbm', 4: 'Ebm', 5: 'Fm', 6: 'Gm',
  7: 'Abm', 8: 'Bbm', 9: 'Cm', 10: 'Dm', 11: 'Em', 12: 'F#m',
  13: 'C', 14: 'D', 15: 'E', 16: 'Gb', 17: 'Ab', 18: 'Bb',
  19: 'F', 20: 'G', 21: 'A', 22: 'B', 23: 'Db', 24: 'Eb'
}

function formatCell(track, colId, index) {
  const val = track[colId]
  switch (colId) {
    case 'position':
      return index + 1
    case 'trackId':
    case 'entityId':
      return val ?? ''
    case 'title':
      return val || track.filename || `Track ${track.trackId}`
    case 'bpm':
      if (track.bpmAnalyzed) return track.bpmAnalyzed.toFixed(1)
      if (val) return (val / 100).toFixed(1)
      return ''
    case 'key':
      return KEY_MAP[val] || ''
    case 'rating':
      if (!val) return ''
      const stars = Math.round(val / 20)
      return '\u2605'.repeat(stars) + '\u2606'.repeat(5 - stars)
    case 'length':
      if (!val) return ''
      return `${Math.floor(val / 60)}:${String(val % 60).padStart(2, '0')}`
    case 'bitrate':
      return val ? `${val} kbps` : ''
    default:
      return val ?? ''
  }
}

// Resolve linked-list order using nextEntityId
const linkedListTracks = computed(() => {
  const tracks = props.tracks
  if (!tracks.length) return []
  // Check if tracks have nextEntityId (playlist context)
  const hasLinkedList = tracks.some(t => t.nextEntityId !== undefined && t.nextEntityId !== null)
  if (!hasLinkedList) return tracks

  const byId = new Map(tracks.map(t => [t.entityId, t]))
  const nextIds = new Set(tracks.map(t => t.nextEntityId).filter(id => id > 0))
  // First item is the one not referenced by any other's nextEntityId
  let current = tracks.find(t => !nextIds.has(t.entityId))
  const sorted = []
  const visited = new Set()
  while (current && !visited.has(current.entityId)) {
    visited.add(current.entityId)
    sorted.push(current)
    current = current.nextEntityId > 0 ? byId.get(current.nextEntityId) : null
  }
  // Add any unlinked tracks at the end
  tracks.forEach(t => { if (!visited.has(t.entityId)) sorted.push(t) })
  return sorted
})

const sortedTracks = computed(() => {
  if (!sortField.value) return linkedListTracks.value
  const field = sortField.value
  const dir = sortAsc.value ? 1 : -1
  return [...linkedListTracks.value].sort((a, b) => {
    const va = a[field] ?? ''
    const vb = b[field] ?? ''
    if (typeof va === 'number' && typeof vb === 'number') return (va - vb) * dir
    return String(va).localeCompare(String(vb)) * dir
  })
})

// Drag reorder is only available when no custom sort is active
// Drag reorder only when in default position order (no sort or sorted by position asc)
const canDrag = computed(() => !sortField.value || (sortField.value === 'position' && sortAsc.value))

function toggleSort(field) {
  if (sortField.value === field) {
    sortAsc.value = !sortAsc.value
  } else {
    sortField.value = field
    sortAsc.value = true
  }
}

function sortIndicator(field) {
  if (sortField.value !== field) return ''
  return sortAsc.value ? ' \u25B2' : ' \u25BC'
}

function onHeaderContextMenu(e) {
  e.preventDefault()
  contextMenu.value = { visible: true, x: e.clientX, y: e.clientY }
}

function toggleColumn(colId) {
  if (visibleColumnIds.value.has(colId)) {
    if (visibleColumnIds.value.size > 1) {
      visibleColumnIds.value.delete(colId)
    }
  } else {
    visibleColumnIds.value.add(colId)
  }
}

function closeContextMenu() {
  contextMenu.value.visible = false
}

function onRowContextMenu(e, track) {
  e.preventDefault()
  closeContextMenu()
  rowContextMenu.value = { visible: true, x: e.clientX, y: e.clientY, track }
}

function closeRowContextMenu() {
  rowContextMenu.value.visible = false
}

function openEditDialog() {
  editTrack.value = rowContextMenu.value.track
  showEditDialog.value = true
  closeRowContextMenu()
}

function onEditSaved() {
  showEditDialog.value = false
  editTrack.value = null
  emit('tracks-updated')
}

function onDocClick(e) {
  if (contextMenu.value.visible) {
    const menu = document.querySelector('.column-context-menu')
    if (menu && !menu.contains(e.target)) {
      closeContextMenu()
    }
  }
  if (rowContextMenu.value.visible) {
    const menu = document.querySelector('.row-context-menu')
    if (menu && !menu.contains(e.target)) {
      closeRowContextMenu()
    }
  }
}

// --- Column resize ---
let resizeState = null

function onResizeStart(e, colId) {
  e.preventDefault()
  e.stopPropagation()
  const startX = e.clientX
  const startWidth = columnWidths[colId]
  resizeState = { colId, startX, startWidth }
  document.addEventListener('mousemove', onResizeMove)
  document.addEventListener('mouseup', onResizeEnd)
  document.body.style.cursor = 'col-resize'
  document.body.style.userSelect = 'none'
}

function onResizeMove(e) {
  if (!resizeState) return
  const delta = e.clientX - resizeState.startX
  const newWidth = Math.max(40, resizeState.startWidth + delta)
  columnWidths[resizeState.colId] = newWidth
}

function onResizeEnd() {
  resizeState = null
  document.removeEventListener('mousemove', onResizeMove)
  document.removeEventListener('mouseup', onResizeEnd)
  document.body.style.cursor = ''
  document.body.style.userSelect = ''
}

// --- Drag and drop reorder ---
function onDragStart(e, index) {
  if (!canDrag.value) {
    e.preventDefault()
    return
  }
  isDragging.value = true
  dragIndex.value = index
  e.dataTransfer.effectAllowed = 'move'
  e.dataTransfer.setData('text/plain', String(index))
  // Make the drag image semi-transparent
  if (e.target) {
    e.target.style.opacity = '0.4'
  }
}

function onDragEnd(e) {
  isDragging.value = false
  dragIndex.value = null
  dropIndex.value = null
  if (e.target) {
    e.target.style.opacity = ''
  }
}

function onDragOver(e, index) {
  e.preventDefault()
  e.dataTransfer.dropEffect = 'move'
  dropIndex.value = index
}

function onDragLeave() {
  // Don't clear dropIndex here to avoid flicker
}

async function onDrop(e, toIndex) {
  e.preventDefault()
  const fromIndex = dragIndex.value
  isDragging.value = false
  dragIndex.value = null
  dropIndex.value = null

  if (fromIndex === null || fromIndex === toIndex) return

  // Build new order
  const list = [...sortedTracks.value]
  const [moved] = list.splice(fromIndex, 1)
  list.splice(toIndex, 0, moved)

  // Get the new entity ID order
  const orderedEntityIds = list.map(t => t.entityId)

  try {
    await window.api.reorderPlaylistEntities(props.listId, orderedEntityIds)
    emit('tracks-updated')
  } catch (err) {
    console.error('Failed to reorder:', err)
  }
}

function dropClass(index) {
  if (!isDragging.value || dropIndex.value === null) return ''
  if (index === dropIndex.value && index !== dragIndex.value) {
    return dragIndex.value < dropIndex.value ? 'drop-below' : 'drop-above'
  }
  return ''
}

onMounted(() => document.addEventListener('mousedown', onDocClick))
onUnmounted(() => {
  document.removeEventListener('mousedown', onDocClick)
  document.removeEventListener('mousemove', onResizeMove)
  document.removeEventListener('mouseup', onResizeEnd)
})
</script>

<template>
  <div v-if="loading" class="loading">Loading tracks...</div>
  <div v-else-if="!hasPlaylist" class="empty-state">
    <div class="icon">&#127911;</div>
    <p>Select a playlist to view its tracks</p>
  </div>
  <div v-else-if="!tracks.length" class="empty-state">
    <div class="icon">&#128247;</div>
    <p>No tracks in this playlist</p>
  </div>
  <div v-else class="track-table-container" ref="scrollContainer">
    <div class="track-table-scroll">
      <div class="track-table-head" :style="{ width: totalWidth + 'px' }" @contextmenu="onHeaderContextMenu">
        <div
          v-for="col in visibleColumns"
          :key="col.id"
          class="track-th"
          :class="{ sorted: sortField === col.id }"
          :style="{ width: columnWidths[col.id] + 'px', textAlign: col.align }"
          @click="toggleSort(col.id)"
        >
          <span class="th-label">{{ col.label }}{{ sortIndicator(col.id) }}</span>
          <span class="resize-handle" @mousedown="onResizeStart($event, col.id)"></span>
        </div>
      </div>
      <div class="track-table-body">
        <div
          v-for="(track, index) in sortedTracks"
          :key="track.entityId"
          class="track-row"
          :class="[
            dropClass(index),
            { dragging: dragIndex === index, 'drag-enabled': canDrag }
          ]"
          :style="{ width: totalWidth + 'px' }"
          :draggable="canDrag"
          @dragstart="onDragStart($event, index)"
          @dragend="onDragEnd"
          @dragover="onDragOver($event, index)"
          @dragleave="onDragLeave"
          @drop="onDrop($event, index)"
          @contextmenu="onRowContextMenu($event, track)"
        >
          <div
            v-if="canDrag"
            class="drag-handle"
          >&#8942;&#8942;</div>
          <div
            v-for="col in visibleColumns"
            :key="col.id"
            class="track-td"
            :style="{ width: columnWidths[col.id] + 'px', textAlign: col.align }"
            :title="String(formatCell(track, col.id, index))"
          >
            {{ formatCell(track, col.id, index) }}
          </div>
        </div>
      </div>
    </div>

    <!-- Column visibility context menu -->
    <Teleport to="body">
      <div
        v-if="contextMenu.visible"
        class="column-context-menu"
        :style="{ left: contextMenu.x + 'px', top: contextMenu.y + 'px' }"
      >
        <div class="context-menu-title">Columns</div>
        <div
          v-for="col in ALL_COLUMNS"
          :key="col.id"
          class="context-menu-item"
          @click="toggleColumn(col.id)"
        >
          <span class="context-check">{{ visibleColumnIds.has(col.id) ? '\u2713' : '' }}</span>
          <span>{{ col.label }}</span>
        </div>
      </div>
    </Teleport>

    <!-- Row context menu -->
    <Teleport to="body">
      <div
        v-if="rowContextMenu.visible"
        class="row-context-menu"
        :style="{ left: rowContextMenu.x + 'px', top: rowContextMenu.y + 'px' }"
      >
        <div class="context-menu-item" @click="openEditDialog">
          <span class="context-menu-icon">&#9998;</span>
          <span>Edit Track</span>
        </div>
      </div>
    </Teleport>

    <!-- Edit dialog -->
    <EditTrackDialog
      :track="editTrack"
      :visible="showEditDialog"
      @close="showEditDialog = false"
      @save="onEditSaved"
    />
  </div>
</template>

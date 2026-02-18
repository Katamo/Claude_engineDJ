<script setup>
import { ref, reactive, computed, onMounted, onUnmounted } from 'vue'

const props = defineProps({
  tracks: Array,
  loading: Boolean,
  hasFolder: Boolean
})

const sortField = ref(null)
const sortAsc = ref(true)
const contextMenu = ref({ visible: false, x: 0, y: 0 })
const scrollContainer = ref(null)

// --- Multi-select ---
const selectedTrackIds = ref(new Set())
const lastClickedIndex = ref(null)

function onRowClick(e, track, index) {
  if (e.ctrlKey || e.metaKey) {
    if (selectedTrackIds.value.has(track.trackId)) {
      selectedTrackIds.value.delete(track.trackId)
    } else {
      selectedTrackIds.value.add(track.trackId)
    }
    lastClickedIndex.value = index
  } else if (e.shiftKey && lastClickedIndex.value !== null) {
    const from = Math.min(lastClickedIndex.value, index)
    const to = Math.max(lastClickedIndex.value, index)
    const newSet = new Set(selectedTrackIds.value)
    for (let i = from; i <= to; i++) {
      const t = sortedTracks.value[i]
      if (t) newSet.add(t.trackId)
    }
    selectedTrackIds.value = newSet
  } else {
    selectedTrackIds.value = new Set([track.trackId])
    lastClickedIndex.value = index
  }
}

function isSelected(track) {
  return selectedTrackIds.value.has(track.trackId)
}

// --- Audio Play/Pause ---
const playingTrackId = ref(null)
let audioElement = null

function togglePlay(track) {
  if (playingTrackId.value === track.trackId) {
    if (audioElement) {
      audioElement.pause()
      audioElement.src = ''
      audioElement = null
    }
    playingTrackId.value = null
  } else {
    if (audioElement) {
      audioElement.pause()
      audioElement.src = ''
    }
    // filePath is absolute path from filesystem scan
    const filePath = (track.filePath || '').replace(/\\/g, '/')
    const filename = track.filename || ''
    let fullPath = filePath
    if (!fullPath.endsWith('/')) fullPath += '/'
    fullPath += filename
    const audioUrl = 'local-audio://play/' + encodeURI(fullPath).replace(/#/g, '%23')
    audioElement = new Audio(audioUrl)
    audioElement.addEventListener('ended', () => {
      playingTrackId.value = null
      audioElement = null
    })
    audioElement.addEventListener('error', () => {
      playingTrackId.value = null
      audioElement = null
    })
    audioElement.play().catch(() => {})
    playingTrackId.value = track.trackId
  }
}

onUnmounted(() => {
  if (audioElement) {
    audioElement.pause()
    audioElement.src = ''
    audioElement = null
  }
})

// --- Columns ---
const ALL_COLUMNS = [
  { id: 'index',     label: '#',         defaultWidth: 50,  align: 'right', default: true },
  { id: 'play',      label: '',          defaultWidth: 40,  align: 'center', default: true },
  { id: 'title',     label: 'Title',     defaultWidth: 300, align: 'left',  default: true },
  { id: 'filename',  label: 'Filename',  defaultWidth: 280, align: 'left',  default: false },
  { id: 'fileType',  label: 'Type',      defaultWidth: 60,  align: 'left',  default: true },
  { id: 'fileSize',  label: 'Size',      defaultWidth: 90,  align: 'right', default: true },
  { id: 'filePath',  label: 'Path',      defaultWidth: 350, align: 'left',  default: false },
]

// --- Persist column settings ---
const STORAGE_KEY = 'fileTableColumns'

function loadColumnSettings() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved) return JSON.parse(saved)
  } catch (e) { /* ignore */ }
  return null
}

function saveColumnSettings() {
  const data = {
    visible: [...visibleColumnIds.value],
    widths: { ...columnWidths },
    order: columnOrder.value
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
}

const saved = loadColumnSettings()
const allIds = ALL_COLUMNS.map(c => c.id)
const defaultVisible = ALL_COLUMNS.filter(c => c.default).map(c => c.id)
const defaultWidths = Object.fromEntries(ALL_COLUMNS.map(c => [c.id, c.defaultWidth]))

let initVisible, initWidths, initOrder
if (saved) {
  const savedSet = new Set(saved.visible || [])
  for (const col of ALL_COLUMNS) {
    if (col.default && !savedSet.has(col.id) && !(saved.order || []).includes(col.id)) {
      savedSet.add(col.id)
    }
  }
  initVisible = savedSet
  initWidths = { ...defaultWidths, ...(saved.widths || {}) }
  const savedOrder = saved.order || []
  const savedOrderSet = new Set(savedOrder)
  const merged = [...savedOrder]
  for (let i = 0; i < allIds.length; i++) {
    if (!savedOrderSet.has(allIds[i])) {
      const insertAt = Math.min(i, merged.length)
      merged.splice(insertAt, 0, allIds[i])
    }
  }
  initOrder = merged
} else {
  initVisible = new Set(defaultVisible)
  initWidths = defaultWidths
  initOrder = allIds
}

const visibleColumnIds = ref(initVisible instanceof Set ? initVisible : new Set(initVisible))
const columnWidths = reactive(initWidths)
const columnOrder = ref(initOrder)

const visibleColumns = computed(() => {
  const colMap = new Map(ALL_COLUMNS.map(c => [c.id, c]))
  return columnOrder.value.filter(id => visibleColumnIds.value.has(id)).map(id => colMap.get(id))
})
const totalWidth = computed(() => visibleColumns.value.reduce((sum, c) => sum + columnWidths[c.id], 0))

// --- Column drag reorder ---
const dragColId = ref(null)
const dropColId = ref(null)

function onColDragStart(e, colId) {
  if (colId === 'index' || colId === 'play') { e.preventDefault(); return }
  dragColId.value = colId
  e.dataTransfer.effectAllowed = 'move'
  e.dataTransfer.setData('application/column', colId)
}

function onColDragOver(e, colId) {
  if (colId === 'index' || colId === 'play') return
  if (!dragColId.value || dragColId.value === colId) return
  e.preventDefault()
  e.dataTransfer.dropEffect = 'move'
  dropColId.value = colId
}

function onColDragLeave(e, colId) {
  if (dropColId.value === colId) dropColId.value = null
}

function onColDrop(e, colId) {
  e.preventDefault()
  if (!dragColId.value || dragColId.value === colId) { resetColDrag(); return }
  const order = [...columnOrder.value]
  const fromIdx = order.indexOf(dragColId.value)
  const toIdx = order.indexOf(colId)
  if (fromIdx === -1 || toIdx === -1) { resetColDrag(); return }
  order.splice(fromIdx, 1)
  order.splice(toIdx, 0, dragColId.value)
  columnOrder.value = order
  saveColumnSettings()
  resetColDrag()
}

function onColDragEnd() { resetColDrag() }
function resetColDrag() { dragColId.value = null; dropColId.value = null }

// --- Sorting ---
const sortedTracks = computed(() => {
  const tracks = props.tracks || []
  if (!sortField.value) return tracks
  const field = sortField.value
  const dir = sortAsc.value ? 1 : -1
  return [...tracks].sort((a, b) => {
    let va, vb
    if (field === 'index') {
      return 0 // keep original order
    }
    va = a[field] ?? ''
    vb = b[field] ?? ''
    if (typeof va === 'number' && typeof vb === 'number') return (va - vb) * dir
    return String(va).localeCompare(String(vb)) * dir
  })
})

function toggleSort(field) {
  if (field === 'play') return
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

function formatFileSize(bytes) {
  if (!bytes) return ''
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
}

function formatCell(track, colId, index) {
  switch (colId) {
    case 'index': return index + 1
    case 'play': return ''
    case 'title': return track.title || track.filename || ''
    case 'fileSize': return formatFileSize(track.fileSize)
    case 'fileType': return track.fileType || ''
    default: return track[colId] ?? ''
  }
}

// --- Header context menu ---
function onHeaderContextMenu(e) {
  e.preventDefault()
  contextMenu.value = { visible: true, x: e.clientX, y: e.clientY }
}

function toggleColumn(colId) {
  if (visibleColumnIds.value.has(colId)) {
    if (visibleColumnIds.value.size > 1) visibleColumnIds.value.delete(colId)
  } else {
    visibleColumnIds.value.add(colId)
  }
  saveColumnSettings()
}

function closeContextMenu() {
  contextMenu.value.visible = false
}

function onDocClick(e) {
  if (contextMenu.value.visible) {
    const menu = document.querySelector('.column-context-menu')
    if (menu && !menu.contains(e.target)) closeContextMenu()
  }
}

// --- Column resize ---
let resizeState = null

function onResizeStart(e, colId) {
  e.preventDefault()
  e.stopPropagation()
  resizeState = { colId, startX: e.clientX, startWidth: columnWidths[colId] }
  document.addEventListener('mousemove', onResizeMove)
  document.addEventListener('mouseup', onResizeEnd)
  document.body.style.cursor = 'col-resize'
  document.body.style.userSelect = 'none'
}

function onResizeMove(e) {
  if (!resizeState) return
  const delta = e.clientX - resizeState.startX
  columnWidths[resizeState.colId] = Math.max(40, resizeState.startWidth + delta)
}

function onResizeEnd() {
  resizeState = null
  document.removeEventListener('mousemove', onResizeMove)
  document.removeEventListener('mouseup', onResizeEnd)
  document.body.style.cursor = ''
  document.body.style.userSelect = ''
  saveColumnSettings()
}

onMounted(() => document.addEventListener('mousedown', onDocClick))
onUnmounted(() => {
  document.removeEventListener('mousedown', onDocClick)
  document.removeEventListener('mousemove', onResizeMove)
  document.removeEventListener('mouseup', onResizeEnd)
})
</script>

<template>
  <div v-if="loading" class="loading">Loading files...</div>
  <div v-else-if="!hasFolder" class="empty-state">
    <div class="icon">&#128193;</div>
    <p>Select a folder to view its files</p>
  </div>
  <div v-else-if="!tracks.length" class="empty-state">
    <div class="icon">&#128247;</div>
    <p>No audio files in this folder</p>
  </div>
  <div v-else class="track-table-container" ref="scrollContainer">
    <div class="track-table-scroll">
      <div class="track-table-head" :style="{ width: totalWidth + 'px' }" @contextmenu="onHeaderContextMenu">
        <div
          v-for="col in visibleColumns"
          :key="col.id"
          class="track-th"
          :class="{ sorted: sortField === col.id, 'col-drop-target': dropColId === col.id, 'col-dragging': dragColId === col.id }"
          :style="{ width: columnWidths[col.id] + 'px', textAlign: col.align }"
          :draggable="col.id !== 'index' && col.id !== 'play'"
          @click="toggleSort(col.id)"
          @dragstart="onColDragStart($event, col.id)"
          @dragover="onColDragOver($event, col.id)"
          @dragleave="onColDragLeave($event, col.id)"
          @drop="onColDrop($event, col.id)"
          @dragend="onColDragEnd"
        >
          <span class="th-label">{{ col.label }}{{ sortIndicator(col.id) }}</span>
          <span class="resize-handle" @mousedown="onResizeStart($event, col.id)"></span>
        </div>
      </div>
      <div class="track-table-body">
        <div
          v-for="(track, index) in sortedTracks"
          :key="track.trackId"
          class="track-row"
          :class="{ selected: isSelected(track) }"
          :style="{ width: totalWidth + 'px' }"
          @click="onRowClick($event, track, index)"
        >
          <div
            v-for="col in visibleColumns"
            :key="col.id"
            class="track-td"
            :style="{ width: columnWidths[col.id] + 'px', textAlign: col.align }"
            :title="String(formatCell(track, col.id, index))"
          >
            <button
              v-if="col.id === 'play'"
              class="play-btn"
              @click.stop="togglePlay(track)"
              :title="playingTrackId === track.trackId ? 'Pause' : 'Play'"
            >{{ playingTrackId === track.trackId ? '&#9646;&#9646;' : '&#9654;' }}</button>
            <template v-else>{{ formatCell(track, col.id, index) }}</template>
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
          <span>{{ col.label || col.id }}</span>
        </div>
      </div>
    </Teleport>
  </div>
</template>

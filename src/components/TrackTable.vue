<script setup>
import { ref, reactive, computed, nextTick, watch, onMounted, onUnmounted } from 'vue'
import EditTrackDialog from './EditTrackDialog.vue'
import WaveformPreview from './WaveformPreview.vue'
import { DEFAULT_MUSIC_DRIVE, DEFAULT_KEY_NOTATION, KEY_NOTATION_CAMELOT } from '../constants'

const props = defineProps({
  tracks: Array,
  loading: Boolean,
  hasPlaylist: Boolean,
  listId: Number,
  keyNotation: { type: String, default: DEFAULT_KEY_NOTATION },
  musicDrive: { type: String, default: DEFAULT_MUSIC_DRIVE }
})

const emit = defineEmits(['tracks-updated'])

const sortField = ref(null)
const sortAsc = ref(true)
const contextMenu = ref({ visible: false, x: 0, y: 0 })
const rowContextMenu = ref({ visible: false, x: 0, y: 0, track: null })

// --- Inline cell editing ---
const editingCell = ref(null) // { trackId, colId }
const editingValue = ref('')
const cellInput = ref(null)

const NON_EDITABLE = new Set(['position', 'preview', 'trackId', 'entityId', 'databaseUuid'])

// Map column IDs to DB field names
const COL_TO_DB_FIELD = { filePath: 'path' }

function onCellDblClick(track, colId) {
  if (NON_EDITABLE.has(colId)) return
  editingCell.value = { trackId: track.trackId, entityId: track.entityId, colId }
  // Get the raw value for editing, not the formatted one
  if (colId === 'key') {
    editingValue.value = String(track.key ?? '')
  } else if (colId === 'bpm') {
    editingValue.value = String(track.bpmAnalyzed ?? (track.bpm ? (track.bpm / 100).toFixed(1) : ''))
  } else if (colId === 'rating') {
    editingValue.value = String(track.rating ?? '')
  } else if (colId === 'length') {
    editingValue.value = String(track.length ?? '')
  } else {
    editingValue.value = String(track[colId] ?? '')
  }
  nextTick(() => {
    if (cellInput.value) {
      cellInput.value.focus()
      cellInput.value.select()
    }
  })
}

function isEditingCell(track, colId) {
  return editingCell.value?.trackId === track.trackId && editingCell.value?.colId === colId
}

async function confirmCellEdit(track) {
  if (!editingCell.value) return
  const colId = editingCell.value.colId
  const newVal = editingValue.value.trim()
  editingCell.value = null
  editingValue.value = ''

  // Determine the DB field name
  const dbField = COL_TO_DB_FIELD[colId] || colId

  // Build the fields object
  let fields
  if (colId === 'bpm') {
    fields = { bpm: newVal ? Math.round(parseFloat(newVal) * 100) : null, bpmAnalyzed: newVal ? parseFloat(newVal) : null }
  } else if (colId === 'rating' || colId === 'length' || colId === 'year' || colId === 'bitrate' || colId === 'key') {
    fields = { [dbField]: newVal ? Number(newVal) : null }
  } else {
    fields = { [dbField]: newVal }
  }

  // Determine which tracks to update
  const trackKey = track.entityId || track.trackId
  const updateSelected = selectedTrackIds.value.has(trackKey) && selectedTrackIds.value.size > 1
  const trackIds = updateSelected
    ? sortedTracks.value
        .filter(t => selectedTrackIds.value.has(t.entityId || t.trackId))
        .map(t => t.trackId)
        .filter(id => id != null)
    : [track.trackId]

  try {
    for (const id of trackIds) {
      await window.api.updateTrack(id, fields)
    }
    emit('tracks-updated')
  } catch (err) {
    console.error('Failed to update track(s):', err)
  }
}

function cancelCellEdit() {
  editingCell.value = null
  editingValue.value = ''
}
const editTrack = ref(null)
const showEditDialog = ref(false)
const scrollContainer = ref(null)

// --- Multi-select ---
const selectedTrackIds = ref(new Set())
const lastClickedIndex = ref(null)

function onRowClick(e, track, index) {
  if (e.ctrlKey || e.metaKey) {
    // Toggle individual track
    if (selectedTrackIds.value.has(track.entityId || track.trackId)) {
      selectedTrackIds.value.delete(track.entityId || track.trackId)
    } else {
      selectedTrackIds.value.add(track.entityId || track.trackId)
    }
    lastClickedIndex.value = index
  } else if (e.shiftKey && lastClickedIndex.value !== null) {
    // Range select
    const from = Math.min(lastClickedIndex.value, index)
    const to = Math.max(lastClickedIndex.value, index)
    const newSet = new Set(selectedTrackIds.value)
    for (let i = from; i <= to; i++) {
      const t = sortedTracks.value[i]
      if (t) newSet.add(t.entityId || t.trackId)
    }
    selectedTrackIds.value = newSet
  } else {
    // Single click — select only this track
    selectedTrackIds.value = new Set([track.entityId || track.trackId])
    lastClickedIndex.value = index
  }
}

function isSelected(track) {
  return selectedTrackIds.value.has(track.entityId || track.trackId)
}

// --- Audio Play/Pause ---
const playingTrackId = ref(null)
let audioElement = null

function buildTrackPath(track) {
  let filePath = track.filePath || track.path || ''
  if (!filePath) return null
  // Normalize separators to forward slashes
  filePath = filePath.replace(/\\/g, '/')
  // Strip leading ../ segments — the music drive is already the resolved root
  while (filePath.startsWith('../')) filePath = filePath.substring(3)
  while (filePath.startsWith('./')) filePath = filePath.substring(2)
  let drive = (props.musicDrive || DEFAULT_MUSIC_DRIVE).replace(/\\/g, '/')
  // Ensure drive ends with /
  if (!drive.endsWith('/')) drive += '/'
  return drive + filePath
}

function togglePlay(track) {
  if (playingTrackId.value === track.trackId) {
    // Stop current playback
    if (audioElement) {
      audioElement.pause()
      audioElement.src = ''
      audioElement = null
    }
    playingTrackId.value = null
  } else {
    // Stop previous if any
    if (audioElement) {
      audioElement.pause()
      audioElement.src = ''
    }
    const filePath = buildTrackPath(track)
    if (!filePath) return
    // Use custom protocol: local-audio://play/D:/path/to/file.mp3
    const audioUrl = 'local-audio://play/' + encodeURI(filePath).replace(/#/g, '%23')
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

// --- Waveform data ---
const waveformData = ref(0)
const waveformCache = {}

function getWaveform(trackId) {
  return waveformCache[trackId] || null
}

async function fetchWaveforms() {
  if (!props.tracks || !props.tracks.length) return
  const trackIds = [...new Set(props.tracks.map(t => t.trackId).filter(id => id != null))]
  if (!trackIds.length) return
  try {
    const data = await window.api.getWaveforms(trackIds)
    if (data) {
      for (const [key, val] of Object.entries(data)) {
        waveformCache[key] = val
      }
      waveformData.value++ // trigger reactivity
    }
  } catch (e) {
    // ignore
  }
}

watch(() => props.tracks, fetchWaveforms, { immediate: true })

// --- Drag and drop ---
const dragIndex = ref(null)
const dropIndex = ref(null)
const isDragging = ref(false)

const ALL_COLUMNS = [
  { id: 'position',       label: '#',              defaultWidth: 50,   align: 'right', default: true },
  { id: 'preview',        label: 'Preview',        defaultWidth: 120,  align: 'center', default: true },
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

// --- Persist column settings ---
const STORAGE_KEY = 'trackTableColumns'

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

// Merge saved settings with any new columns added since last save
const allIds = ALL_COLUMNS.map(c => c.id)
const defaultVisible = ALL_COLUMNS.filter(c => c.default).map(c => c.id)
const defaultWidths = Object.fromEntries(ALL_COLUMNS.map(c => [c.id, c.defaultWidth]))

let initVisible, initWidths, initOrder
if (saved) {
  // Add any new default columns not present in saved visibility
  const savedSet = new Set(saved.visible || [])
  for (const col of ALL_COLUMNS) {
    if (col.default && !savedSet.has(col.id) && !(saved.order || []).includes(col.id)) {
      savedSet.add(col.id)
    }
  }
  initVisible = savedSet

  // Merge widths: use saved if available, else default
  initWidths = { ...defaultWidths, ...(saved.widths || {}) }

  // Merge order: add any missing columns at their natural position
  const savedOrder = saved.order || []
  const savedOrderSet = new Set(savedOrder)
  const merged = [...savedOrder]
  for (let i = 0; i < allIds.length; i++) {
    if (!savedOrderSet.has(allIds[i])) {
      // Insert at the same relative position as in ALL_COLUMNS
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
  if (colId === 'position') { e.preventDefault(); return }
  dragColId.value = colId
  e.dataTransfer.effectAllowed = 'move'
  e.dataTransfer.setData('application/column', colId)
}

function onColDragOver(e, colId) {
  if (colId === 'position') return
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

function onColDragEnd() {
  resetColDrag()
}

function resetColDrag() {
  dragColId.value = null
  dropColId.value = null
}

const KEY_MAP = {
  0: '', 1: 'Am', 2: 'Bm', 3: 'Dbm', 4: 'Ebm', 5: 'Fm', 6: 'Gm',
  7: 'Abm', 8: 'Bbm', 9: 'Cm', 10: 'Dm', 11: 'Em', 12: 'F#m',
  13: 'C', 14: 'D', 15: 'E', 16: 'Gb', 17: 'Ab', 18: 'Bb',
  19: 'F', 20: 'G', 21: 'A', 22: 'B', 23: 'Db', 24: 'Eb'
}

// Camelot wheel: Engine DJ key value → Camelot notation
const CAMELOT_MAP = {
  0: '',
  1: '8A',   // Am
  2: '10A',  // Bm
  3: '12A',  // Dbm
  4: '2A',   // Ebm
  5: '4A',   // Fm
  6: '6A',   // Gm
  7: '1A',   // Abm
  8: '3A',   // Bbm
  9: '5A',   // Cm
  10: '7A',  // Dm
  11: '9A',  // Em
  12: '11A', // F#m
  13: '8B',  // C
  14: '10B', // D
  15: '12B', // E
  16: '2B',  // Gb
  17: '4B',  // Ab
  18: '6B',  // Bb
  19: '7B',  // F
  20: '9B',  // G
  21: '11B', // A
  22: '1B',  // B
  23: '12B', // Db (enharmonic of B)
  24: '3B'   // Eb
}

// Rainbow colors by Camelot number (1-12), 1=red cycling through the spectrum
const CAMELOT_COLORS = {
  '1':  '#ff0000', // Red
  '2':  '#ff5500', // Red-Orange
  '3':  '#ff9900', // Orange
  '4':  '#ffcc00', // Yellow-Orange
  '5':  '#ffff00', // Yellow
  '6':  '#88dd00', // Yellow-Green
  '7':  '#00cc00', // Green
  '8':  '#00ccaa', // Teal
  '9':  '#0099ff', // Blue
  '10': '#4444ff', // Indigo
  '11': '#9933ff', // Violet
  '12': '#ff33cc', // Pink
}

// Sort weight for key column: ordered by Camelot number (1A, 1B, 2A, 2B, ... 12A, 12B)
const KEY_SORT_WEIGHT = {}
for (const [engineVal, camelot] of Object.entries(CAMELOT_MAP)) {
  if (!camelot) { KEY_SORT_WEIGHT[engineVal] = 999; continue }
  const num = parseInt(camelot.replace(/[AB]/, ''))
  const letter = camelot.endsWith('A') ? 0 : 1
  KEY_SORT_WEIGHT[engineVal] = num * 2 + letter
}

function getKeyColor(keyVal) {
  if (!keyVal) return null
  const camelot = CAMELOT_MAP[keyVal]
  if (!camelot) return null
  const num = camelot.replace(/[AB]/, '')
  return CAMELOT_COLORS[num] || null
}

function formatCell(track, colId) {
  const val = track[colId]
  switch (colId) {
    case 'position':
      return positionMap.value.get(track.entityId) ?? ''
    case 'preview':
      return ''
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
      return props.keyNotation === KEY_NOTATION_CAMELOT ? (CAMELOT_MAP[val] || '') : (KEY_MAP[val] || '')
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

// Map entityId -> original playlist position (1-based)
const positionMap = computed(() => {
  const map = new Map()
  linkedListTracks.value.forEach((t, i) => map.set(t.entityId, i + 1))
  return map
})

const sortedTracks = computed(() => {
  // Position sort = linked list order (asc) or reversed (desc)
  if (!sortField.value || sortField.value === 'position') {
    if (sortField.value === 'position' && !sortAsc.value) {
      return [...linkedListTracks.value].reverse()
    }
    return linkedListTracks.value
  }
  const field = sortField.value
  const dir = sortAsc.value ? 1 : -1
  return [...linkedListTracks.value].sort((a, b) => {
    if (field === 'key') {
      const wa = KEY_SORT_WEIGHT[a.key] ?? 999
      const wb = KEY_SORT_WEIGHT[b.key] ?? 999
      return (wa - wb) * dir
    }
    const va = a[field] ?? ''
    const vb = b[field] ?? ''
    if (typeof va === 'number' && typeof vb === 'number') return (va - vb) * dir
    return String(va).localeCompare(String(vb)) * dir
  })
})

// Drag reorder only when in linked-list position order and not in Collection view
const canDrag = computed(() => {
  if (props.listId === -1) return false
  return !sortField.value || (sortField.value === 'position' && sortAsc.value)
})

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
  saveColumnSettings()
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

async function removeFromPlaylist() {
  const track = rowContextMenu.value.track
  const listId = props.listId
  closeRowContextMenu()
  if (!track || listId == null || listId === -1) return

  // Collect entity IDs: if the right-clicked track is in the selection, remove all selected; otherwise just the one
  const trackKey = track.entityId || track.trackId
  const removeSelected = selectedTrackIds.value.has(trackKey) && selectedTrackIds.value.size > 1
  try {
    if (removeSelected) {
      const entityIds = sortedTracks.value
        .filter(t => selectedTrackIds.value.has(t.entityId || t.trackId))
        .map(t => t.entityId)
        .filter(id => id != null)
      await window.api.removeTracksFromPlaylist(listId, entityIds)
      selectedTrackIds.value = new Set()
    } else {
      if (track.entityId == null) return
      await window.api.removeTrackFromPlaylist(listId, track.entityId)
    }
    emit('tracks-updated')
  } catch (err) {
    console.error('Failed to remove track(s) from playlist:', err)
  }
}

async function removeFromCollection() {
  const track = rowContextMenu.value.track
  closeRowContextMenu()
  if (!track || track.trackId == null) return

  const trackKey = track.entityId || track.trackId
  const removeSelected = selectedTrackIds.value.has(trackKey) && selectedTrackIds.value.size > 1

  if (removeSelected) {
    const trackIds = sortedTracks.value
      .filter(t => selectedTrackIds.value.has(t.entityId || t.trackId))
      .map(t => t.trackId)
      .filter(id => id != null)
    if (!confirm(`Permanently remove ${trackIds.length} tracks from the collection and all playlists?`)) return
    try {
      for (const id of trackIds) {
        await window.api.removeFromCollection(id)
      }
      selectedTrackIds.value = new Set()
      emit('tracks-updated')
    } catch (err) {
      console.error('Failed to remove tracks from collection:', err)
    }
  } else {
    if (!confirm(`Permanently remove "${track.title || 'this track'}" from the collection and all playlists?`)) return
    try {
      await window.api.removeFromCollection(track.trackId)
      selectedTrackIds.value = new Set()
      emit('tracks-updated')
    } catch (err) {
      console.error('Failed to remove track from collection:', err)
    }
  }
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
  saveColumnSettings()
}

// --- Drag and drop reorder ---
function onDragStart(e, index) {
  const track = sortedTracks.value[index]
  const trackKey = track.entityId || track.trackId

  // Ensure the dragged track is in the selection
  if (!selectedTrackIds.value.has(trackKey)) {
    selectedTrackIds.value = new Set([trackKey])
    lastClickedIndex.value = index
  }

  // Build list of selected tracks for cross-component drops
  const selectedTracks = sortedTracks.value
    .filter(t => selectedTrackIds.value.has(t.entityId || t.trackId))
    .map(t => ({ trackId: t.trackId, databaseUuid: t.databaseUuid || '' }))

  e.dataTransfer.setData('application/track', JSON.stringify(
    selectedTracks.length === 1 ? selectedTracks[0] : selectedTracks
  ))
  e.dataTransfer.effectAllowed = 'move'

  if (canDrag.value) {
    isDragging.value = true
    dragIndex.value = index
    e.dataTransfer.setData('text/plain', String(index))
    if (e.target) {
      e.target.style.opacity = '0.4'
    }
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
          :class="{ sorted: sortField === col.id, 'col-drop-target': dropColId === col.id, 'col-dragging': dragColId === col.id }"
          :style="{ width: columnWidths[col.id] + 'px', textAlign: col.align }"
          :draggable="col.id !== 'position'"
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
          :key="track.entityId"
          class="track-row"
          :class="[
            dropClass(index),
            { dragging: dragIndex === index, 'drag-enabled': canDrag, selected: isSelected(track) }
          ]"
          :style="{ width: totalWidth + 'px' }"
          draggable="true"
          @click="onRowClick($event, track, index)"
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
            :style="{ width: columnWidths[col.id] + 'px', textAlign: col.align, color: col.id === 'key' ? getKeyColor(track.key) : undefined }"
            :title="String(formatCell(track, col.id))"
            @dblclick.stop="onCellDblClick(track, col.id)"
          >
            <input
              v-if="isEditingCell(track, col.id)"
              ref="cellInput"
              v-model="editingValue"
              class="cell-edit-input"
              @keydown.enter.stop="confirmCellEdit(track)"
              @keydown.escape.stop="cancelCellEdit"
              @blur="confirmCellEdit(track)"
              @click.stop
            />
            <div v-else-if="col.id === 'preview'" class="preview-cell">
              <button
                class="play-btn"
                @click.stop="togglePlay(track)"
                :title="playingTrackId === track.trackId ? 'Pause' : 'Play'"
              >{{ playingTrackId === track.trackId ? '&#9646;&#9646;' : '&#9654;' }}</button>
              <WaveformPreview
                v-if="waveformData >= 0 && getWaveform(track.trackId)"
                :bars="getWaveform(track.trackId)"
              />
            </div>
            <template v-else>{{ formatCell(track, col.id) }}</template>
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
        <div v-if="listId && listId !== -1" class="context-menu-item context-menu-delete" @click="removeFromPlaylist">
          <span class="context-menu-icon">&#128465;</span>
          <span>{{ selectedTrackIds.size > 1 && selectedTrackIds.has(rowContextMenu.track?.entityId || rowContextMenu.track?.trackId) ? `Remove ${selectedTrackIds.size} tracks` : 'Remove from Playlist' }}</span>
        </div>
        <div class="context-menu-item context-menu-delete" @click="removeFromCollection">
          <span class="context-menu-icon">&#10060;</span>
          <span>{{ selectedTrackIds.size > 1 && selectedTrackIds.has(rowContextMenu.track?.entityId || rowContextMenu.track?.trackId) ? `Remove ${selectedTrackIds.size} from Collection` : 'Remove from Collection' }}</span>
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

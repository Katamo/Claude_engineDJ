<script setup>
import { ref, onMounted } from 'vue'
import { DEFAULT_MUSIC_DRIVE, DEFAULT_MUSIC_FOLDERS, DEFAULT_EXCLUDE_FOLDERS, DEFAULT_SIZE_TOLERANCE, DEFAULT_KEY_NOTATION } from '../constants'

const emit = defineEmits(['close', 'config-changed'])

const dbPath = ref('')
const keyNotation = ref(DEFAULT_KEY_NOTATION)
const musicDrive = ref(DEFAULT_MUSIC_DRIVE)
const musicFolders = ref([...DEFAULT_MUSIC_FOLDERS])
const excludeFolders = ref([...DEFAULT_EXCLUDE_FOLDERS])
const sizeTolerance = ref(DEFAULT_SIZE_TOLERANCE)
const savedMessage = ref('')

onMounted(async () => {
  const config = await window.api.getConfig()
  dbPath.value = config.dbPath || ''
  keyNotation.value = config.keyNotation || DEFAULT_KEY_NOTATION
  musicDrive.value = config.musicDrive || DEFAULT_MUSIC_DRIVE
  musicFolders.value = Array.isArray(config.musicFolders) ? [...config.musicFolders] : [...DEFAULT_MUSIC_FOLDERS]
  excludeFolders.value = Array.isArray(config.excludeFolders) ? [...config.excludeFolders] : [...DEFAULT_EXCLUDE_FOLDERS]
  sizeTolerance.value = config.sizeTolerance != null ? config.sizeTolerance : DEFAULT_SIZE_TOLERANCE
})

async function browsePath() {
  const selected = await window.api.selectFolder()
  if (selected) {
    dbPath.value = selected
  }
}

async function addMusicFolder() {
  const selected = await window.api.selectMusicFolder()
  if (selected && !musicFolders.value.includes(selected)) {
    musicFolders.value.push(selected)
  }
}

function removeMusicFolder(index) {
  musicFolders.value.splice(index, 1)
}

function updateMusicFolder(index, value) {
  musicFolders.value[index] = value
}

async function addExcludeFolder() {
  const selected = await window.api.selectMusicFolder()
  if (selected && !excludeFolders.value.includes(selected)) {
    excludeFolders.value.push(selected)
  }
}

function removeExcludeFolder(index) {
  excludeFolders.value.splice(index, 1)
}

function updateExcludeFolder(index, value) {
  excludeFolders.value[index] = value
}

async function save() {
  // Filter out empty entries from musicFolders
  const folders = musicFolders.value.filter(f => f.trim())
  const excluded = excludeFolders.value.filter(f => f.trim())
  const config = {
    dbPath: dbPath.value,
    keyNotation: keyNotation.value,
    musicDrive: musicDrive.value,
    musicFolders: folders,
    excludeFolders: excluded,
    sizeTolerance: sizeTolerance.value
  }
  await window.api.saveConfig(config)
  await window.api.setDbPath(dbPath.value)
  savedMessage.value = 'Settings saved successfully'
  setTimeout(() => { savedMessage.value = '' }, 3000)
  emit('config-changed')
}
</script>

<template>
  <div class="settings-view">
    <div class="settings-panel">
      <div class="settings-header">
        <h2>Settings</h2>
        <button class="settings-close" @click="emit('close')">&times;</button>
      </div>

      <div class="settings-body">
        <div class="settings-section">
          <h3>Database</h3>

          <div class="setting-row">
            <label>Database folder path</label>
            <div class="path-input-group">
              <input
                type="text"
                class="setting-input"
                v-model="dbPath"
                placeholder="Path to Engine Library Database2 folder..."
              />
              <button class="btn btn-secondary" @click="browsePath">Browse...</button>
            </div>
            <p class="setting-hint">
              Select the folder containing your Engine DJ .db files (e.g. Engine Library/Database2)
            </p>
          </div>
        </div>

        <div class="settings-section">
          <h3>Audio</h3>

          <div class="setting-row">
            <label>Music drive / root path</label>
            <input
              type="text"
              class="setting-input"
              v-model="musicDrive"
              placeholder="D:\"
            />
            <p class="setting-hint">
              The drive or root path where your music files are stored. This is prepended to the track's file path for playback.
            </p>
          </div>

          <div class="setting-row">
            <label>Music folders</label>
            <div class="music-folders-list">
              <div v-for="(folder, index) in musicFolders" :key="index" class="music-folder-item">
                <input
                  type="text"
                  class="setting-input"
                  :value="folder"
                  @input="updateMusicFolder(index, $event.target.value)"
                  placeholder="/path/to/music/folder"
                />
                <button
                  class="btn btn-icon btn-remove"
                  @click="removeMusicFolder(index)"
                  title="Remove folder"
                >&times;</button>
              </div>
            </div>
            <div v-if="!musicFolders.length" class="setting-empty">No additional music folders configured.</div>
            <button class="btn btn-secondary btn-add-folder" @click="addMusicFolder">+ Add folder</button>
            <p class="setting-hint">
              Additional folder locations to search when resolving track file paths. These are checked after the music drive above.
            </p>
          </div>

          <div class="setting-row">
            <label>Exclude folders from search</label>
            <div class="music-folders-list">
              <div v-for="(folder, index) in excludeFolders" :key="index" class="music-folder-item">
                <input
                  type="text"
                  class="setting-input"
                  :value="folder"
                  @input="updateExcludeFolder(index, $event.target.value)"
                  placeholder="/path/to/excluded/folder"
                />
                <button
                  class="btn btn-icon btn-remove"
                  @click="removeExcludeFolder(index)"
                  title="Remove folder"
                >&times;</button>
              </div>
            </div>
            <div v-if="!excludeFolders.length" class="setting-empty">No excluded folders configured.</div>
            <button class="btn btn-secondary btn-add-folder" @click="addExcludeFolder">+ Add folder</button>
            <p class="setting-hint">
              Folders to skip when searching for broken track paths. Files inside these folders will be ignored.
            </p>
          </div>
        </div>

        <div class="settings-section">
          <h3>Search</h3>

          <div class="setting-row">
            <label>Similar size tolerance: {{ sizeTolerance }}%</label>
            <div class="range-input-group">
              <span class="range-label">0%</span>
              <input
                type="range"
                class="setting-range"
                v-model.number="sizeTolerance"
                min="0"
                max="10"
                step="0.5"
              />
              <span class="range-label">10%</span>
            </div>
            <p class="setting-hint">
              Tolerance for matching tracks by file size when fixing broken paths. 0% = exact size only, 10% = wider match.
            </p>
          </div>
        </div>

        <div class="settings-section">
          <h3>Display</h3>

          <div class="setting-row">
            <label>Key notation</label>
            <select class="setting-input" v-model="keyNotation">
              <option value="standard">Standard (Am, C, F#m...)</option>
              <option value="camelot">Camelot Wheel (1A, 8B, 11A...)</option>
            </select>
            <p class="setting-hint">
              Choose how musical keys are displayed in the track table
            </p>
          </div>
        </div>
      </div>

      <div class="settings-footer">
        <div v-if="savedMessage" class="save-message">{{ savedMessage }}</div>
        <div class="settings-actions">
          <button class="btn btn-secondary" @click="emit('close')">Cancel</button>
          <button class="btn btn-primary" @click="save">Save</button>
        </div>
      </div>
    </div>
  </div>
</template>

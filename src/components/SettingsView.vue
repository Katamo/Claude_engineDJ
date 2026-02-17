<script setup>
import { ref, onMounted } from 'vue'
import { DEFAULT_MUSIC_DRIVE, DEFAULT_KEY_NOTATION } from '../constants'

const emit = defineEmits(['close', 'config-changed'])

const dbPath = ref('')
const keyNotation = ref(DEFAULT_KEY_NOTATION)
const musicDrive = ref(DEFAULT_MUSIC_DRIVE)
const savedMessage = ref('')

onMounted(async () => {
  const config = await window.api.getConfig()
  dbPath.value = config.dbPath || ''
  keyNotation.value = config.keyNotation || DEFAULT_KEY_NOTATION
  musicDrive.value = config.musicDrive || DEFAULT_MUSIC_DRIVE
})

async function browsePath() {
  const selected = await window.api.selectFolder()
  if (selected) {
    dbPath.value = selected
  }
}

async function save() {
  const config = { dbPath: dbPath.value, keyNotation: keyNotation.value, musicDrive: musicDrive.value }
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

<script setup>
import { ref, watch } from 'vue'

const props = defineProps({
  track: Object,
  visible: Boolean
})

const emit = defineEmits(['close', 'save'])

const FIELDS = [
  { key: 'title',          label: 'Title',        type: 'text' },
  { key: 'artist',         label: 'Artist',       type: 'text' },
  { key: 'album',          label: 'Album',        type: 'text' },
  { key: 'genre',          label: 'Genre',        type: 'text' },
  { key: 'bpm',            label: 'BPM',          type: 'number' },
  { key: 'bpmAnalyzed',    label: 'BPM Analyzed', type: 'number', step: '0.1' },
  { key: 'key',            label: 'Key',          type: 'number' },
  { key: 'rating',         label: 'Rating (0-100)', type: 'number' },
  { key: 'length',         label: 'Length (sec)', type: 'number' },
  { key: 'year',           label: 'Year',         type: 'number' },
  { key: 'label',          label: 'Label',        type: 'text' },
  { key: 'comment',        label: 'Comment',      type: 'text' },
  { key: 'composer',       label: 'Composer',     type: 'text' },
  { key: 'remixer',        label: 'Remixer',      type: 'text' },
  { key: 'filename',       label: 'Filename',     type: 'text' },
  { key: 'filePath',       label: 'File Path',    type: 'text',   dbKey: 'path' },
  { key: 'bitrate',        label: 'Bitrate',      type: 'number' },
  { key: 'fileType',       label: 'File Type',    type: 'text' },
  { key: 'dateAdded',      label: 'Date Added',   type: 'text' },
  { key: 'timeLastPlayed', label: 'Last Played',  type: 'text' },
]

const form = ref({})
const saving = ref(false)
const message = ref('')

watch(() => props.track, (t) => {
  if (t) {
    const f = {}
    for (const field of FIELDS) {
      f[field.key] = t[field.key] ?? ''
    }
    form.value = f
    message.value = ''
  }
}, { immediate: true })

async function save() {
  if (!props.track) return
  saving.value = true
  message.value = ''
  try {
    const updates = {}
    for (const field of FIELDS) {
      const dbKey = field.dbKey || field.key
      let val = form.value[field.key]
      if (field.type === 'number' && val !== '' && val !== null) {
        val = Number(val)
      }
      updates[dbKey] = val
    }
    const result = await window.api.updateTrack(props.track.trackId, updates)
    if (result.success) {
      message.value = 'Saved'
      setTimeout(() => emit('save'), 500)
    } else {
      message.value = 'Error: ' + (result.error || 'Unknown')
    }
  } catch (err) {
    message.value = 'Error: ' + err.message
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <Teleport to="body">
    <div v-if="visible" class="edit-overlay" @mousedown.self="emit('close')">
      <div class="edit-dialog">
        <div class="edit-header">
          <h3>Edit Track</h3>
          <span class="edit-track-id"># {{ track?.trackId }}</span>
          <button class="settings-close" @click="emit('close')">&times;</button>
        </div>
        <div class="edit-body">
          <div v-for="field in FIELDS" :key="field.key" class="edit-field">
            <label>{{ field.label }}</label>
            <input
              :type="field.type"
              :step="field.step"
              v-model="form[field.key]"
              class="setting-input"
            />
          </div>
        </div>
        <div class="edit-footer">
          <span v-if="message" class="save-message" :class="{ error: message.startsWith('Error') }">{{ message }}</span>
          <div class="settings-actions">
            <button class="btn btn-secondary" @click="emit('close')">Cancel</button>
            <button class="btn btn-primary" :disabled="saving" @click="save">
              {{ saving ? 'Saving...' : 'Save' }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>

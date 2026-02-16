<script setup>
defineProps({
  stats: Object,
  currentDb: String
})
</script>

<template>
  <div class="status-bar">
    <div class="status-item">
      <span class="status-dot"></span>
      <span>{{ currentDb }}</span>
    </div>
    <template v-if="stats">
      <div class="status-item">Playlists: {{ stats.playlists }}</div>
      <div class="status-item">Tracks: {{ stats.tracks }}</div>
      <div class="status-item">Playlist Entries: {{ stats.entities }}</div>
      <div v-if="stats.info" class="status-item">
        Schema: v{{ stats.info.schemaVersionMajor }}.{{ stats.info.schemaVersionMinor }}.{{ stats.info.schemaVersionPatch }}
      </div>
    </template>
  </div>
</template>

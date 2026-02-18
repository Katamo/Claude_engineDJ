<script setup>
import { ref } from 'vue'

const props = defineProps({
  items: Array,
  selectedPath: String,
  depth: { type: Number, default: 0 }
})

const emit = defineEmits(['select-folder'])

const expandedPaths = ref(new Set())

function toggle(item) {
  if (expandedPaths.value.has(item.path)) {
    expandedPaths.value.delete(item.path)
  } else {
    expandedPaths.value.add(item.path)
  }
}

function select(item) {
  emit('select-folder', { path: item.path, name: item.name })
}
</script>

<template>
  <div v-for="item in items" :key="item.path" class="tree-item">
    <div
      class="tree-item-row"
      :class="{ active: selectedPath === item.path }"
      :style="{ paddingLeft: (depth * 16 + 12) + 'px' }"
      @click="select(item)"
    >
      <span
        class="tree-toggle"
        :class="{ expanded: expandedPaths.has(item.path), empty: !item.children?.length }"
        @click.stop="toggle(item)"
      >&#9654;</span>
      <span class="tree-icon">&#128193;</span>
      <span class="tree-label" :title="item.name">{{ item.name }}</span>
      <span class="tree-count">{{ item.trackCount }}</span>
    </div>
    <div v-if="item.children?.length && expandedPaths.has(item.path)" class="tree-children">
      <FolderTree
        :items="item.children"
        :selectedPath="selectedPath"
        :depth="depth + 1"
        @select-folder="emit('select-folder', $event)"
      />
    </div>
  </div>
</template>

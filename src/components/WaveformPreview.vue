<script setup>
import { ref, onMounted, watch } from 'vue'

const props = defineProps({
  bars: { type: Array, default: null }
})

const canvas = ref(null)

function draw() {
  const c = canvas.value
  if (!c) return
  const ctx = c.getContext('2d')
  const w = c.width
  const h = c.height
  ctx.clearRect(0, 0, w, h)

  if (!props.bars || !props.bars.length) return

  const barW = w / props.bars.length
  // Find max combined value for normalization
  let maxVal = 1
  for (const b of props.bars) {
    const total = b.low + b.mid + b.high
    if (total > maxVal) maxVal = total
  }

  for (let i = 0; i < props.bars.length; i++) {
    const { low, mid, high } = props.bars[i]
    const total = low + mid + high
    const barH = (total / maxVal) * h
    const x = i * barW
    const y = h - barH

    // Draw stacked: low (blue), mid (cyan), high (white)
    const lowH = (low / maxVal) * h
    const midH = (mid / maxVal) * h
    const highH = (high / maxVal) * h

    ctx.fillStyle = '#1a6eff'
    ctx.fillRect(x, h - lowH, Math.max(1, barW - 0.3), lowH)

    ctx.fillStyle = '#00c8ff'
    ctx.fillRect(x, h - lowH - midH, Math.max(1, barW - 0.3), midH)

    ctx.fillStyle = '#ccefff'
    ctx.fillRect(x, h - lowH - midH - highH, Math.max(1, barW - 0.3), highH)
  }
}

onMounted(draw)
watch(() => props.bars, draw)
</script>

<template>
  <canvas ref="canvas" width="56" height="24" class="waveform-canvas"></canvas>
</template>

<style scoped>
.waveform-canvas {
  display: block;
  border-radius: 2px;
  background: rgba(0, 0, 0, 0.3);
}
</style>

<script setup>
import { ref, onMounted, watch, nextTick } from 'vue'

const props = defineProps({
  bars: { type: Array, default: null }
})

const canvas = ref(null)

function draw() {
  const c = canvas.value
  if (!c || !props.bars || !props.bars.length) return
  const ctx = c.getContext('2d')
  const w = c.width
  const h = c.height
  ctx.clearRect(0, 0, w, h)

  const barW = w / props.bars.length
  // Find max combined value for normalization
  let maxVal = 1
  for (const b of props.bars) {
    const total = b.low + b.mid + b.high
    if (total > maxVal) maxVal = total
  }

  for (let i = 0; i < props.bars.length; i++) {
    const { low, mid, high } = props.bars[i]

    const lowH = (low / maxVal) * h
    const midH = (mid / maxVal) * h
    const highH = (high / maxVal) * h

    const x = i * barW
    const bw = Math.max(1, barW - 0.3)

    ctx.fillStyle = '#1a6eff'
    ctx.fillRect(x, h - lowH, bw, lowH)

    ctx.fillStyle = '#00c8ff'
    ctx.fillRect(x, h - lowH - midH, bw, midH)

    ctx.fillStyle = '#ccefff'
    ctx.fillRect(x, h - lowH - midH - highH, bw, highH)
  }
}

onMounted(() => {
  draw()
})

watch(() => props.bars, () => {
  nextTick(draw)
}, { deep: true })
</script>

<template>
  <canvas ref="canvas" width="120" height="20" class="waveform-canvas"></canvas>
</template>

<style scoped>
.waveform-canvas {
  display: block;
  width: 100%;
  height: 20px;
  border-radius: 2px;
  background: #1a1a2e;
}
</style>

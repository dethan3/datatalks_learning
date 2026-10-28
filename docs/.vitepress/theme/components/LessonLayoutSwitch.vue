<script setup lang="ts">
defineProps<{ pinned: boolean }>()
defineEmits<{ change: [mode: 'split' | 'pinned'] }>()
</script>

<template>
  <div class="lesson-layout-switch" role="group" aria-label="Reading layout">
    <button :aria-pressed="!pinned" title="Read beside the video" @click="$emit('change', 'split')">Side by side</button>
    <button :aria-pressed="pinned" title="Keep course directories visible while reading" @click="$emit('change', 'pinned')">Pin directories</button>
  </div>
</template>

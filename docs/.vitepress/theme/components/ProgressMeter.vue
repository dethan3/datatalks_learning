<script setup lang="ts">
import { computed } from 'vue'
const props = withDefaults(defineProps<{ completed: number; total: number; label?: string }>(), { label: 'Course progress' })
const percent = computed(() => props.total ? Math.floor(props.completed / props.total * 100) : 0)
</script>

<template>
  <div class="learning-progress-meter">
    <div class="progress-meter-label"><span>{{ completed }} / {{ total }} lessons completed</span><strong>{{ percent }}%</strong></div>
    <progress :value="completed" :max="total || 1" :aria-label="label" :aria-valuetext="`${completed} of ${total} lessons completed`" />
  </div>
</template>
